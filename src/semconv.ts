/**
 * Messaging semantic convention attribute constants.
 *
 * These are copied from @opentelemetry/semantic-conventions/incubating
 * because instrumentation libraries should not depend on the incubating
 * entry-point at runtime (it may have breaking changes in minor versions).
 *
 * @see https://opentelemetry.io/docs/specs/semconv/messaging/
 */

export const ATTR_MESSAGING_SYSTEM = 'messaging.system' as const;
export const ATTR_MESSAGING_OPERATION_NAME = 'messaging.operation.name' as const;
export const ATTR_MESSAGING_OPERATION_TYPE = 'messaging.operation.type' as const;
export const ATTR_MESSAGING_DESTINATION_NAME = 'messaging.destination.name' as const;
export const ATTR_MESSAGING_MESSAGE_ID = 'messaging.message.id' as const;
export const ATTR_MESSAGING_MESSAGE_CONVERSATION_ID = 'messaging.message.conversation_id' as const;
export const ATTR_MESSAGING_MESSAGE_BODY_SIZE = 'messaging.message.body.size' as const;
export const ATTR_MESSAGING_CLIENT_ID = 'messaging.client.id' as const;
