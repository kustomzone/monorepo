import {Machine} from 'xstate';
import {PaymentChannelClient, ChannelState} from '../clients/payment-channel-client';
import {PaidStreamingExtension} from './paid-streaming-extension';
import {PaidStreamingExtensionEvents} from './types';
import {merge, fromEvent} from 'rxjs';

type Context = {
  paidStreamingExtension: PaidStreamingExtension;
  paymentChannelClient: PaymentChannelClient;
  channelState: ChannelState;
  channelId: string;
  uploaded: number;
  blockedRequests: [number, number, number][];
};

function buffer(ctx: Context): number {
  // TODO: Make the right calculation
  return ctx.paymentChannelClient.channelCache[ctx.channelId].turnNum.sub(ctx.uploaded).toNumber();
}

function requestWatcher(ctx: Context) {
  return fromEvent(ctx.paidStreamingExtension.messageBus, PaidStreamingExtensionEvents.REQUEST);
}

function channelWatcher(ctx: Context) {
  return ctx.paymentChannelClient.channelState;
}

function watcher(ctx: Context) {
  return merge(...[requestWatcher, channelWatcher].map(w => w(ctx)));
}

type Events =
  | {type: 'CHANNEL_OPEN'}
  | {type: 'PAYMENT'}
  | {type: 'CHANNEL_CLOSED'}
  | {type: 'CHANNEL_CLOSING'}
  | {type: 'REQUEST'}
  | {type: 'DONE'};

const wireMachine = Machine<Context, Events>({
  initial: 'setup',
  invoke: {src: 'watcher'},
  states: {
    setup: {invoke: {src: 'createPaymentChannel', onDone: 'uploading'}, exit: 'sendSpacerState'},
    uploading: {
      initial: 'unblocked',
      on: {DONE: 'refunding'},
      states: {
        unblocked: {
          entry: 'popFromBlockedRequests',
          on: {
            REQUEST: [
              {target: 'blocked', cond: 'insufficientFunds'},
              {target: 'unblocked', actions: 'upload'}
            ]
          }
        },
        blocked: {
          entry: 'blockPeer',
          on: {PAYMENT: {target: 'unblocked', cond: 'sufficientFunds'}}
        }
      }
    },
    refunding: {invoke: {src: 'refund', onDone: 'closing'}},
    closing: {invoke: {src: 'closeChannel', onDone: 'done'}},
    done: {type: 'final'}
  }
});

export {wireMachine};
