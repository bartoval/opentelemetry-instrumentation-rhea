import type { Sender, EventContext } from 'rhea';

export type DispatchFunction = (name: string, eventContext?: EventContext) => boolean;

export interface RheaLinkModule {
  Sender: {
    prototype: Pick<Sender, 'send'>;
  };
  Receiver: {
    prototype: {
      dispatch: DispatchFunction;
    };
  };
}
