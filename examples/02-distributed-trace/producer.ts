import { NodeTracerProvider } from '@opentelemetry/sdk-trace-node';
import { SimpleSpanProcessor, ConsoleSpanExporter } from '@opentelemetry/sdk-trace-base';
import { RheaInstrumentation } from '../../src';

const instrumentation = new RheaInstrumentation();
instrumentation.enable();

// eslint-disable-next-line @typescript-eslint/no-var-requires
const rhea = require('rhea');

const provider = new NodeTracerProvider({
  spanProcessors: [new SimpleSpanProcessor(new ConsoleSpanExporter())],
});
provider.register();
instrumentation.setTracerProvider(provider);

const container = rhea.create_container();
const connection = container.connect({
  host: process.env.AMQP_HOST ?? 'localhost',
  port: Number(process.env.AMQP_PORT ?? 5672),
  username: process.env.AMQP_USER ?? 'admin',
  password: process.env.AMQP_PASS ?? 'admin',
});

const sender = connection.open_sender('example-queue');

sender.on('sendable', () => {
  Array.from({ length: 3 }, (_, idx) => {
    const msg = {
      body: JSON.stringify({ orderId: `order-${idx}`, timestamp: new Date().toISOString() }),
      message_id: `msg-${idx}`,
    };
    console.log(`[producer] Sending message ${idx}...`);

    return sender.send(msg);
  });

  setTimeout(() => {
    console.log('[producer] Done sending. Closing connection.');
    connection.close();
  }, 1000);
});
