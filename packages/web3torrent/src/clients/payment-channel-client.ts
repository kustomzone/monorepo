import {utils, constants} from 'ethers';
import {ChannelClientInterface, ErrorCode} from '@statechannels/channel-client';
import {
  ChannelStatus,
  Message,
  Participant,
  ChannelResult,
  AllocationItem,
  Allocations
} from '@statechannels/client-api-schema';
import {SINGLE_ASSET_PAYMENT_CONTRACT_ADDRESS, HUB, FUNDING_STRATEGY} from '../constants';
import {AddressZero} from 'ethers/constants';
import 'firebase/database';
import {map, filter, first} from 'rxjs/operators';
import {logger as _logger} from '../logger';
import {concat, of, Observable} from 'rxjs';
import _ from 'lodash';

const logger = _logger.child({module: 'payment-channel-client'});
const hexZeroPad = utils.hexZeroPad;

const bigNumberify = utils.bigNumberify;
const FINAL_SETUP_STATE = utils.bigNumberify(3); // for a 2 party ForceMove channel
const APP_DATA = constants.HashZero; // unused in the SingleAssetPaymentApp

export interface Peer {
  signingAddress: string;
  outcomeAddress: string;
  balance: string;
}
export type Peers = {receiver: Peer; payer: Peer};

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
  receiver: Peer;
  payer: Peer;
}

export enum Index {
  Payer = 1,
  Receiver = 0
}

export const convertToChannelState = (channelResult: ChannelResult): ChannelState => {
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
    receiver: peer(
      participants[Index.Receiver].participantId,
      participants[Index.Receiver].destination,
      allocations[0].allocationItems[Index.Receiver].amount
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
const arrangePeers = ({receiver, payer}: Peers): [Peer, Peer] => {
  const peers: [Peer, Peer] = [undefined, undefined];
  peers[Index.Payer] = payer;
  peers[Index.Receiver] = receiver;

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

/**
 *
 * Returns true for channel states where, according to the payment channel client's mySigningAddress,
 * - the channel is still 'running'
 * - it's my turn to move
 */
const canUpdateChannel = (role: Index) => (state: ChannelState): boolean =>
  state.status === 'running' &&
  state.turnNum
    .add(1)
    .mod(2)
    .eq(role);

abstract class SingleChannelClient {
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
    this.channelClient.channelState.subscribe(
      state => (this.currentState = convertToChannelState(state))
    );
  }

  onMessageQueued(callback: (message: Message) => void) {
    return this.channelClient.onMessageQueued(callback);
  }

  onChannelUpdated(web3tCallback: (channelState: ChannelState) => any) {
    return this.channelClient.onChannelUpdated(cr => web3tCallback(convertToChannelState(cr)));
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

  channelState(channelId): Observable<ChannelState> {
    const newStates = this.channelClient.channelState.pipe(
      filter(cr => cr.channelId === channelId),
      map(convertToChannelState)
    );

    return this.currentState ? concat(of(this.currentState), newStates) : newStates;
  }

  async pushMessage(message: Message) {
    await this.channelClient.pushMessage(message);
  }
}

/**
 * This client allows the user to make payments in a single, unidirectional payment channel running on Nitro protocol
 * The payer joins the channel, and makes payments.
 */
export class PayingChannelClient extends SingleChannelClient {
  private canUpdateChannel = canUpdateChannel(Index.Payer);

  onChannelProposed(web3tCallback: (channelState: ChannelState) => any) {
    return this.channelClient.onChannelProposed(cr => web3tCallback(convertToChannelState(cr)));
  }

  async joinChannel() {
    return this.channelClient.joinChannel(this.channelId);
  }

  // payer may use this method to make payments (if they have sufficient funds)
  async makePayment(channelId: string, amount: string) {
    let amountWillPay = amount;
    // First, wait for my turn
    const {payer, receiver} = await this.channelState(channelId)
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
      await this.updateChannel({
        receiver: {...receiver, balance: add(receiver.balance, amountWillPay)},
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
}

/**
 * This client allows the user to receive payments in a single, unidirectional payment channel running on Nitro protocol
 * The receiver proposes the channel, and accepts payments
 */
export class ReceivingChannelClient extends SingleChannelClient {
  async createChannel(peers: Peers): Promise<any> {
    return this.channelClient.createChannel(
      formatParticipants(peers),
      formatAllocations(peers),
      SINGLE_ASSET_PAYMENT_CONTRACT_ADDRESS,
      APP_DATA,
      FUNDING_STRATEGY
    );
  }

  async acceptChannelUpdate(channelState: ChannelState) {
    const {receiver, payer} = channelState;
    await this.updateChannel({receiver, payer});
  }

  isPaymentToMe(channelState: ChannelState): boolean {
    // WARNING: doesn't guarantee that my balance increased
    if (channelState.receiver.signingAddress === this.mySigningAddress) {
      return channelState.status === 'running' && channelState.turnNum.mod(2).eq(1);
    }
    return false; // only receiver may receive payments
  }

  shouldSendSpacerState(channelState: ChannelState): boolean {
    return channelState.turnNum.eq(FINAL_SETUP_STATE);
  }
}
