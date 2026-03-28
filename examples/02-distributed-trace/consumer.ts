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

const receiver = connection.open_receiver('example-queue');

receiver.on('message', (eventContext: any) => {
  console.log(`[consumer] Received: ${JSON.stringify(eventContext.message.body)}`);
  console.log(
    `[consumer] application_properties:`,
    JSON.stringify(eventContext.message.application_properties)
  );
});

console.log('[consumer] Waiting for messages on "example-queue"...');
console.log('[consumer] Press Ctrl+C to stop.');
