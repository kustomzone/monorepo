---
id: finalize-a-channel-happy
title: Finalize a channel (happy)
---

Finalization of a state channel is a necessary step before defunding it (i.e. releasing the assets that were deposited on chain, in the case of direct funding). In the so-called 'happy' case, all participants cooperate to achieve this.

A participant wishing to end the state channel will sign a state with `isFinal = true`. Then, the other participants support that state. Once a full set of `n` such signatures exists \(this set is known as a **finalization proof**\) anyone in possession may use it to finalize the `outcome` on-chain. They would do this by calling `conclude` on the adjudicator.

## Call `conclude`

The conclude method allows anyone with sufficient off-chain state to immediately finalize an outcome for a channel without having to wait for a challenge to expire (more on that later).

The off-chain state(s) is submitted (in an optimized format), and once relevant checks have passed, an expired challenge is stored against the `channelId`. (This is an implementation detail -- the important point is that the chain shows that the channel has been finalized.)

In the following example the participants support the state by countersigning it, without increasing the turn number:

```typescript
// In lesson6.test.ts

/* Import ethereum wallet utilities  */
import {ethers} from 'ethers';
import {AddressZero, HashZero} from 'ethers/constants';
import {bigNumberify} from 'ethers/utils';

/* Import statechannels wallet utilities  */
import {
  Channel,
  State,
  getFixedPart,
  hashOutcome,
  signStates,
  hashAppPart,
} from '@statechannels/nitro-protocol';

/* Construct a final state */
const participants = [];
const wallets: ethers.Wallet[] = [];
for (let i = 0; i < 3; i++) {
  wallets[i] = ethers.Wallet.createRandom();
  participants[i] = wallets[i].address;
}
const chainId = '0x1234';
const channelNonce = bigNumberify(0).toHexString();
const channel: Channel = {chainId, channelNonce, participants};
const largestTurnNum = 4;
const state: State = {
  isFinal: true,
  channel,
  outcome: [],
  appDefinition: AddressZero,
  appData: HashZero,
  challengeDuration: 1,
  turnNum: largestTurnNum,
};

/* Generate a finalization proof */
const whoSignedWhat = [0, 0, 0];
const sigs = await signStates([state], wallets, whoSignedWhat);

/*
  Call conclude
*/
const numStates = 1;
const fixedPart = getFixedPart(state);
const appPartHash = hashAppPart(state);
const outcomeHash = hashOutcome(state.outcome);
const tx = NitroAdjudicator.conclude(
  largestTurnNum,
  fixedPart,
  appPartHash,
  outcomeHash,
  numStates,
  whoSignedWhat,
  sigs
);
```

Notice we imported `hashOutcome` and `hashAppPart` in order to provide the `conclude` method with the correct calldata.
