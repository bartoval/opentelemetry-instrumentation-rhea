import { NodeTracerProvider } from '@opentelemetry/sdk-trace-node';
import { SimpleSpanProcessor, ConsoleSpanExporter } from '@opentelemetry/sdk-trace-base';
import { RheaInstrumentation } from '../src';

const instrumentation = new RheaInstrumentation();
instrumentation.enable();

// eslint-disable-next-line @typescript-eslint/no-var-requires
const rhea = require('rhea');

const provider = new NodeTracerProvider({
  spanProcessors: [new SimpleSpanProcessor(new ConsoleSpanExporter())],
});
provider.register();
instrumentation.setTracerProvider(provider);

const host = process.env.RABBITMQ_HOST ?? 'localhost';
const port = Number(process.env.RABBITMQ_PORT ?? 5672);
const username = process.env.RABBITMQ_USER ?? 'guest';
const password = process.env.RABBITMQ_PASS ?? 'guest';
const queueName = '/queue/example-queue';

const container = rhea.create_container();

const connection = container.connect({ host, port, username, password });
console.log(`Connecting to RabbitMQ (AMQP 1.0) at ${host}:${port}...`);

const receiver = connection.open_receiver(queueName);
const sender = connection.open_sender(queueName);

receiver.on('message', (eventContext: any) => {
  console.log(`[receiver] Got: ${eventContext.message.body}`);
  console.log(
    `[receiver] application_properties:`,
    JSON.stringify(eventContext.message.application_properties)
  );

  setTimeout(() => {
    connection.close();
    console.log('Done!');
  }, 1000);
});

sender.on('sendable', () => {
  console.log(`[sender] Sending to "${queueName}"...`);
  sender.send({
    body: JSON.stringify({ event: 'rabbitmq-test', timestamp: new Date().toISOString() }),
    message_id: `rabbitmq-${Date.now()}`,
  });
});
