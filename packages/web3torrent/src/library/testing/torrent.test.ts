import WebTorrent from 'webtorrent';
import fixtures from 'webtorrent-fixtures';
import {once} from 'events';
import MemoryChunkStore from 'memory-chunk-store';

describe('torrent', () => {
  it('works', async () => {
    expect.assertions(3);

    const client1 = new WebTorrent({dht: false, tracker: false, peerId: 'a'.repeat(40)});
    const client2 = new WebTorrent({dht: false, tracker: false, peerId: 'b'.repeat(40)});
    const client3 = new WebTorrent({dht: false, tracker: false, peerId: 'c'.repeat(40)});

    client1.on('error', () => fail());
    client1.on('warning', () => fail());
    client2.on('error', () => fail());
    client2.on('warning', () => fail());
    client3.on('error', () => fail());
    client3.on('warning', () => fail());

    client2.seed(fixtures.alice.content, {name: 'alice.txt', announce: []});
    client3.seed(fixtures.alice.content, {name: 'alice.txt', announce: []});

    // wait for client2 to be listening
    await once(client2, 'listening');

    const torrent = client1.add(fixtures.alice.parsedTorrent.infoHash, {store: MemoryChunkStore});

    torrent.addPeer('127.0.0.1:' + client2.address().port);
    torrent.addPeer('127.0.0.1:' + client3.address().port);

    let order = 0;
    torrent.on('infoHash', () => expect(++order).toEqual(1));
    torrent.on('ready', () => expect(++order).toEqual(2));
    torrent.on('done', () => expect(++order).toEqual(3));

    await once(torrent, 'done');
    client1.destroy(error => error && fail(error));
    client2.destroy(error => error && fail(error));
    client3.destroy(error => error && fail(error));
  });
});
