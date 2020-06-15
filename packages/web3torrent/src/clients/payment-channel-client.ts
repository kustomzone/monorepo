import {utils, constants} from 'ethers';
import {
  FakeChannelProvider,
  ChannelClient,
  ChannelClientInterface,
  ErrorCode
} from '@statechannels/channel-client';
import {
  ChannelStatus,
  Message,
  Participant,
  ChannelResult,
  AllocationItem,
  Allocations
} from '@statechannels/client-api-schema';
import {DomainBudget} from '@statechannels/client-api-schema';
import {SINGLE_ASSET_PAYMENT_CONTRACT_ADDRESS, HUB, FUNDING_STRATEGY} from '../constants';
import {AddressZero} from 'ethers/constants';
import 'firebase/database';
import {map, filter, first, tap, take} from 'rxjs/operators';
import {logger} from '../logger';
import {concat, of, Observable} from 'rxjs';
import _ from 'lodash';

const log = logger.child({module: 'payment-channel-client'});
const hexZeroPad = utils.hexZeroPad;

const bigNumberify = utils.bigNumberify;
const FINAL_SETUP_STATE = utils.bigNumberify(3); // for a 2 party ForceMove channel
const APP_DATA = constants.HashZero; // unused in the SingleAssetPaymentApp

export interface Peer {
  signingAddress: string;
  outcomeAddress: string;
  balance: string;
}
export type Peers = {beneficiary: Peer; payer: Peer};

export const peer = (
  signingAddress: string,
  outcomeAddress: string,
  balance: string | number
): Peer => ({
  signingAddress,
  outcomeAddress,
  balance: utils.bigNumberify(balance).toHexString()
});
export interface ChannelState {
  channelId: string;
  turnNum: utils.BigNumber;
  status: ChannelStatus;
  challengeExpirationTime;
  beneficiary: Peer;
  payer: Peer;
}

enum Index {
  Payer = 1,
  Beneficiary = 0
}

const convertToChannelState = (channelResult: ChannelResult): ChannelState => {
  const {
    turnNum,
    channelId,
    participants,
    allocations,
    challengeExpirationTime,
    status
  } = channelResult;

  return {
    channelId,
    turnNum: utils.bigNumberify(turnNum),
    status,
    challengeExpirationTime,
    beneficiary: peer(
      participants[Index.Beneficiary].participantId,
      participants[Index.Beneficiary].destination,
      allocations[0].allocationItems[Index.Beneficiary].amount
    ),
    payer: peer(
      participants[Index.Payer].participantId,
      participants[Index.Payer].destination,
      allocations[0].allocationItems[Index.Payer].amount
    )
  };
};

/**
 *
 * @param peers: Peers
 * Arranges peers in order, as determined by the Index enum.
 */
const arrangePeers = ({beneficiary, payer}: Peers): [Peer, Peer] => {
  const peers: [Peer, Peer] = [undefined, undefined];
  peers[Index.Payer] = payer;
  peers[Index.Beneficiary] = beneficiary;

  return peers;
};

const formatParticipant = ({signingAddress, outcomeAddress}: Peer): Participant => ({
  participantId: signingAddress,
  signingAddress,
  destination: outcomeAddress
});
const formatParticipants = (peers: Peers) => arrangePeers(peers).map(formatParticipant);

const formatItem = (p: Peer): AllocationItem => ({
  amount: hexZeroPad(bigNumberify(p.balance).toHexString(), 32),
  destination: p.outcomeAddress
});
const formatAllocations = (peers: Peers): Allocations => [
  {token: AddressZero, allocationItems: arrangePeers(peers).map(formatItem)}
];

const subtract = (a: string, b: string) =>
  hexZeroPad(
    bigNumberify(a)
      .sub(bigNumberify(b))
      .toHexString(),
    32
  );

const add = (a: string, b: string) =>
  hexZeroPad(
    bigNumberify(a)
      .add(bigNumberify(b))
      .toHexString(),
    32
  );

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
// The beneficiary proposes the channel, but accepts payments
// The payer joins the channel, and makes payments
export class PaymentChannelClient {
  get mySigningAddress(): string | undefined {
    return this.channelClient.signingAddress;
  }

  get myEthereumSelectedAddress(): string | undefined {
    return this.channelClient.selectedAddress;
  }

  constructor(
    readonly channelClient: ChannelClientInterface,
    public readonly channelId: string,
    public currentState: ChannelState | undefined = undefined
  ) {
    this.channelStates.subscribe(state => (this.currentState = state));
  }

  async createChannel(peers: Peers): Promise<any> {
    return this.channelClient.createChannel(
      formatParticipants(peers),
      formatAllocations(peers),
      SINGLE_ASSET_PAYMENT_CONTRACT_ADDRESS,
      APP_DATA,
      FUNDING_STRATEGY
    );
  }

  onMessageQueued(callback: (message: Message) => void) {
    return this.channelClient.onMessageQueued(callback);
  }

  // Accepts an payment-channel-friendly callback, performs the necessary encoding, and subscribes to the channelClient with an appropriate, API-compliant callback
  onChannelUpdated(web3tCallback: (channelState: ChannelState) => any) {
    return this.channelClient.onChannelUpdated(cr => web3tCallback(convertToChannelState(cr)));
  }

  onChannelProposed(web3tCallback: (channelState: ChannelState) => any) {
    return this.channelClient.onChannelProposed(cr => web3tCallback(convertToChannelState(cr)));
  }

  async joinChannel() {
    return this.channelClient.joinChannel(this.channelId);
  }

  async closeChannel(): Promise<ChannelState> {
    return this.currentState;
  }

  async challengeChannel(): Promise<ChannelState> {
    return this.channelClient.challengeChannel(this.channelId).then(convertToChannelState);
  }

  async updateChannel(peers: Peers): Promise<ChannelState> {
    return this.channelClient
      .updateChannel(this.channelId, formatParticipants(peers), formatAllocations(peers), APP_DATA)
      .then(convertToChannelState);
  }

  /**
   *
   * Returns true for channel states where, according to the payment channel client's mySigningAddress,
   * - the channel is still 'running'
   * - it's my turn to move
   */
  private canUpdateChannel(state: ChannelState): boolean {
    const {payer, beneficiary} = state;
    let myRole: Index;
    if (payer.signingAddress === this.mySigningAddress) myRole = Index.Payer;
    else if (beneficiary.signingAddress === this.mySigningAddress) myRole = Index.Beneficiary;
    else throw 'Not in channel';

    return (
      state.status === 'running' &&
      state.turnNum
        .add(1)
        .mod(2)
        .eq(myRole)
    );
  }

  get channelStates() {
    return this.channelClient.channelState.pipe(map(convertToChannelState));
  }

  channelState(channelId): Observable<ChannelState> {
    const newStates = this.channelClient.channelState.pipe(
      filter(cr => cr.channelId === channelId),
      map(convertToChannelState)
    );

    return this.currentState ? concat(of(this.currentState), newStates) : newStates;
  }

  // payer may use this method to make payments (if they have sufficient funds)
  async makePayment(channelId: string, amount: string) {
    let amountWillPay = amount;
    // First, wait for my turn
    const {payer, beneficiary} = await this.channelState(channelId)
      .pipe(first(cs => this.canUpdateChannel(cs)))
      .toPromise();

    if (bigNumberify(payer.balance).eq(0)) {
      logger.error('Out of funds. Closing channel.');
      await this.closeChannel();
      return;
    }

    if (bigNumberify(payer.balance).lt(amount)) {
      amountWillPay = payer.balance;
      logger.debug({amountAskedToPay: amount, amountWillPay}, 'Paying less than PEER_TRUST');
    }

    try {
      await this.updateChannel(channelId, {
        beneficiary: {...beneficiary, balance: add(beneficiary.balance, amountWillPay)},
        payer: {...payer, balance: subtract(payer.balance, amountWillPay)}
      });
    } catch (error) {
      if (error.error.code === ErrorCode.UpdateChannel.NotYourTurn) {
        logger.warn({channelId}, 'Possible race condition detected');
      } else {
        logger.error({error}, 'makePayment: Unexpected error');
      }
    }
  }

  // beneficiary may use this method to accept payments
  async acceptChannelUpdate(channelState: ChannelState) {
    const {channelId, beneficiary, payer} = channelState;
    await this.updateChannel(channelId, {beneficiary, payer});
  }

  amProposer(channelIdOrChannelState: string | ChannelState): boolean {
    if (typeof channelIdOrChannelState === 'string') {
      return this.currentState?.beneficiary.signingAddress === this.mySigningAddress;
    } else {
      return channelIdOrChannelState.beneficiary.signingAddress === this.mySigningAddress;
    }
  }

  isPaymentToMe(channelState: ChannelState): boolean {
    // doesn't guarantee that my balance increased
    if (channelState.beneficiary.signingAddress === this.mySigningAddress) {
      return channelState.status === 'running' && channelState.turnNum.mod(2).eq(1);
    }
    return false; // only beneficiary may receive payments
  }

  shouldSendSpacerState(channelState: ChannelState): boolean {
    return this.amProposer(channelState) && channelState.turnNum.eq(FINAL_SETUP_STATE);
  }

  async pushMessage(message: Message) {
    await this.channelClient.pushMessage(message);
  }
}
