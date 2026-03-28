# opentelemetry-instrumentation-rhea

[![npm version](https://img.shields.io/npm/v/opentelemetry-instrumentation-rhea.svg)](https://www.npmjs.com/package/opentelemetry-instrumentation-rhea)
[![License](https://img.shields.io/badge/license-Apache--2.0-blue.svg)](LICENSE)

OpenTelemetry instrumentation for [rhea](https://github.com/amqp/rhea) (AMQP 1.0).

## Why

rhea is a widely used AMQP 1.0 client for Node.js and the underlying AMQP client used by `rhea-promise`, which is used by Azure SDK packages such as `@azure/event-hubs` and `@azure/service-bus`. OpenTelemetry provides instrumentation for AMQP 0-9-1 (amqplib/RabbitMQ), but lacks official support for AMQP 1.0. This package aims to fill that gap.

## Install

```bash
npm install opentelemetry-instrumentation-rhea
```

## Usage

```typescript
import { NodeTracerProvider } from '@opentelemetry/sdk-trace-node';
import { registerInstrumentations } from '@opentelemetry/instrumentation';
import { RheaInstrumentation } from 'opentelemetry-instrumentation-rhea';

const provider = new NodeTracerProvider();
provider.register();

registerInstrumentations({
  instrumentations: [new RheaInstrumentation()],
});

// Now use rhea as usual - spans are created automatically
import rhea from 'rhea';
```

## Configuration

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `enabled` | `boolean` | `true` | Enable/disable the instrumentation |
| `publishHook` | `(span, info) => void` | - | Called before a publish span ends. Use to add custom attributes. |
| `consumeHook` | `(span, info) => void` | - | Called when a message is consumed, before the user handler runs. |
| `consumeEndHook` | `(span, info) => void` | - | Called when a consume span ends. |
| `useLinksForConsume` | `boolean` | `false` | If `true`, consumer spans are new root traces with a link to the producer span, instead of being children. |

### Hook info objects

**`RheaPublishInfo`**: `{ moduleExports, msg, sender, connection }`

**`RheaConsumeInfo`**: `{ moduleExports, msg, receiver, delivery, connection }`

## Semantic conventions

Follows [OpenTelemetry Messaging Semantic Conventions](https://opentelemetry.io/docs/specs/semconv/messaging/).

### Span names

- Publish: `<destination> publish`
- Consume: `<destination> receive`

### Attributes

| Attribute | Value |
|-----------|-------|
| `messaging.system` | `amqp` |
| `messaging.operation.name` | `publish` or `receive` |
| `messaging.operation.type` | `publish` or `receive` |
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

## Supported versions

- rhea: `>=1.0.0 <4`
- Node.js: `>=18.0.0`
- @opentelemetry/api: `^1.0.0`

## Examples

See the [examples/](examples/) folder for complete working examples.

## License

Apache-2.0
