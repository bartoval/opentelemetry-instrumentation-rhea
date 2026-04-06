import {
  InstrumentationBase,
  InstrumentationNodeModuleDefinition,
  InstrumentationNodeModuleFile,
  isWrapped,
} from '@opentelemetry/instrumentation';
import {
  context,
  propagation,
  trace,
  SpanKind,
  SpanStatusCode,
  ROOT_CONTEXT,
} from '@opentelemetry/api';
import type { Link } from '@opentelemetry/api';
import type { Sender, Receiver, Message, EventContext } from 'rhea';
import type { RheaInstrumentationConfig } from './types';
import type { RheaLinkModule, DispatchFunction } from './internal-types';
import {
  ATTR_NETWORK_PEER_ADDRESS,
  ATTR_NETWORK_PEER_PORT,
} from '@opentelemetry/semantic-conventions';
import {
  ATTR_MESSAGING_SYSTEM,
  ATTR_MESSAGING_OPERATION_NAME,
  ATTR_MESSAGING_OPERATION_TYPE,
  ATTR_MESSAGING_DESTINATION_NAME,
  ATTR_MESSAGING_MESSAGE_ID,
  ATTR_MESSAGING_MESSAGE_CONVERSATION_ID,
  ATTR_MESSAGING_MESSAGE_BODY_SIZE,
  ATTR_MESSAGING_CLIENT_ID,
} from './semconv';
import {
  getDestinationAddress,
  getPublishSpanName,
  getConsumeSpanName,
  getNetworkPeerAddress,
  getNetworkPeerPort,
  getContainerId,
  getMessageBodySize,
  ensureApplicationProperties,
} from './utils';

import { PACKAGE_NAME, PACKAGE_VERSION } from './version';

const RHEA_MODULE_NAME = 'rhea';
const RHEA_LINK_MODULE = 'rhea/lib/link.js';
const SUPPORTED_VERSIONS = ['>=1.0.0 <4'];

export class RheaInstrumentation extends InstrumentationBase<RheaInstrumentationConfig> {
  constructor(config: RheaInstrumentationConfig = {}) {
    super(PACKAGE_NAME, PACKAGE_VERSION, config);
  }

  protected init() {
    const linkModuleFile = new InstrumentationNodeModuleFile(
      RHEA_LINK_MODULE,
      SUPPORTED_VERSIONS,
      (moduleExports: RheaLinkModule) => {
        this._patchSend(moduleExports);
        this._patchConsume(moduleExports);

        return moduleExports;
      },
      (moduleExports: RheaLinkModule) => {
        if (moduleExports) {
          this._unpatchSend(moduleExports);
          this._unpatchConsume(moduleExports);
        }
      }
    );

    return new InstrumentationNodeModuleDefinition(
      RHEA_MODULE_NAME,
      SUPPORTED_VERSIONS,
      undefined,
      undefined,
      [linkModuleFile]
    );
  }

  private _patchSend(moduleExports: RheaLinkModule): void {
    const { prototype } = moduleExports.Sender;

    if (isWrapped(prototype.send)) {
      this._unwrap(prototype, 'send');
    }

    this._wrap(prototype, 'send', this._getSendPatch(moduleExports));
    this._diag.debug('Patched Sender.prototype.send');
  }

  private _unpatchSend(moduleExports: RheaLinkModule): void {
    const { prototype } = moduleExports.Sender;

    if (isWrapped(prototype.send)) {
      this._unwrap(prototype, 'send');
      this._diag.debug('Unpatched Sender.prototype.send');
    }
  }

  private _patchConsume(moduleExports: RheaLinkModule): void {
    const { prototype } = moduleExports.Receiver;

    if (isWrapped(prototype.dispatch)) {
      this._unwrap(prototype, 'dispatch');
    }

    this._wrap(prototype, 'dispatch', this._getConsumePatch(moduleExports));
    this._diag.debug('Patched Receiver.prototype.dispatch');
  }

  private _unpatchConsume(moduleExports: RheaLinkModule): void {
    const { prototype } = moduleExports.Receiver;

    if (isWrapped(prototype.dispatch)) {
      this._unwrap(prototype, 'dispatch');
      this._diag.debug('Unpatched Receiver.prototype.dispatch');
    }
  }

  private _getSendPatch(_moduleExports: RheaLinkModule) {
    // eslint-disable-next-line @typescript-eslint/no-this-alias
    const instrumentation = this;

    return (original: Sender['send']): Sender['send'] => {
      return function patchedSend(
        this: Sender,
        msg: Message,
        tag?: Buffer | string,
        format?: number
      ) {
        const { enabled, publishHook } = instrumentation.getConfig();

        if (!enabled) {
          return original.call(this, msg, tag, format);
        }

        // eslint-disable-next-line @typescript-eslint/no-this-alias
        const sender = this;
        const { connection } = sender;
        const address = getDestinationAddress(sender);

        const span = instrumentation.tracer.startSpan(getPublishSpanName(address), {
          kind: SpanKind.PRODUCER,
          attributes: {
            [ATTR_MESSAGING_SYSTEM]: 'amqp',
            [ATTR_MESSAGING_OPERATION_NAME]: 'publish',
            [ATTR_MESSAGING_OPERATION_TYPE]: 'publish',
            [ATTR_MESSAGING_DESTINATION_NAME]: address,
          },
        });

        if (msg.message_id) {
          span.setAttribute(ATTR_MESSAGING_MESSAGE_ID, String(msg.message_id));
        }

        if (msg.correlation_id) {
          span.setAttribute(ATTR_MESSAGING_MESSAGE_CONVERSATION_ID, String(msg.correlation_id));
        }

        const bodySize = getMessageBodySize(msg);

        if (bodySize !== undefined) {
          span.setAttribute(ATTR_MESSAGING_MESSAGE_BODY_SIZE, bodySize);
        }

        const peerAddress = getNetworkPeerAddress(connection);

        if (peerAddress) {
          span.setAttribute(ATTR_NETWORK_PEER_ADDRESS, peerAddress);
        }

        const peerPort = getNetworkPeerPort(connection);

        if (peerPort) {
          span.setAttribute(ATTR_NETWORK_PEER_PORT, peerPort);
        }

        const containerId = getContainerId(connection);

        if (containerId) {
          span.setAttribute(ATTR_MESSAGING_CLIENT_ID, containerId);
        }

        try {
          publishHook?.(span, { msg, sender, connection });
        } catch (hookError) {
          instrumentation._diag.error('publishHook error', hookError);
        }

        const appProperties = ensureApplicationProperties(msg);
        const spanContext = trace.setSpan(context.active(), span);
        propagation.inject(spanContext, appProperties);

        try {
          const result = original.call(this, msg, tag, format);
          span.end();

          return result;
        } catch (error) {
          span.setStatus({
            code: SpanStatusCode.ERROR,
            message: error instanceof Error ? error.message : String(error),
          });
          span.end();
          throw error;
        }
      };
    };
  }

  private _getConsumePatch(_moduleExports: RheaLinkModule) {
    // eslint-disable-next-line @typescript-eslint/no-this-alias
    const instrumentation = this;

    return (original: DispatchFunction): DispatchFunction => {
      return function patchedDispatch(this: Receiver, name: string, eventContext?: EventContext) {
        const { enabled, useLinksForConsume, consumeHook, consumeEndHook } =
          instrumentation.getConfig();

        if (name !== 'message' || !enabled) {
          return original.call(this, name, eventContext);
        }

        // eslint-disable-next-line @typescript-eslint/no-this-alias
        const receiver = this;
        const { connection } = receiver;
        const msg = eventContext?.message;
        const delivery = eventContext?.delivery;

        if (!msg) {
          return original.call(this, name, eventContext);
        }

        const address = getDestinationAddress(receiver);

        const extractedContext = propagation.extract(
          ROOT_CONTEXT,
          msg.application_properties ?? {}
        );

        const links: Link[] = [];
        let parentContext = context.active();

        if (useLinksForConsume) {
          const extractedSpanContext = trace.getSpanContext(extractedContext);

          if (extractedSpanContext) {
            links.push({ context: extractedSpanContext });
          }
        } else {
          parentContext = extractedContext;
        }

        const span = instrumentation.tracer.startSpan(
          getConsumeSpanName(address),
          {
            kind: SpanKind.CONSUMER,
            attributes: {
              [ATTR_MESSAGING_SYSTEM]: 'amqp',
              [ATTR_MESSAGING_OPERATION_NAME]: 'receive',
              [ATTR_MESSAGING_OPERATION_TYPE]: 'receive',
              [ATTR_MESSAGING_DESTINATION_NAME]: address,
            },
            links,
          },
          parentContext
        );

        if (msg.message_id) {
          span.setAttribute(ATTR_MESSAGING_MESSAGE_ID, String(msg.message_id));
        }

        if (msg.correlation_id) {
          span.setAttribute(ATTR_MESSAGING_MESSAGE_CONVERSATION_ID, String(msg.correlation_id));
        }

        const bodySize = getMessageBodySize(msg);

        if (bodySize !== undefined) {
          span.setAttribute(ATTR_MESSAGING_MESSAGE_BODY_SIZE, bodySize);
        }

        const peerAddress = getNetworkPeerAddress(connection);

        if (peerAddress) {
          span.setAttribute(ATTR_NETWORK_PEER_ADDRESS, peerAddress);
        }

        const peerPort = getNetworkPeerPort(connection);

        if (peerPort) {
          span.setAttribute(ATTR_NETWORK_PEER_PORT, peerPort);
        }

        const containerId = getContainerId(connection);

        if (containerId) {
          span.setAttribute(ATTR_MESSAGING_CLIENT_ID, containerId);
        }

        const consumeInfo = { msg, receiver, delivery, connection };

        try {
          consumeHook?.(span, consumeInfo);
        } catch (hookError) {
          instrumentation._diag.error('consumeHook error', hookError);
        }

        const spanContext = trace.setSpan(context.active(), span);
        let result: boolean;

        try {
          result = context.with(spanContext, () => original.call(receiver, name, eventContext));
        } catch (error) {
          span.setStatus({
            code: SpanStatusCode.ERROR,
            message: error instanceof Error ? error.message : String(error),
          });
          throw error;
        } finally {
          try {
            consumeEndHook?.(span, consumeInfo);
          } catch (hookError) {
            instrumentation._diag.error('consumeEndHook error', hookError);
          }

          span.end();
        }

        return result;
      };
    };
  }
}
