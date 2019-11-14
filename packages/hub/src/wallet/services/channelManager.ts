import {HUB_PRIVATE_KEY} from '../../constants';

import {SignedState, State} from '@statechannels/nitro-protocol';
import {signState} from '@statechannels/nitro-protocol/lib/src/signatures';
import {Signature} from 'ethers/utils';

export function isApplicationState(state: State): boolean {
  const isSetup: boolean = state.turnNum < state.channel.participants.length * 2;
  return !isSetup && !state.isFinal;
}

export function validSignature(commitment: State, signature: Signature): boolean {
  console.warn('Signature not validated');
  return commitment && signature && true;
  // return recover(toHex(commitment), signature) === mover(commitment);
}

export function formResponse(state: State): SignedState {
  return signState(state, HUB_PRIVATE_KEY);
}

export function nextState(theirState: State): State {
  if (isApplicationState(theirState)) {
    throw new Error('State has to be a prefund setup, postfund setup or final state');
  }

  const ourState = {...theirState, turnNum: theirState.turnNum + 1};
  return ourState;
}