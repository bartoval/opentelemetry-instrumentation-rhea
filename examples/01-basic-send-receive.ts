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

const container = rhea.create_container();
const server = container.listen({ port: 0 });

server.on('listening', () => {
  const port = (server.address() as any).port;
  console.log(`[server] Listening on port ${port}`);

  container.on('message', (eventContext: any) => {
    console.log(`[receiver] Got message: ${eventContext.message.body}`);

    setTimeout(() => {
      console.log('\nDone! Check the spans above.');
      connection.close();
      server.close();
    }, 500);
  });

  const connection = container.connect({ port, host: 'localhost' });
  const sender = connection.open_sender('example-queue');

  sender.on('sendable', () => {
    console.log('[sender] Sending message...');
    sender.send({ body: 'Hello from OpenTelemetry!' });
  });
});
