# Changelog

## 1.0.0

### Improvements

- Use semantic convention constants instead of hardcoded attribute strings
- Add local `semconv.ts` with messaging attribute constants (copied from incubating per OTel guidelines)
- Import stable `ATTR_NETWORK_PEER_ADDRESS` and `ATTR_NETWORK_PEER_PORT` from `@opentelemetry/semantic-conventions`
- Add diagnostic logging to patch/unpatch methods for troubleshooting
- Declare Messaging Semantic Conventions v1.29.0 compliance in README
- Add note about `OTEL_SEMCONV_STABILITY_OPT_IN` migration path
- Add Azure Service Bus example with `@azure/service-bus`
- Document `$cbs` internal authentication spans and how to filter them
- Align `package.json` description with OTel contrib guidelines

## 0.2.0

### Breaking changes

- Remove `moduleExports` from `RheaPublishInfo` and `RheaConsumeInfo` hook interfaces to prevent internal type leak

### Improvements

- Move internal types (`RheaLinkModule`, `DispatchFunction`) to `internal-types.ts` per OTel guidelines
- Add RabbitMQ AMQP 1.0 example
- Improve README with real usage examples (Azure Service Bus, rhea direct)
- Add "Why not amqplib" section to README
- Improve npm discoverability with better keywords and description
- Add npm downloads badge
- Auto-generate `version.ts` from `package.json` at build time

## 0.1.1

- Fix `package.json` resolution when installed as npm dependency

## 0.1.0

- Initial release
- Auto-instrumentation for `rhea` AMQP 1.0 client
- Publish (PRODUCER) and consume (CONSUMER) span creation
- W3C Trace Context propagation via `application_properties`
- `publishHook`, `consumeHook`, `consumeEndHook` for custom span enrichment
- `useLinksForConsume` option for link-based consumer span creation
- Supports rhea `>=1.0.0 <4`
