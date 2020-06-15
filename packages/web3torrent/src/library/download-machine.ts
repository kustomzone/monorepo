import {Machine} from 'xstate';
import {PaymentChannelClient} from '../clients/payment-channel-client';
import {PaidStreamingExtension} from './paid-streaming-extension';
import {PaidStreamingExtensionEvents} from './types';
import {merge, fromEvent} from 'rxjs';

type Context = {
  paidStreamingExtension: PaidStreamingExtension;
  paymentChannelClient: PaymentChannelClient;
  uploaded: number;
  blockedRequests: [number, number, number][];
};

function buffer(ctx: Context): number {
  // TODO
  return ctx.paymentChannelClient.channelCache['ctx.channelId'].turnNum
    .sub(ctx.uploaded)
    .toNumber();
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
  | {type: 'PAYMENT_RECEIPT'}
  | {type: 'CHANNEL_CLOSED'}
  | {type: 'CHANNEL_CLOSING'}
  | {type: 'DONE'};

const wireMachine = Machine<Context, Events>({
  initial: 'setup',
  invoke: {src: 'watcher'},
  states: {
    setup: {invoke: {src: 'waitForPaymentChannel', onDone: 'downloading'}, exit: 'sendPayment'},
    downloading: {
      initial: 'default',
      on: {DONE: 'requestRefund'},
      states: {
        idle: {
          entry: 'makeRequest',
          on: {}
        },
        makingPayment: {
          entry: 'makePaymentt',
          on: {PAYMENT_RECEIPT: {target: 'idle', cond: 'sufficientFunds'}}
        }
      }
    },
    refunding: {invoke: {src: 'refund', onDone: 'closing'}},
    closing: {invoke: {src: 'closeChannel', onDone: 'done'}},
    done: {type: 'final'}
  }
});

export {wireMachine};
