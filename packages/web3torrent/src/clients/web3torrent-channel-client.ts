import {
  FakeChannelProvider,
  ChannelClient,
  ChannelClientInterface
} from '@statechannels/channel-client';
import {Message} from '@statechannels/client-api-schema';
import {DomainBudget} from '@statechannels/client-api-schema';
import {
  HUB,
  FIREBASE_PREFIX,
  fireBaseConfig,
  FUNDING_STRATEGY,
  INITIAL_BUDGET_AMOUNT
} from '../constants';
import * as firebase from 'firebase/app';
import 'firebase/database';
import {logger} from '../logger';
import _ from 'lodash';
import {PaymentChannelClient, ChannelState} from './payment-channel-client';

const log = logger.child({module: 'payment-channel-client'});

function sanitizeMessageForFirebase(message) {
  return JSON.parse(JSON.stringify(message));
}

// This class wraps the channel client converting the
// request/response formats to those used in the app

if (process.env.FAKE_CHANNEL_PROVIDER === 'true') {
  window.channelProvider = new FakeChannelProvider();
} else {
  // TODO: Replace with injection via other means than direct app import
  // NOTE: This adds `channelProvider` to the `Window` object
  require('@statechannels/channel-provider');
}

// This Client targets at _unidirectional_, single asset (ETH) payment channel with 2 participants running on Nitro protocol
// The recipient proposes the channel, but accepts payments
// The payer joins the channel, and makes payments
export class Web3torrentChannelClient {
  paymentChannels: PaymentChannelClient[];
  budgetCache?: DomainBudget;
  _enabled = false;
  get enabled(): boolean {
    return this._enabled;
  }
  get mySigningAddress(): string | undefined {
    return this.channelClient.signingAddress;
  }

  get myEthereumSelectedAddress(): string | undefined {
    return this.channelClient.selectedAddress;
  }

  constructor(readonly channelClient: ChannelClientInterface) {
    this.channelClient.onBudgetUpdated(budgetResult => (this.budgetCache = budgetResult));
  }

  async initialize() {
    await this.channelClient.provider.mountWalletComponent(process.env.WALLET_URL);
    await this.initializeHubComms();
  }

  async enable() {
    log.debug('enabling payment channel client');

    await this.channelClient.provider.enable();

    log.debug('payment channel client enabled');

    const doesBudgetExist = async () => {
      const budget = await this.getBudget();
      return !!budget && !_.isEmpty(budget);
    };

    if (FUNDING_STRATEGY !== 'Direct' && !(await doesBudgetExist())) {
      // TODO: This only checks if a budget exists, not if we have enough funds in it
      log.debug('Virtual Funding - Creating Budget');
      await this.createBudget(INITIAL_BUDGET_AMOUNT);
    }
    this._enabled = true;
  }

  private initializeHubComms() {
    if (!fireBaseConfig) {
      log.error('Abandoning firebase setup, configuration is undefined');
      return;
    }

    if (firebase.apps.length > 0) {
      log.warn('Firebase app already initialized');
    } else {
      // Hub messaging
      firebase.initializeApp(fireBaseConfig);
      const myFirebaseRef = firebase
        .database()
        .ref(`/${FIREBASE_PREFIX}/messages/${this.mySigningAddress}`);
      const hubFirebaseRef = firebase
        .database()
        .ref(`/${FIREBASE_PREFIX}/messages/${HUB.participantId}`);

      // firebase setup
      myFirebaseRef.onDisconnect().remove();

      this.onMessageQueued((message: Message) => {
        if (message.recipient === HUB.participantId) {
          hubFirebaseRef.push(sanitizeMessageForFirebase(message));
        }
      });

      myFirebaseRef.on('child_added', async snapshot => {
        const key = snapshot.key;
        const message = snapshot.val();
        myFirebaseRef.child(key).remove();
        log.debug({message}, 'GOT FROM FIREBASE: ');
        await this.pushMessage(message);
      });
    }
  }

  onMessageQueued(callback: (message: Message) => void) {
    return this.channelClient.onMessageQueued(callback);
  }

  /**
   *
   * Returns true for channel states where, according to the payment channel client's mySigningAddress,
   * - the channel is still 'running'
   * - it's my turn to move
   */
  async pushMessage(message: Message) {
    await this.channelClient.pushMessage(message);
  }

  async createBudget(amount: string) {
    try {
      this.budgetCache = await this.channelClient.approveBudgetAndFund(
        amount,
        amount,
        HUB.signingAddress,
        HUB.outcomeAddress
      );
    } catch (e) {
      if (e.message === 'User declined') {
        log.debug('User declined budget creation');
        return;
      } else {
        throw e;
      }
    }
  }

  async getChannels(): Promise<Record<string, ChannelState | undefined>> {
    // TODO
    return {};
  }

  async getBudget(): Promise<DomainBudget> {
    this.budgetCache = await this.channelClient.getBudget(HUB.signingAddress);
    return this.budgetCache;
  }

  async closeAndWithdraw(): Promise<DomainBudget | {}> {
    await this.channelClient.closeAndWithdraw(HUB.signingAddress, HUB.outcomeAddress);

    this.budgetCache = undefined;
    return this.budgetCache;
  }
}

export const web3torrentChannelClient = new Web3torrentChannelClient(
  new ChannelClient(window.channelProvider)
);
