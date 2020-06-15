/* eslint-disable react-hooks/rules-of-hooks */
import usePaidStreamingExtension from './pse-middleware';
import Wire from 'bittorrent-protocol';
import {PaidStreamingWire, PaidStreamingExtendedHandshake} from './types';
import _ from 'lodash';

const seederOpts = {pseAccount: 'seeder', outcomeAddress: '0xabc'};
const Seeder = usePaidStreamingExtension(seederOpts);

const leecherOpts = {pseAccount: 'leecher', outcomeAddress: '0xabc'};
const Leecher = usePaidStreamingExtension(leecherOpts);

const parseBuffers = (handshake: PaidStreamingExtendedHandshake) =>
  _.mapValues(handshake, val => (Buffer.isBuffer(val) ? val.toString() : val));

it('works', done => {
  const eventLog = [];
  const seeder: PaidStreamingWire = (new Wire() as any) as PaidStreamingWire;
  const leecher: PaidStreamingWire = (new Wire() as any) as PaidStreamingWire;

  seeder.on('extended', (event, extendedHandshake) => {
    if (event === 'handshake') {
      eventLog.push('s ex');
      expect(parseBuffers(extendedHandshake)).toMatchObject(leecherOpts);
    }
  });

  leecher.on('extended', (event, extendedHandshake) => {
    if (event === 'handshake') {
      eventLog.push('l ex');
      expect(parseBuffers(extendedHandshake)).toMatchObject(seederOpts);

      // Last step: ensure handshakes came before extension protocol
      expect(eventLog).toMatchObject(['s hs', 'l hs', 's ex', 'l ex']);
      done();
    }
  });

  seeder.on('handshake', (infoHash, peerId, extensions) => {
    eventLog.push('s hs');
    process.nextTick(() => {
      seeder.handshake(infoHash, peerId);
    });
  });

  leecher.on('handshake', (infoHash, peerId, extensions) => {
    eventLog.push('l hs');
    process.nextTick(() => {
      seeder.handshake(infoHash, peerId);
    });
  });

  seeder.pipe(leecher).pipe(seeder);

  seeder.use(Seeder);
  leecher.use(Leecher);

  seeder.on('error', err => done.fail(err));
  leecher.on('error', err => done.fail(err));

  const s = '9f384d9dbadc4828aa819f384d9dbadc4828aa81';
  leecher.handshake(s, s);
});
