# Changelog

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
