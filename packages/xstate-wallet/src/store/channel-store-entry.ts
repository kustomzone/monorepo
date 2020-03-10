import {ChannelConstants, StateVariables, State} from './types';
import {Funding} from './memory-store';
export interface ChannelStoreEntry {
  readonly channelId: string;
  readonly myIndex: number;
  readonly latest: StateVariables;
  readonly supported: StateVariables | undefined;
  readonly latestSupportedByMe: StateVariables | undefined;
  readonly latestState: State;
  readonly supportedState: State;
  readonly latestStateSupportedByMe: State;
  readonly channelConstants: ChannelConstants;
  readonly funding?: Funding;
  readonly states: State[];
}
