import {withActions} from '@storybook/addon-actions';
import {number, withKnobs} from '@storybook/addon-knobs';
import {storiesOf} from '@storybook/react';
import React from 'react';
import {WiresList} from './WiresList';
import './WiresList.scss';
import {Torrent} from '../../types';
import {ChannelState} from '../../clients/payment-channel-client';

storiesOf('Web3Torrent', module)
  .addDecorator(withActions('click'))
  .addDecorator(withKnobs())
  .add('WiresList', () => (
    <WiresList
      torrent={
        {
          numPeers: 3,
          wires: [
            {
              uploaded: number(
                'Uploaded bytes for Peer 2190352424',
                5051532,
                {step: 1000},
                'Peers'
              ),
              paidStreamingExtension: {
                peerAccount: '0xf864dD1ead0006e7Fb4A85D4bBf25e10Fc0Bed72',
                pseChannelId: '0x72Fb4A85D4bBf25e10Fc0Bed72f864dD1ead0006e7Fb4A85D4bBf25e10Fc0Bed'
              }
            },
            {
              uploaded: number(
                'Uploaded bytes for Peer 2190352424',
                5051532,
                {step: 1000},
                'Peers'
              ),
              paidStreamingExtension: {
                peerAccount: '0x0Fc0Bed72f864dD1ead0006e7Ff864dD1ead0006e7Fb4A85D4bBf25e1',
                pseChannelId: '0x4A85D4bBf25e10Fc0Bed72Fb4A85D4bBf25e10Fc0Bed72f864dD1ead0006e7Fb'
              }
            }
          ]
        } as Torrent
      }
      channelCache={{
        '0x72Fb4A85D4bBf25e10Fc0Bed72f864dD1ead0006e7Fb4A85D4bBf25e10Fc0Bed': {
          channelId: '0x72Fb4A85D4bBf25e10Fc0Bed72f864dD1ead0006e7Fb4A85D4bBf25e10Fc0Bed',
          turnNum: '0x0',
          status: 'running',
          challengeExpirationTime: '0x0',
          beneficiary: '0x0',
          payer: '0xf864dD1ead0006e7Fb4A85D4bBf25e10Fc0Bed72',
          beneficiaryOutcomeAddress: '0x0',
          payerOutcomeAddress: '0x0',
          beneficiaryBalance: '0x3',
          payerBalance: '0x0'
        } as ChannelState,
        '0x4A85D4bBf25e10Fc0Bed72Fb4A85D4bBf25e10Fc0Bed72f864dD1ead0006e7Fb': {
          channelId: '0x4A85D4bBf25e10Fc0Bed72Fb4A85D4bBf25e10Fc0Bed72f864dD1ead0006e7Fb',
          turnNum: '0x0',
          status: 'running',
          challengeExpirationTime: '0x0',
          beneficiary: '0xf864dD1ead0006e7Fb4A85D4bBf25e10Fc0Bed72',
          payer: '0x0',
          beneficiaryOutcomeAddress: '0x0',
          payerOutcomeAddress: '0x0',
          beneficiaryBalance: '0x13',
          payerBalance: '0x0'
        } as ChannelState
      }}
      mySigningAddress="0xf864dD1ead0006e7Fb4A85D4bBf25e10Fc0Bed72"
    />
  ));
