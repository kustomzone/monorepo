import {Contract, Wallet} from 'ethers';
import {bigNumberify, parseUnits} from 'ethers/utils';
// @ts-ignore
import ETHAssetHolderArtifact from '../../../build/contracts/TestEthAssetHolder.json';

const provider = getTestProvider();
let ETHAssetHolder: Contract;
const chainId = '0x1234';
const participants = [];

const getDepositedEvent = events => events.find(({event}) => event === 'Deposited').args;

// Populate destinations array
for (let i = 0; i < 3; i++) {
  participants[i] = Wallet.createRandom().address;
}

beforeAll(async () => {
  ETHAssetHolder = await setupContracts(
    provider,
    ETHAssetHolderArtifact,
    process.env.TEST_ETH_ASSET_HOLDER_ADDRESS
  );
});

// Amounts are valueString represenationa of wei
describe('tutorial', () => {
  it('lesson 1', async () => {
    const held = parseUnits('1', 'wei');

    const destinationChannel: Channel = {chainId, channelNonce, participants};
    const destination = getChannelId(destinationChannel);

    // Set holdings by depositing in the 'safest' way
    const tx0 = ETHAssetHolder.deposit(destination, '0x0', held, {
      value: held,
    });
    const {events} = await (await tx0).wait();
    const depositedEvent = getDepositedEvent(events);

    expect(await ETHAssetHolder.holdings(destination)).toEqual(held);
    expect(depositedEvent).toMatchObject({
      destination,
      amountDeposited: bigNumberify(held),
      destinationHoldings: bigNumberify(held),
    });
  });
});
