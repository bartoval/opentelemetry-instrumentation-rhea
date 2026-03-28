import { NodeTracerProvider } from '@opentelemetry/sdk-trace-node';
import { SimpleSpanProcessor, ConsoleSpanExporter } from '@opentelemetry/sdk-trace-base';
import { HttpInstrumentation } from '@opentelemetry/instrumentation-http';
import { RheaInstrumentation } from '../src';
import { trace } from '@opentelemetry/api';

const httpInstrumentation = new HttpInstrumentation();
const rheaInstrumentation = new RheaInstrumentation();
httpInstrumentation.enable();
rheaInstrumentation.enable();

// eslint-disable-next-line @typescript-eslint/no-var-requires
const rhea = require('rhea');
// eslint-disable-next-line @typescript-eslint/no-var-requires
const express = require('express');

const provider = new NodeTracerProvider({
  spanProcessors: [new SimpleSpanProcessor(new ConsoleSpanExporter())],
});
provider.register();
httpInstrumentation.setTracerProvider(provider);
rheaInstrumentation.setTracerProvider(provider);

const tracer = trace.getTracer('express-to-amqp-example');

const container = rhea.create_container();
const amqpServer = container.listen({ port: 0 });

amqpServer.on('listening', () => {
  const amqpPort = (amqpServer.address() as any).port;
  console.log(`[amqp] In-process broker on port ${amqpPort}`);

  container.on('message', (eventContext: any) => {
    const body = eventContext.message.body;
    console.log(`[worker] Processing order: ${body}`);

    const processSpan = tracer.startSpan('process-order');
    processSpan.setAttribute('app.order', body);
    processSpan.end();
  });

  const app = express();
  app.use(express.json());

  const connection = container.connect({ port: amqpPort, host: 'localhost' });
  const sender = connection.open_sender('orders-queue');

  let senderReady = false;
  sender.on('sendable', () => {
    senderReady = true;
  });

  app.post('/order', (req: any, res: any) => {
    if (!senderReady) {
      res.status(503).json({ error: 'AMQP sender not ready' });
      return;
    }

    const orderId = `ORD-${Date.now()}`;
    console.log(`[http] Received order request, id: ${orderId}`);

    sender.send({
      body: JSON.stringify({ orderId, ...req.body }),
      message_id: orderId,
    });

    res.json({ orderId, status: 'queued' });
  });

  const httpPort = 3000;
  app.listen(httpPort, () => {
    console.log(`\n[http] Express server listening on http://localhost:${httpPort}`);
    console.log(`\nTry: curl -X POST http://localhost:${httpPort}/order -H 'Content-Type: application/json' -d '{"item":"Widget","qty":3}'`);
    console.log('\nThe trace will flow: HTTP POST /order -> orders-queue publish -> orders-queue receive -> process-order');
  });
});
