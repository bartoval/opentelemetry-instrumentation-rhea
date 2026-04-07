# opentelemetry-instrumentation-rhea

[![npm version](https://img.shields.io/npm/v/opentelemetry-instrumentation-rhea.svg)](https://www.npmjs.com/package/opentelemetry-instrumentation-rhea)
[![npm downloads](https://img.shields.io/npm/dm/opentelemetry-instrumentation-rhea)](https://www.npmjs.com/package/opentelemetry-instrumentation-rhea)
[![License](https://img.shields.io/badge/license-Apache--2.0-blue.svg)](LICENSE)

OpenTelemetry instrumentation for [rhea](https://github.com/amqp/rhea) (AMQP 1.0).

## Why not amqplib instrumentation?

Existing OpenTelemetry instrumentation (`@opentelemetry/instrumentation-amqplib`) targets AMQP 0-9-1 (RabbitMQ via amqplib). This package focuses on **AMQP 1.0**, used by systems like Azure Service Bus, Azure Event Hubs, ActiveMQ Artemis, and Solace.

## Install

```bash
npm install opentelemetry-instrumentation-rhea
```

## Usage

Register the instrumentation **before** importing rhea. This is the standard OpenTelemetry pattern: the instrumentation must be registered before the target library is imported so it can hook into it.

```typescript
// tracing.ts
import { NodeTracerProvider } from '@opentelemetry/sdk-trace-node';
import { registerInstrumentations } from '@opentelemetry/instrumentation';
import { RheaInstrumentation } from 'opentelemetry-instrumentation-rhea';

const provider = new NodeTracerProvider();
provider.register();

registerInstrumentations({
  instrumentations: [new RheaInstrumentation()],
});
```

```typescript
// app.ts
import './tracing';
import rhea from 'rhea';

// Use rhea as usual - spans are created automatically
```

### Example with Azure Service Bus

Since `@azure/service-bus` uses rhea internally, traces are created automatically:

```typescript
import './tracing';
import { ServiceBusClient } from '@azure/service-bus';

const client = new ServiceBusClient(connectionString);
const sender = client.createSender('my-queue');

await sender.sendMessages({ body: 'hello' });
// -> traced automatically
```

### Example with rhea directly

```typescript
import './tracing';
import rhea from 'rhea';

const container = rhea.create_container();
const connection = container.connect({ host: 'localhost', port: 5672 });
const sender = connection.open_sender('my-queue');

sender.on('sendable', () => {
  sender.send({ body: 'hello' });
  // -> creates a "my-queue publish" span with context propagation
});
```

## Configuration

| Option | Type | Default | Description |
| --- | --- | --- | --- |
| `enabled` | `boolean` | `true` | Enable/disable the instrumentation |
| `publishHook` | `(span, info) => void` | - | Called before a publish span ends. Use to add custom attributes. |
| `consumeHook` | `(span, info) => void` | - | Called when a message is consumed, before the user handler runs. |
| `consumeEndHook` | `(span, info) => void` | - | Called when a consume span ends. |
| `useLinksForConsume` | `boolean` | `true` | If `true` (default), consumer spans are new root traces with a link to the producer span. Set to `false` for parent-child behavior. |

### Hook info objects

**`RheaPublishInfo`**: `{ msg, sender, connection }`

**`RheaConsumeInfo`**: `{ msg, receiver, delivery, connection }`

## Semantic conventions

This package implements [OpenTelemetry Messaging Semantic Conventions v1.29.0](https://opentelemetry.io/docs/specs/semconv/messaging/).

> **Note:** Messaging semantic conventions are currently in **Development** status. When they are stabilized, this package will implement the `OTEL_SEMCONV_STABILITY_OPT_IN` migration path.

### Span names

- Publish: `<destination> publish`
- Consume: `<destination> process`

### Attributes

| Attribute | Value |
| --- | --- |
| `messaging.system` | `amqp` |
| `messaging.operation.name` | `publish` or `process` |
| `messaging.operation.type` | `publish` or `process` |
| `messaging.destination.name` | Target/source address |
| `messaging.message.id` | `message.message_id` (if present) |
| `messaging.message.conversation_id` | `message.correlation_id` (if present) |
| `messaging.message.body.size` | Payload size in bytes |
| `network.peer.address` | Connection host |
| `network.peer.port` | Connection port |
| `messaging.client.id` | Container ID |

## Context propagation

Trace context is propagated via AMQP 1.0 `message.application_properties` using the W3C Trace Context format (`traceparent`/`tracestate`).

## Compatibility

This instrumentation hooks into `rhea` at runtime, so any library built on top of it is automatically instrumented:

- **rhea** — direct usage
- **rhea-promise** — the async/await wrapper around rhea
- **Azure SDK** (`@azure/event-hubs`, `@azure/service-bus`) — which uses rhea-promise internally

Compatible with Azure Service Bus, Azure Event Hubs, ActiveMQ Artemis, Solace, and other AMQP 1.0-compliant brokers.

### Note on Azure Service Bus internal spans

When used with Azure Service Bus, you may see additional spans for the `$cbs` AMQP link. This is the internal authentication mechanism used by the Azure SDK to exchange SAS tokens. These spans are legitimate AMQP operations instrumented by this package.

To filter them out in your application, use the `publishHook` and `consumeHook`:

```typescript
new RheaInstrumentation({
  publishHook: (span, { sender }) => {
    if (sender.target?.address?.startsWith('$')) {
      span.setAttribute('messaging.azure.internal', true);
    }
  },
  consumeHook: (span, { receiver }) => {
    if (receiver.source?.address?.startsWith('$')) {
      span.setAttribute('messaging.azure.internal', true);
    }
  },
});
```

## Supported versions

- rhea: `>=1.0.0 <4` (tested with v3.x)
- Node.js: `^18.19.0 || >=20.6.0`
- @opentelemetry/api: `^1.0.0`

## Examples

See the [examples/](examples/) folder for complete working examples.

## License

Apache-2.0
