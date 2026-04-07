# Examples

| # | Example | Broker needed | What it shows |
|---|---------|---------------|---------------|
| 01 | [Basic send/receive](./01-basic-send-receive.ts) | None (in-process) | Minimal setup, span creation |
| 02 | [Distributed trace](./02-distributed-trace/) | ActiveMQ (Docker) | Cross-process context propagation |
| 03 | [ActiveMQ Artemis](./03-activemq-artemis.ts) | Docker | Real broker compatibility |
| 04 | [Custom hooks](./04-custom-hooks.ts) | None (in-process) | Enriching spans with app data |
| 05 | [Express to AMQP](./05-express-to-amqp.ts) | None (in-process) | Full HTTP-to-AMQP distributed trace |
| 06 | [RabbitMQ](./06-rabbitmq.ts) | RabbitMQ (Docker) | RabbitMQ with AMQP 1.0 plugin |
| 07 | [Azure Service Bus](./07-azure-service-bus.ts) | Azure account | Real cloud broker, @azure/service-bus SDK |

## Prerequisites

```bash
npm install
npm run build
```

## 01 - Basic send/receive

No broker needed. Creates an in-process rhea server.

```bash
npx ts-node examples/01-basic-send-receive.ts
```

**Output**: 1 publish span + 1 consume span printed to console, linked by the same `traceId`.

## 02 - Distributed trace

Requires an AMQP 1.0 broker. Start ActiveMQ Artemis with Docker:

```bash
docker compose -f examples/docker-compose.yml up -d
```

Then in two terminals:

```bash
# Terminal 1 - Consumer
npx ts-node examples/02-distributed-trace/consumer.ts

# Terminal 2 - Producer
npx ts-node examples/02-distributed-trace/producer.ts
```

**Output**: Both processes print spans to console. Match `traceId` to verify propagation across processes.

## 03 - ActiveMQ Artemis

Start the broker:

```bash
docker compose -f examples/docker-compose.yml up -d
```

Run the example:

```bash
npx ts-node examples/03-activemq-artemis.ts
```

**Output**: Spans showing send/receive through a real AMQP 1.0 broker.

## 04 - Custom hooks

No broker needed.

```bash
npx ts-node examples/04-custom-hooks.ts
```

**Output**: Spans with custom attributes like `app.order_id`, `app.publisher`, `app.consumer_group`, `app.outcome`.

## 05 - Express to AMQP

No broker needed. Starts an HTTP server and in-process AMQP broker.

```bash
npx ts-node examples/05-express-to-amqp.ts
```

Then in another terminal:

```bash
curl -X POST http://localhost:3000/order \
  -H 'Content-Type: application/json' \
  -d '{"item":"Widget","qty":3}'
```

**Output**: A single trace spanning HTTP -> AMQP publish -> AMQP receive -> order processing.

```
HTTP POST /order
  └── orders-queue publish
      └── orders-queue process
          └── process-order
```

## 06 - RabbitMQ

Requires RabbitMQ with the AMQP 1.0 plugin enabled:

```bash
rabbitmq-plugins enable rabbitmq_amqp1_0
```

Run the example:

```bash
npx ts-node examples/06-rabbitmq.ts
```

**Output**: Spans showing send/receive through RabbitMQ using the AMQP 1.0 protocol.

## 07 - Azure Service Bus

Requires an Azure account with a Service Bus namespace (Standard tier).

Set environment variables:

```bash
export SERVICEBUS_CONNECTION_STRING="Endpoint=sb://your-namespace.servicebus.windows.net/;SharedAccessKeyName=RootManageSharedAccessKey;SharedAccessKey=..."
export SERVICEBUS_QUEUE_NAME="test-queue"
```

Run the example:

```bash
npx ts-node examples/07-azure-service-bus.ts
```

**Output**: Publish and consume spans for `test-queue`, plus internal `$cbs` authentication spans (normal for Azure Service Bus). The example filters and reports both types separately.

**Note**: Since `@azure/service-bus` manages AMQP connections internally, the consumer span will have a different `traceId` than the producer span. This is a known behavior of the Azure SDK's receive path. Context propagation works correctly when using `rhea` directly (see examples 01-06).
