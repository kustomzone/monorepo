---
id: outcomes
title: Understand Outcomes
---

So far during this tutorial we have not concerned ourselves with specifying meaningful outcomes on any of our `States`. This has meant that although we have learnt to deposit assets, execute state transitions off chain, and to finalize an outcome via challenge or conclude, no participant could get their funds back out of the state channel and into their ethereum account.

The time has come to tackle this issue!
Nitro protocol is an extension of ForceMove protocol that we have dealt with so far. ForceMove specifies only that a state should have a default `outcome` but does not specify the format of that `outcome`, and simply treats it as an unstructured `bytes` field. In this section we look at the outcome formats needed for Nitro.

## Outcomes that allocate

The following table illustrates an example data structure for an outcome, which features an _allocation_ asset outcome. (For those interested, the giveaway is the `0` in the `AssetOutcome` property. Guarantee asset outcomes, which we will get to shortly, have a `1` there).

:::tip
Nitro supports multiple different assets (e.g. ETH and one or more ERC20s) being held in the same channel.
:::

| >                                                                                               | 0xETHAssetHolder                                 | 0                                                                                                     | 0xDestA     | 5      | 0xDestB     | 2      | 0xDAIAssetHolder | ... |
| ----------------------------------------------------------------------------------------------- | ------------------------------------------------ | ----------------------------------------------------------------------------------------------------- | ----------- | ------ | ----------- | ------ | ---------------- | --- |
|                                                                                                 |                                                  |                                                                                                       | Destination | Amount | Destination | Amount |                  |     |
|                                                                                                 |                                                  | <td colspan="2" align="center">AllocationItem</td> <td colspan="2" align="center">AllocationItem</td> |             |        |
|                                                                                                 |                                                  | <td colspan="4" align="center">Allocation</td>                                                        |             |        |
|                                                                                                 | <td colspan="5" align="center">AssetOutcome</td> |                                                                                                       |             |
| <td colspan="6" align="center">OutcomeItem</td> <td colspan="6" align="center">OutcomeItem</td> |
| <td colspan="8" align="center">Outcome</td>                                                     |

Such an outcome specifies

- at least one asset holder (which in turn is tied to a specific asset type such as ETH or an ERC20 token)
- for each asset holder, an array of (destination, amount) pairs known as an `Allocation`, and indicating a payout of amount tokens to destination.

The destination here might be an external destination (which means the assets will get paid out to an ethereum address) or a channelId.

:::tip
In nitro protocol, channels can allocate funds to other channels!
:::

To construct an outcome, you can import the `Outcome` type to ensure you're getting the basics right. Then go ahead and attach that outcome in place of the `[]` we used as a placeholder previously on our `States`:

```typescript
// In lesson11.test.ts

import { AllocationAssetOutcome, Outcome, encodeOutcome, decodeOutcome } from '@statechannels/nitro-protocol';

const assetOutcome: AllocationAssetOutcome = {
  assetHolderAddress: ETH_ASSET_HOLDER_ADDRESS
  allocationItems: [
    {destination: externalDestination, amount: '0x03'}, // 3 wei
    // other payouts go here,
    // e.g. having destination: someOtherExternalDestintion
    // or destination: someChannelId
  ],
};

const outcome: Outcome = [assetOutcome];
// Additional assetOutcomes could be pushed into this array

// Optional: this encoding function is a part of the getVariablePart helper function that we are already using
// So you most likely won't need to use it.
const encodedOutcome = encodeOutcome(outcome);
expect(decodeOutcome(encodedOutcome)).toEqual(outcome);
```

## Outcomes that guarantee

Guarantee Asset Outcomes are similar to Allocation Asset Outcomes, only they not have any amounts. Their purpose is to simply express an ordering of destinations for a given asset holder (say, a given token).

The following table illustrates an example data structure for an outcome, which features an _guarantee_ asset outcome. (This time the giveaway is the `1` in the `AssetOutcome` property).

| >                                                                                               | 0xETHAssetHolder                                 | 1                                             | 0xchannelA                                                       | 0xBob | 0xAlice | 0xDAIAssetHolder | ... |
| ----------------------------------------------------------------------------------------------- | ------------------------------------------------ | --------------------------------------------- | ---------------------------------------------------------------- | ----- | ------- | ---------------- | --- |
|                                                                                                 |                                                  |                                               | TargetChannelId <td colspan="2" align="center">Destinations</td> |       |         |
|                                                                                                 |                                                  | <td colspan="3" align="center">Guarantee</td> |                                                                  |       |
|                                                                                                 | <td colspan="4" align="center">AssetOutcome</td> |                                               |                                                                  |
| <td colspan="5" align="center">OutcomeItem</td> <td colspan="5" align="center">OutcomeItem</td> |
| <td colspan="7" align="center">Outcome</td>                                                     |

A channel that has a guarantee outcome is said to be a guarantor channel.

Now while we can _transfer_ assets out of a channel, the terminology is instead to _claim_ on a guarantor channel. Assets will be paid to beneficiaries of the _target_ channel, but in an order of precedence defined by the guarantor. More on this later.

Constructing the right kind of object in typescript is straightforward:

```typescript
// In lesson12.test.ts

import {GuaranteeAssetOutcome} from '@statechannels/nitro-protocol';

const assetOutcome: GuaranteeAssetOutcome = {
  assetHolderAddress: process.env.ETH_ASSET_HOLDER_ADDRESS,
  guarantee: {
    targetChannelId: HashZero,
    destinations: [
      '0x000000000000000000000000000000000000000000000000000000000000000b',
      '0x000000000000000000000000000000000000000000000000000000000000000a',
    ],
  },
};
```

Encoding of all outcomes (including guarantee outcomes) is handled seamlessly by the `getVariablePart` function.

Don't worry if it is not yet clear why we need guarantor channels or outcomes that guarantee. They are a useful tool for virtually funding channels, but can be safely ignored if you are just trying to understand directly funded channels.
