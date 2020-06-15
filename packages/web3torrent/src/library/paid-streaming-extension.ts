import bencode from 'bencode';
import {Extension} from 'bittorrent-protocol';
import {logger} from '../logger';
import EventEmitter from 'eventemitter3';
import {
  ExtendedHandshake,
  PaidStreamingExtensionEvents,
  PaidStreamingExtensionNotices,
  PaidStreamingWire
} from './types';

const log = logger.child({module: 'paid-streaming-extension'});

export abstract class PaidStreamingExtension implements Extension {
  private _isPaidStreamingExtension = true;

  constructor(
    public readonly wire: PaidStreamingWire,
    protected pseAccount: string,
    protected pseOutcomeAddress: string,
    public readonly messageBus = new EventEmitter()
  ) {
    this.wire.extendedHandshake.pseAccount = new Buffer(pseAccount);
    this.wire.extendedHandshake.outcomeAddress = new Buffer(pseOutcomeAddress);
    this.addLogs();
  }

  get name(): 'paidStreamingExtension' {
    return 'paidStreamingExtension';
  }

  peerAccount?: string;
  peerOutcomeAddress?: string;

  // channel that another peer uses to pay me.
  seedingChannelId: string;
  // channel that I use to pay another peer.
  leechingChannelId: string;

  on(event: PaidStreamingExtensionEvents, callback: EventEmitter.ListenerFn<any[]>) {
    this.messageBus.on(event, callback);
  }

  once(event: PaidStreamingExtensionEvents, callback: EventEmitter.ListenerFn<any[]>) {
    this.messageBus.once(event, callback);
  }

  onHandshake(/* infoHash, peerId, extensions */) {}

  onExtendedHandshake(handshake: ExtendedHandshake) {
    if (!handshake.m || !handshake.m[this.name]) {
      log.warn('WARNING: Peer does not support Web3Torrent');
      return this.messageBus.emit(
        PaidStreamingExtensionEvents.WARNING,
        new Error('!>Peer does not support Web3Torrent')
      );
    }

    this.peerAccount = handshake.pseAccount.toString();
    this.peerOutcomeAddress = handshake.outcomeAddress.toString();

    this.messageBus.emit(PaidStreamingExtensionEvents.PSE_HANDSHAKE, {
      pseAccount: this.peerAccount,
      peerOutcomeAddress: this.peerOutcomeAddress
    });

    return true;
  }

  stop() {
    this.executeExtensionCommand(PaidStreamingExtensionNotices.STOP, this.seedingChannelId);
  }

  start() {
    this.executeExtensionCommand(PaidStreamingExtensionNotices.START);
  }

  ack() {
    this.executeExtensionCommand(PaidStreamingExtensionNotices.ACK);
  }

  sendMessage(message: string) {
    this.executeExtensionCommand(PaidStreamingExtensionNotices.MESSAGE, {
      message
    });
  }

  onMessage(buffer: Buffer) {
    try {
      const jsonData = bencode.decode(buffer, undefined, undefined, 'utf8');
      this.messageHandler(jsonData);
    } catch (err) {
      log.error(err, 'onMessage decoding or handling');
      return;
    }
  }

  protected messageHandler({command, data}) {
    switch (command) {
      case PaidStreamingExtensionNotices.ACK:
        return;
      case PaidStreamingExtensionNotices.MESSAGE:
        data = JSON.parse(data.message);
        if (data.recipient !== this.pseAccount) return;

        log.info({data}, `MESSAGE received from ${this.peerAccount}`);
        this.ack();
        this.messageBus.emit(PaidStreamingExtensionEvents.MESSAGE, {command, data});
        return;
    }
  }

  protected executeExtensionCommand(command: PaidStreamingExtensionNotices, data = {}) {
    if (!this.peerAccount) {
      log.warn(
        'Peer does not support Web3Torrent - This client will block all non-web3torrent leechers.'
      );
      this.messageBus.emit(
        PaidStreamingExtensionEvents.WARNING,
        new Error('!>Peer does not support Web3Torrent')
      );
    } else {
      this.wire.extended(this.name, bencode.encode({msg_type: 0, command, data}));
    }
  }

  protected addLogs() {
    const {wire} = this;

    const _onPiece = wire._onPiece;
    wire._onPiece = function(index, offset, buffer) {
      _onPiece.apply(wire, [index, offset, buffer]);
      log.trace(`<< _onPiece: ${index} OFFSET: ${offset} DOWNLOADED: ${wire.downloaded}`);
    };

    const _onRequest = wire._onRequest;
    wire._onRequest = function(index, offset, length) {
      log.trace(`<< _onRequest: ${index}`);
      _onRequest.apply(wire, [index, offset, length]);
    };
  }
}
