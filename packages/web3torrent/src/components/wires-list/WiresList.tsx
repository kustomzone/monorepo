import prettier from 'prettier-bytes';
import {Torrent} from '../../types';
import React from 'react';
import {ChannelContext, ChannelState} from '../../clients/payment-channel-client';
import './WiresList.scss';
import {FormButton} from '../form';

export type Props = {
  torrent: Torrent;
  channelCache: Record<string, ChannelState>;
  mySigningAddress?: string;
};

class WiresList extends React.Component<Props> {
  static contextType = ChannelContext;
  render() {
    let channelCache: Record<string, ChannelState>;

    this.props.channelCache === {}
      ? (channelCache = this.context.channelCache)
      : (channelCache = this.props.channelCache); // TODO this is pretty nasty, refactor

    const mySigningAddress = this.props.mySigningAddress || this.context.mySigningAddress;
    const {torrent} = this.props;

    const leechingChannelIds = Object.keys(channelCache).filter(
      key => channelCache[key].payer === mySigningAddress
    );

    const seedingChannelIds = Object.keys(channelCache).filter(
      key => channelCache[key].beneficiary === mySigningAddress
    );

    const totalSpent = leechingChannelIds
      .map(id => channelCache[id].beneficiaryBalance)
      .reduce((a, b) => Number(a) + Number(b), 0); // TODO use bigNumberify

    const totalEarned = seedingChannelIds
      .map(id => channelCache[id].beneficiaryBalance)
      .reduce((a, b) => Number(a) + Number(b), 0); // TODO use bigNumberify

    return (
      <>
        <section className="uploadingInfo">
          {' '}
          {/* TODO change class to summaryInfo */}
          <p>
            Totals: <strong>{totalEarned}</strong>
            {' / '}
            <strong style={{color: 'red'}}>{totalSpent}</strong> wei
            <br />
            <strong data-test-selector="numPeers">{torrent.numPeers}</strong> Peers connected
          </p>
        </section>
        <section className="wires-list">
          <h2>Connections</h2>
          <table className="wires-list-table">
            <tbody>
              {Object.values(torrent.wires).map(wire => (
                <tr key={wire.paidStreamingExtension.pseAccount}>
                  <td>
                    <FormButton>Close</FormButton>
                  </td>
                  <td className="peerAccount">{wire.paidStreamingExtension.peerAccount}</td>
                  <td className="channelId">{wire.paidStreamingExtension.pseChannelId}</td>
                  {seedingChannelIds.includes(wire.paidStreamingExtension.pseChannelId) && (
                    <>
                      <td className="uploaded">{prettier(wire.uploaded)}</td>
                      <td className="leecher-paid">
                        +
                        {Number(
                          channelCache[wire.paidStreamingExtension.pseChannelId].beneficiaryBalance
                        )}{' '}
                        wei
                      </td>
                    </>
                  )}
                  {leechingChannelIds.includes(wire.paidStreamingExtension.pseChannelId) && (
                    <>
                      <td className="downloaded">{prettier(0)}</td>
                      <td className="leecher-paid" style={{color: 'red'}}>
                        -
                        {Number(
                          channelCache[wire.paidStreamingExtension.pseChannelId].beneficiaryBalance
                        )}{' '}
                        wei
                      </td>
                    </>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      </>
    );
  }
}

export {WiresList};
