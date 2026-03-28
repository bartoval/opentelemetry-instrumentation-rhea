import type { InstrumentationConfig } from '@opentelemetry/instrumentation';
import type { Span } from '@opentelemetry/api';
import type { Sender, Receiver, Connection, Message, Delivery, EventContext } from 'rhea';

// --- Internal types (not part of public API) ---

export type DispatchFunction = (name: string, eventContext?: EventContext) => boolean;

export interface RheaLinkModule {
  Sender: {
    prototype: Pick<Sender, 'send'>;
  };
  Receiver: {
    prototype: {
      dispatch: DispatchFunction;
    };
  };
}

// --- Public API types ---

export interface RheaPublishInfo {
  moduleExports: RheaLinkModule;
  msg: Message;
  sender: Sender;
  connection: Connection;
}

export interface RheaConsumeInfo {
  moduleExports: RheaLinkModule;
  msg: Message;
  receiver: Receiver;
  delivery?: Delivery;
  connection: Connection;
}

export interface RheaInstrumentationConfig extends InstrumentationConfig {
  publishHook?: (span: Span, info: RheaPublishInfo) => void;
  consumeHook?: (span: Span, info: RheaConsumeInfo) => void;
  consumeEndHook?: (span: Span, info: RheaConsumeInfo) => void;
  useLinksForConsume?: boolean;
}
