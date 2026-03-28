import { NodeTracerProvider } from '@opentelemetry/sdk-trace-node';
import { SimpleSpanProcessor, ConsoleSpanExporter } from '@opentelemetry/sdk-trace-base';
import { RheaInstrumentation } from '../src';

const instrumentation = new RheaInstrumentation({
  publishHook: (span, info) => {
    try {
      const body = typeof info.msg.body === 'string' ? JSON.parse(info.msg.body) : info.msg.body;
      if (body?.orderId) {
        span.setAttribute('app.order_id', body.orderId);
      }
    } catch {
      // body is not JSON
    }
    span.setAttribute('app.publisher', 'order-service');
  },
  consumeHook: (span, _info) => {
    span.setAttribute('app.consumer_group', 'order-processor');
    span.setAttribute('app.processing_start', Date.now());
  },
  consumeEndHook: (span) => {
    span.setAttribute('app.processing_end', Date.now());
    span.setAttribute('app.outcome', 'success');
  },
});
instrumentation.enable();

// eslint-disable-next-line @typescript-eslint/no-var-requires
const rhea = require('rhea');

const provider = new NodeTracerProvider({
  spanProcessors: [new SimpleSpanProcessor(new ConsoleSpanExporter())],
});
provider.register();
instrumentation.setTracerProvider(provider);

const container = rhea.create_container();
const server = container.listen({ port: 0 });

server.on('listening', () => {
  const port = (server.address() as any).port;
  console.log(`[server] Listening on port ${port}`);

  container.on('message', (eventContext: any) => {
    console.log(`[receiver] Got message: ${eventContext.message.body}`);

    setTimeout(() => {
      console.log('\nDone! Check the custom attributes in the spans above.');
      console.log('Look for: app.order_id, app.publisher, app.consumer_group, app.outcome');
      connection.close();
      server.close();
    }, 500);
  });

  const connection = container.connect({ port, host: 'localhost' });
  const sender = connection.open_sender('orders-queue');

  sender.on('sendable', () => {
    console.log('[sender] Sending order message...');
    sender.send({
      body: JSON.stringify({ orderId: 'ORD-12345', item: 'Widget', quantity: 3 }),
      message_id: 'order-msg-001',
    });
  });
});
