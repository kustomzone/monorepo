import {withActions} from '@storybook/addon-actions';
import {withKnobs} from '@storybook/addon-knobs';
import {storiesOf} from '@storybook/react';
import React from 'react';
import {ChannelList} from './ChannelList';
import './ChannelList.scss';

storiesOf('Web3Torrent', module)
  .addDecorator(withActions('click'))
  .addDecorator(withKnobs())
  .add('ChannelList', () => <ChannelList />);
