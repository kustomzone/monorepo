import {
  ChannelProviderInterface,
  MethodResponseType,
  MethodRequestType,
  Method
} from '@statechannels/channel-provider';
import log = require('loglevel');

import EventEmitter, {ListenerFn} from 'eventemitter3';
import {
  BudgetRequest,
  CloseAndWithdrawParams,
  ChannelResult,
  CloseChannelParams,
  CreateChannelParams,
  GetStateParams,
  JoinChannelParams,
  Notification,
  PushMessageResult,
  SiteBudget,
  UpdateChannelParams
} from '@statechannels/client-api-schema';
import {Message} from '../../src/types';
import {calculateChannelId} from '../../src/utils';
import {Wallet, utils} from 'ethers';

const bigNumberify = utils.bigNumberify;

type ChannelId = string;

/*
 This fake provider becomes the stateful object which handles the calls
 coming from a non-fake `ChannelClient`.
 */
export class FakeChannelProvider implements ChannelProviderInterface {
  protected readonly events: EventEmitter<Method>;
  protected url = '';
  constructor() {
    this.events = new EventEmitter<Method>();
    this.events.emit = (method: Method, params: Request): boolean =>
      this.events.emit(method, params); // annotate the input parameters
  }

  playerIndex: Record<ChannelId, 0 | 1> = {};
  opponentIndex: Record<ChannelId, 0 | 1> = {};
  address?: string = Wallet.createRandom().address;
  opponentAddress: Record<ChannelId, string> = {};
  latestState: Record<ChannelId, ChannelResult> = {};

  async enable(url?: string): Promise<void> {
    this.url = url || '';
  }

  async send(request: MethodRequestType): Promise<MethodResponseType[MethodRequestType['method']]> {
    switch (request.method) {
      case 'CreateChannel':
        return this.createChannel(request.params);

      case 'PushMessage':
        return this.pushMessage(request.params);

      case 'GetEthereumSelectedAddress':
        return '0xEthereumSelectedAddress';

      case 'GetAddress':
        return this.getAddress();

      case 'JoinChannel':
        return this.joinChannel(request.params);

      case 'GetState':
        return this.getState(request.params);

      case 'UpdateChannel':
        return this.updateChannel(request.params);

      case 'CloseChannel':
        return this.closeChannel(request.params);

      case 'ApproveBudgetAndFund':
        return this.approveBudgetAndFund(request.params);

      case 'CloseAndWithdraw':
        return this.closeAndWithdraw(request.params);

      default:
        return Promise.reject(`No callback available for ${request.method}`);
    }
  }

  on(event: Method, callback: ListenerFn): void {
    this.events.on(event, callback);
  }

  off(event: Method): void {
    this.events.off(event);
  }

  subscribe(): Promise<string> {
    return Promise.resolve('success');
  }
  unsubscribe(): Promise<boolean> {
    return Promise.resolve(true);
  }

  setState(state: ChannelResult): void {
    this.latestState = {...this.latestState, [state.channelId]: state};
  }

  setAddress(address: string): void {
    this.address = address;
  }

  updatePlayerIndex(channelId: ChannelId, playerIndex: 0 | 1): void {
    if (this.playerIndex[channelId] === undefined) {
      this.playerIndex[channelId] = playerIndex;
      this.opponentIndex[channelId] = playerIndex == 1 ? 0 : 1;
    }
  }

  private async getAddress(): Promise<string> {
    if (this.address === undefined) {
      throw Error('No address has been set yet');
    }
    return this.address;
  }

  private getPlayerIndex(channelId: ChannelId): number {
    if (this.playerIndex === undefined) {
      throw Error(`This client does not have its player index set yet`);
    }
    return this.playerIndex[channelId];
  }

  public getOpponentIndex(channelId: ChannelId): number {
    if (this.opponentIndex[channelId] === undefined) {
      throw Error(`This client does not have its opponent player index set yet`);
    }
    return this.opponentIndex[channelId];
  }

  public verifyTurnNum(channelId: ChannelId, turnNum: string): Promise<void> {
    const currentTurnNum = bigNumberify(turnNum);
    if (currentTurnNum.mod(2).eq(this.getPlayerIndex(channelId))) {
      return Promise.reject(
        `Not your turn: currentTurnNum = ${currentTurnNum}, index = ${this.playerIndex[channelId]}`
      );
    }
    return Promise.resolve();
  }

  public findChannel(channelId: string): ChannelResult {
    if (!Object.keys(this.latestState).includes(channelId)) {
      throw Error(`Channel doesn't exist with channelId '${JSON.stringify(channelId, null, 4)}'`);
    }
    return this.latestState[channelId];
  }

  private async createChannel(params: CreateChannelParams): Promise<ChannelResult> {
    const participants = params.participants;
    const allocations = params.allocations;
    const appDefinition = params.appDefinition;
    const appData = params.appData;

    const channel: ChannelResult = {
      participants,
      allocations,
      appDefinition,
      appData,
      channelId: calculateChannelId(participants, appDefinition),
      turnNum: bigNumberify(0).toString(),
      status: 'proposed'
    };
    this.updatePlayerIndex(channel.channelId, 0);
    this.setState(channel);
    this.address = channel.participants[0].participantId;
    this.opponentAddress[channel.channelId] = channel.participants[1].participantId;
    this.notifyOpponent(channel, 'CreateChannel');

    return channel;
  }

  private async joinChannel(params: JoinChannelParams): Promise<ChannelResult> {
    const {channelId} = params;
    const latestState = this.findChannel(channelId);
    this.updatePlayerIndex(channelId, 1);
    log.debug(`Player ${this.getPlayerIndex(channelId)} joining channel ${channelId}`);
    await this.verifyTurnNum(channelId, latestState.turnNum);

    // skip funding by setting the channel to 'running' the moment it is joined
    // [assuming we're working with 2-participant channels for the time being]
    this.setState({
      ...latestState,
      turnNum: bigNumberify(3).toString(),
      status: 'running'
    });
    this.opponentAddress[channelId] = latestState.participants[0].participantId;
    this.notifyOpponent(this.latestState[channelId], 'joinChannel');

    return this.latestState[channelId];
  }

  private async getState({channelId}: GetStateParams): Promise<ChannelResult> {
    return this.findChannel(channelId);
  }

  private async updateChannel(params: UpdateChannelParams): Promise<ChannelResult> {
    const channelId = params.channelId;
    const participants = params.participants;
    const allocations = params.allocations;
    const appData = params.appData;

    log.debug(`Player ${this.getPlayerIndex(channelId)} updating channel ${channelId}`);
    const latestState = this.findChannel(channelId);

    const nextState = {...latestState, participants, allocations, appData};
    await this.verifyTurnNum(channelId, latestState.turnNum);
    nextState.turnNum = bigNumberify(latestState.turnNum)
      .add(1)
      .toString();
    log.debug(
      `Player ${this.getPlayerIndex(channelId)} updated channel to turnNum ${nextState.turnNum}`
    );

    this.setState(nextState);

    this.notifyOpponent(this.latestState[channelId], 'ChannelUpdate');
    return this.latestState[channelId];
  }

  private async closeChannel(params: CloseChannelParams): Promise<ChannelResult> {
    const latestState = this.findChannel(params.channelId);

    await this.verifyTurnNum(params.channelId, latestState.turnNum);
    const turnNum = bigNumberify(latestState.turnNum)
      .add(1)
      .toString();

    const status = 'closing';

    this.setState({...latestState, turnNum, status});
    log.debug(
      `Player ${this.getPlayerIndex(
        params.channelId
      )} updated channel to status ${status} on turnNum ${turnNum}`
    );
    this.notifyOpponent(this.latestState[params.channelId], 'ChannelUpdate');

    return this.latestState[params.channelId];
  }

  // TODO: Craft a full message
  protected notifyAppChannelUpdated(data: ChannelResult): void {
    const message: Notification = {
      jsonrpc: '2.0',
      method: 'ChannelUpdated',
      params: data
    };
    this.events.emit('ChannelUpdated', message);
  }
  protected notifyAppBudgetUpdated(data: SiteBudget): void {
    // TODO: Define budget type in the json-rpc types
    const message: Notification = {
      jsonrpc: '2.0',
      method: 'BudgetUpdated',
      params: data
    };
    this.events.emit('BudgetUpdated', message);
  }

  protected notifyOpponent(data: ChannelResult, notificationType: string): void {
    log.debug(
      `${this.getPlayerIndex(data.channelId)} notifying opponent ${this.getOpponentIndex(
        data.channelId
      )} about ${notificationType}`
    );
    const sender = this.address;
    const recipient: string = this.opponentAddress[data.channelId];

    if (!recipient) {
      throw Error(`Cannot notify opponent - opponent address not set`);
    }
    this.events.emit('MessageQueued', {sender, recipient, data});
  }

  private async pushMessage(params: Message<ChannelResult>): Promise<PushMessageResult> {
    this.setState(params.data);
    this.notifyAppChannelUpdated(this.latestState[params.data.channelId]);
    const channel: ChannelResult = params.data;
    const turnNum = bigNumberify(channel.turnNum)
      .add(1)
      .toString();
    switch (params.data.status) {
      case 'proposed':
        this.events.emit('ChannelProposed', {params: channel});
        break;
      // auto-close, if we received a close
      case 'closing':
        this.setState({...this.latestState[channel.channelId], turnNum, status: 'closed'});
        this.notifyOpponent(this.latestState[channel.channelId], 'ChannelUpdate');
        this.notifyAppChannelUpdated(this.latestState[channel.channelId]);
        break;
      default:
        break;
    }

    return {success: true};
  }

  private async approveBudgetAndFund(params: BudgetRequest): Promise<SiteBudget> {
    const {hub, site, playerAmount, hubAmount} = params;

    // TODO: Does this need to be delayed?
    const result = {
      hub: hub.signingAddress,
      site,
      budgets: [
        {
          token: '0x0',
          inUse: {playerAmount, hubAmount},
          free: {playerAmount, hubAmount},
          pending: {playerAmount, hubAmount},
          direct: {playerAmount, hubAmount}
        }
      ]
    };

    this.notifyAppBudgetUpdated(result);

    return result;
  }

  private async closeAndWithdraw(params: CloseAndWithdrawParams): Promise<ChannelResult> {
    const latestState = this.findChannel(params.channelId);

    await this.verifyTurnNum(params.channelId, latestState.turnNum);
    const turnNum = bigNumberify(latestState.turnNum)
      .add(1)
      .toString();

    const status = 'closing';

    this.setState({...latestState, turnNum, status});
    log.debug(
      `Player ${this.getPlayerIndex(
        params.channelId
      )} updated channel to status ${status} on turnNum ${turnNum}`
    );
    this.notifyOpponent(this.latestState[params.channelId], 'ChannelUpdate');

    return this.latestState[params.channelId];
  }
}
