import type { InstrumentationConfig } from '@opentelemetry/instrumentation';
import type { Span } from '@opentelemetry/api';

export interface RheaPublishInfo {
  msg: Record<string, unknown>;
  sender: Record<string, unknown>;
  connection: Record<string, unknown>;
}

export interface RheaConsumeInfo {
  msg: Record<string, unknown>;
  receiver: Record<string, unknown>;
  delivery?: Record<string, unknown>;
  connection: Record<string, unknown>;
}

export interface RheaInstrumentationConfig extends InstrumentationConfig {
  publishHook?: (span: Span, info: RheaPublishInfo) => void;
  consumeHook?: (span: Span, info: RheaConsumeInfo) => void;
  consumeEndHook?: (span: Span, info: RheaConsumeInfo) => void;

  /**
   * `true` (default): consumer spans link to producer. `false`: parent-child.
   * @default true
   */
  useLinksForConsume?: boolean;
}
