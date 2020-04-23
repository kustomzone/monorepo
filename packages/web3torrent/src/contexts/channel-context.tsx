import {web3torrent} from '../clients/web3torrent-client';
import {useState} from 'react';
export type ChannelClientContext = ReturnType<typeof useChannelClientContext>;

export function useChannelClientContext() {
  const {paymentChannelClient} = web3torrent;
  const [isInitialized, setInitialized] = useState(false);

  const initialize = () => paymentChannelClient.initialize().then(() => setInitialized(true));

  return {initialize, isInitialized};
}