import * as assert from 'assert';
import { SpanKind } from '@opentelemetry/api';
import { NodeTracerProvider } from '@opentelemetry/sdk-trace-node';
import { InMemorySpanExporter, SimpleSpanProcessor } from '@opentelemetry/sdk-trace-base';
import { RheaInstrumentation } from '../src';

const instrumentation = new RheaInstrumentation();
instrumentation.enable();

import rhea from 'rhea';

const memoryExporter = new InMemorySpanExporter();
const provider = new NodeTracerProvider({
  spanProcessors: [new SimpleSpanProcessor(memoryExporter)],
});
provider.register();
instrumentation.setTracerProvider(provider);

interface BrokerPair {
  senderContainer: any;
  receiverContainer: any;
  sender: any;
  server: any;
  port: number;
  close: () => void;
}

function waitForMessage(
  container: any,
  timeout = 5000
): Promise<{ message: any; delivery: any; receiver: any; connection: any }> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('Timeout waiting for message')), timeout);
    const handler = (eventContext: any) => {
      clearTimeout(timer);
      container.removeListener('message', handler);
      resolve({
        message: eventContext.message,
        delivery: eventContext.delivery,
        receiver: eventContext.receiver,
        connection: eventContext.connection,
      });
    };
    container.on('message', handler);
  });
}

function createBrokerPair(): Promise<BrokerPair> {
  return new Promise((resolve, reject) => {
    const receiverContainer = rhea.create_container();
    const senderContainer = rhea.create_container();

    const server = receiverContainer.listen({ port: 0 });

    server.on('listening', () => {
      const port = (server.address() as any).port;

      const connection = senderContainer.connect({
        port,
        host: 'localhost',
      });
      const sender = connection.open_sender('test-queue');

      sender.on('sendable', () => {
        resolve({
          senderContainer,
          receiverContainer,
          sender,
          server,
          port,
          close: () => {
            connection.close();
            server.close();
          },
        });
      });
    });

    server.on('error', reject);
  });
}

describe('RheaInstrumentation', () => {
  let broker: BrokerPair;

  beforeEach(async () => {
    memoryExporter.reset();
    instrumentation.setConfig({});
    broker = await createBrokerPair();
  });

  afterEach(() => {
    broker.close();
  });

  it('should create a publish span when sending a message', (done) => {
    broker.sender.send({ body: 'test-message' });

    setTimeout(() => {
      const spans = memoryExporter.getFinishedSpans();
      const publishSpan = spans.find(
        (span) => span.attributes['messaging.operation.type'] === 'publish'
      );

      assert.ok(publishSpan, 'publish span should exist');
      assert.strictEqual(publishSpan.kind, SpanKind.PRODUCER);
      assert.strictEqual(publishSpan.name, 'test-queue publish');
      assert.strictEqual(publishSpan.attributes['messaging.system'], 'amqp');
      assert.strictEqual(publishSpan.attributes['messaging.operation.name'], 'publish');
      assert.strictEqual(publishSpan.attributes['messaging.destination.name'], 'test-queue');
      done();
    }, 500);
  });

  it('should create a consume span when receiving a message', (done) => {
    const messagePromise = waitForMessage(broker.receiverContainer);
    broker.sender.send({ body: 'test-message' });

    messagePromise.then(() => {
      setTimeout(() => {
        const spans = memoryExporter.getFinishedSpans();
        const consumeSpan = spans.find(
          (span) => span.attributes['messaging.operation.type'] === 'receive'
        );

        assert.ok(consumeSpan, 'consume span should exist');
        assert.strictEqual(consumeSpan.kind, SpanKind.CONSUMER);
        assert.strictEqual(consumeSpan.name, 'test-queue receive');
        assert.strictEqual(consumeSpan.attributes['messaging.system'], 'amqp');
        assert.strictEqual(consumeSpan.attributes['messaging.operation.name'], 'receive');
        assert.strictEqual(consumeSpan.attributes['messaging.destination.name'], 'test-queue');
        done();
      }, 200);
    });
  });

  it('should propagate context from producer to consumer (parent-child)', (done) => {
    const messagePromise = waitForMessage(broker.receiverContainer);
    broker.sender.send({ body: 'test-propagation' });

    messagePromise.then(() => {
      setTimeout(() => {
        const spans = memoryExporter.getFinishedSpans();
        const publishSpan = spans.find(
          (span) => span.attributes['messaging.operation.type'] === 'publish'
        );
        const consumeSpan = spans.find(
          (span) => span.attributes['messaging.operation.type'] === 'receive'
        );

        assert.ok(publishSpan, 'publish span should exist');
        assert.ok(consumeSpan, 'consume span should exist');

        assert.strictEqual(
          publishSpan.spanContext().traceId,
          consumeSpan.spanContext().traceId,
          'traceId should match'
        );
        assert.strictEqual(
          consumeSpan.parentSpanContext?.spanId,
          publishSpan.spanContext().spanId,
          'consume span should be child of publish span'
        );
        done();
      }, 200);
    });
  });

  it('should use links instead of parent-child when useLinksForConsume is true', (done) => {
    instrumentation.setConfig({ useLinksForConsume: true });

    const messagePromise = waitForMessage(broker.receiverContainer);
    broker.sender.send({ body: 'test-links' });

    messagePromise.then(() => {
      setTimeout(() => {
        const spans = memoryExporter.getFinishedSpans();
        const publishSpan = spans.find(
          (span) => span.attributes['messaging.operation.type'] === 'publish'
        );
        const consumeSpan = spans.find(
          (span) => span.attributes['messaging.operation.type'] === 'receive'
        );

        assert.ok(publishSpan, 'publish span should exist');
        assert.ok(consumeSpan, 'consume span should exist');

        assert.notStrictEqual(
          consumeSpan.parentSpanContext?.spanId,
          publishSpan.spanContext().spanId,
          'consume span should NOT be child of publish span'
        );

        assert.ok(consumeSpan.links.length > 0, 'consume span should have links');
        assert.strictEqual(
          consumeSpan.links[0].context.traceId,
          publishSpan.spanContext().traceId,
          'link should reference producer trace'
        );
        assert.strictEqual(
          consumeSpan.links[0].context.spanId,
          publishSpan.spanContext().spanId,
          'link should reference producer span'
        );
        done();
      }, 200);
    });
  });

  it('should call publishHook with correct info', (done) => {
    let hookCalled = false;
    instrumentation.setConfig({
      publishHook: (span, info) => {
        hookCalled = true;
        assert.ok(span, 'span should be provided');
        assert.ok(info.msg, 'msg should be provided');
        assert.ok(info.sender, 'sender should be provided');
        assert.ok(info.connection, 'connection should be provided');
        span.setAttribute('app.custom', 'publish-hook-value');
      },
    });

    broker.sender.send({ body: 'test-hook' });

    setTimeout(() => {
      assert.ok(hookCalled, 'publishHook should have been called');
      const spans = memoryExporter.getFinishedSpans();
      const publishSpan = spans.find(
        (span) => span.attributes['messaging.operation.type'] === 'publish'
      );
      assert.strictEqual(publishSpan?.attributes['app.custom'], 'publish-hook-value');
      done();
    }, 500);
  });

  it('should call consumeHook and consumeEndHook with correct info', (done) => {
    let consumeHookCalled = false;
    let consumeEndHookCalled = false;

    instrumentation.setConfig({
      consumeHook: (span, info) => {
        consumeHookCalled = true;
        assert.ok(span, 'span should be provided');
        assert.ok(info.msg, 'msg should be provided');
        assert.ok(info.receiver, 'receiver should be provided');
        span.setAttribute('app.consume', 'hook-value');
      },
      consumeEndHook: (span, info) => {
        consumeEndHookCalled = true;
        assert.ok(span, 'span should be provided');
        assert.ok(info.msg, 'msg should be provided');
        span.setAttribute('app.consume_end', 'end-value');
      },
    });

    const messagePromise = waitForMessage(broker.receiverContainer);
    broker.sender.send({ body: 'test-consume-hook' });

    messagePromise.then(() => {
      setTimeout(() => {
        assert.ok(consumeHookCalled, 'consumeHook should have been called');
        assert.ok(consumeEndHookCalled, 'consumeEndHook should have been called');

        const spans = memoryExporter.getFinishedSpans();
        const consumeSpan = spans.find(
          (span) => span.attributes['messaging.operation.type'] === 'receive'
        );
        assert.strictEqual(consumeSpan?.attributes['app.consume'], 'hook-value');
        assert.strictEqual(consumeSpan?.attributes['app.consume_end'], 'end-value');
        done();
      }, 200);
    });
  });

  it('should create a root span when no traceparent in message', (done) => {
    const messagePromise = waitForMessage(broker.receiverContainer);
    broker.sender.send({ body: 'no-context' });

    messagePromise.then(() => {
      setTimeout(() => {
        const spans = memoryExporter.getFinishedSpans();
        const consumeSpan = spans.find(
          (span) => span.attributes['messaging.operation.type'] === 'receive'
        );
        assert.ok(consumeSpan, 'consume span should exist even without traceparent');
        done();
      }, 200);
    });
  });

  it('should preserve existing application_properties', (done) => {
    const messagePromise = waitForMessage(broker.receiverContainer);
    broker.sender.send({
      body: 'test-preserve',
      application_properties: { 'custom-header': 'custom-value' },
    });

    messagePromise.then((result) => {
      const appProps = result.message.application_properties;
      assert.strictEqual(
        appProps['custom-header'],
        'custom-value',
        'custom header should be preserved'
      );
      assert.ok(appProps.traceparent, 'traceparent should be injected');
      done();
    });
  });

  it('should set semantic attributes correctly', (done) => {
    const messagePromise = waitForMessage(broker.receiverContainer);
    broker.sender.send({
      body: 'test-attributes',
      message_id: 'msg-123',
      correlation_id: 'corr-456',
    });

    messagePromise.then(() => {
      setTimeout(() => {
        const spans = memoryExporter.getFinishedSpans();
        const publishSpan = spans.find(
          (span) => span.attributes['messaging.operation.type'] === 'publish'
        );

        assert.ok(publishSpan);
        assert.strictEqual(publishSpan.attributes['messaging.message.id'], 'msg-123');
        assert.strictEqual(publishSpan.attributes['messaging.message.conversation_id'], 'corr-456');
        assert.ok(publishSpan.attributes['messaging.message.body.size']);
        assert.strictEqual(publishSpan.attributes['network.peer.address'], 'localhost');
        assert.ok(publishSpan.attributes['network.peer.port']);
        done();
      }, 200);
    });
  });

  it('should create spans for multiple messages', (done) => {
    const messageCount = 3;
    let received = 0;

    const handler = () => {
      received++;
      if (received === messageCount) {
        broker.receiverContainer.removeListener('message', handler);
      }
    };
    broker.receiverContainer.on('message', handler);

    Array.from({ length: messageCount }, (_, idx) =>
      broker.sender.send({ body: `message-${idx}` })
    );

    setTimeout(() => {
      const spans = memoryExporter.getFinishedSpans();
      const publishSpans = spans.filter(
        (span) => span.attributes['messaging.operation.type'] === 'publish'
      );
      const consumeSpans = spans.filter(
        (span) => span.attributes['messaging.operation.type'] === 'receive'
      );

      assert.strictEqual(
        publishSpans.length,
        messageCount,
        `should have ${messageCount} publish spans`
      );
      assert.strictEqual(
        consumeSpans.length,
        messageCount,
        `should have ${messageCount} consume spans`
      );
      done();
    }, 1000);
  });

  it('should not create spans when instrumentation is disabled', (done) => {
    instrumentation.disable();

    const messagePromise = waitForMessage(broker.receiverContainer);
    broker.sender.send({ body: 'disabled-test' });

    messagePromise.then(() => {
      setTimeout(() => {
        const spans = memoryExporter.getFinishedSpans();
        assert.strictEqual(spans.length, 0, 'no spans should be created');

        instrumentation.enable();
        done();
      }, 200);
    });
  });

  it('should not crash if publishHook throws', (done) => {
    instrumentation.setConfig({
      publishHook: () => {
        throw new Error('hook error');
      },
    });

    broker.sender.send({ body: 'hook-error-test' });

    setTimeout(() => {
      const spans = memoryExporter.getFinishedSpans();
      const publishSpan = spans.find(
        (span) => span.attributes['messaging.operation.type'] === 'publish'
      );
      assert.ok(publishSpan, 'span should still be created despite hook error');
      done();
    }, 500);
  });
});
