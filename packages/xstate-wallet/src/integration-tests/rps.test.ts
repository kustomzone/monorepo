import {FakeChain} from '../chain';
import {Player, hookUpMessaging} from './helpers';
import {
  privateKeyA,
  privateKeyB,
  destinationA,
  destinationB,
  traceA,
  traceB
} from './rps-test-data';

it('works', async () => {
  const fakeChain = new FakeChain();

  const chWalletA = new Player(privateKeyA, 'PlayerA', fakeChain, destinationA);
  const chWalletB = new Player(privateKeyB, 'PlayerB', fakeChain, destinationB);

  hookUpMessaging(chWalletA, chWalletB);

  const messageBufferA: any[] = [];
  const messageBufferB: any[] = [];

  chWalletA.onAppMessage(m => messageBufferA.push(m));
  chWalletB.onAppMessage(m => messageBufferB.push(m));

  while (traceA.length > 0 && traceB.length > 0) {
    // send all messages from A
    while (traceA[0] && traceA[0].direction === 'app->wallet') {
      console.log('[A] app -> wallet');
      const m = traceA.shift();
      chWalletA.pushMessage(m?.payload);
    }
    // send all messages from B
    while (traceB[0] && traceB[0].direction === 'app->wallet') {
      console.log('[B] app -> wallet');
      const m = traceB.shift();
      chWalletB.pushMessage(m?.payload);
    }

    let remainingSleeps = 3;
    // wait if no buffered messages
    while (messageBufferA.length === 0 && messageBufferB.length === 0) {
      if (remainingSleeps === 0) {
        console.log('[A] expecting: ', traceA[0]);
        console.log('[B] expecting: ', traceB[0]);
        throw new Error('Wallets seem to have blocked');
      }
      console.log(`sleeping...${remainingSleeps}`);
      await new Promise(r => setTimeout(r, 500));
      remainingSleeps = remainingSleeps - 1;
    }

    // check that A's messages are expected
    while (messageBufferA.length > 0) {
      const expected = traceA.shift()?.payload;
      const received = messageBufferA.shift();
      expect(expected).toEqual(received);
    }

    // check that B's messages are expected
    while (messageBufferB.length > 0) {
      const expected = traceB.shift()?.payload;
      const received = messageBufferB.shift();
      expect(expected).toEqual(received);
    }
  }
});
