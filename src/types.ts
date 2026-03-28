import type { InstrumentationConfig } from '@opentelemetry/instrumentation';
import type { Span } from '@opentelemetry/api';
import type { Sender, Receiver, Connection, Message, Delivery } from 'rhea';

export interface RheaPublishInfo {
  msg: Message;
  sender: Sender;
  connection: Connection;
}

export interface RheaConsumeInfo {
  msg: Message;
  receiver: Receiver;
  delivery?: Delivery;
  connection: Connection;
}

export interface RheaInstrumentationConfig extends InstrumentationConfig {
  publishHook?: (span: Span, info: RheaPublishInfo) => void;
  consumeHook?: (span: Span, info: RheaConsumeInfo) => void;
  consumeEndHook?: (span: Span, info: RheaConsumeInfo) => void;
  useLinksForConsume?: boolean;
}
