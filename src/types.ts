import type { InstrumentationConfig } from '@opentelemetry/instrumentation';
import type { Span } from '@opentelemetry/api';
import type { Sender, Receiver, Connection, Message, Delivery } from 'rhea';
import type { RheaLinkModule } from './internal-types';

export interface RheaPublishInfo {
  moduleExports: RheaLinkModule;
  msg: Message;
  sender: Sender;
  connection: Connection;
}

export interface RheaConsumeInfo {
  moduleExports: RheaLinkModule;
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
