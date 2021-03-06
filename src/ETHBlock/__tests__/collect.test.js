import os from 'os';

import { log } from 'core/helpers';
import createTinyStore from 'core/store';
import ETHBlock from 'ETHBlock';
import HDWallet from 'HDWallet';
import { collectCases as test } from './test-cases';

const Pick  = arr => {
  let index = 0;
  return {
    get(){
      const child = arr[index];
      index++;
      return child;
    }
  };
};

describe('Collect money from all children account', () => {
  const case1 = test.case1;
  const { endUserPrv, mnemonic, endUserSpends, receiveAcc } = case1;
  const { address: endUserAcc } = HDWallet.walletFromPrv(endUserPrv);
  const totalSpends = endUserSpends.reduce((s1, s2) => s1 + s2);

  /**
   * Validate Test Environment Condition
   */
  beforeAll(async () => {
    log.info('[collect.test] Validating "Test Setup"...');

    const shouldHasVal = endUserPrv && mnemonic && endUserSpends;
    if (!shouldHasVal) {
      log.info(
        [
          '[collect.test] Test case should have:',
          '  + End user private key',
          '  + HD Wallet mnemonic',
          '  + How end user spends'
        ].join(os.EOL)
      );

      throw new Error('Test case missing required fields.');
    }

    const endUserBalance = await ETHBlock.getBalanceInETH(endUserAcc);
    const notEnough = endUserBalance < totalSpends;
    if (notEnough) {
      log.info(
        [
          '[collect.test] End User Account should have enough coin',
          `[collect.test] End User Account Balance: ${endUserBalance} ETH`,
          `[collect.test] Required Spends: ${totalSpends} ETH`
        ].join(os.EOL)
      );

      throw new Error('End User Account doesn\'st have enough coin to run test');
    }
  });

  /**
   * Setup Scenario: End user sends coin to child address of HD Wallet
   * Logic:
   *   + End user's account using child address of HD Wallet
   *   + Hold mnemonic phrase > can collect back all money
   */
  describe('Setup scenario', () => {
    const initState = {
      endUserAccBalance: null,
      receiveAccBalance: null
    };
    const { setState, getKey } = createTinyStore(initState);
    const collectCb = jest.fn();
    const collectMCs = collectCb.mock.calls;

    beforeAll(async () => {
      log.info(
        [
          '[collect.test] Setup scenario',
          '[collect.test]   + End user send coin to child address of HD Wallet',
          '[collect.test]   + Hold mnemonic phrase > can collect back all money'
        ].join(os.EOL)
      );

      const hdWallet = HDWallet.fromMnemonic(mnemonic);
      const children = HDWallet._generate({ offset: 0, limit: 10 })(hdWallet);

      // Store balance to compare in test
      const [uETH, rETH] = await Promise.all([
        ETHBlock.getBalanceInETH(endUserAcc),
        ETHBlock.getBalanceInETH(receiveAcc)
      ]);
      setState({
        endUserAccBalance: uETH,
        receiveAccBalance: rETH
      });

      // End user send to random child's account
      // @WARN: Spend concurrently on same must transaction IN ORDER
      const pickOne = Pick(children);
      await endUserSpends.reduce(async (prevSend, amount) => {
        await prevSend;
        return ETHBlock._send({
          amount,
          from: endUserPrv,
          to: pickOne.get().address
        });
      }, Promise.resolve());
      log.info('[collect.test] User sends coin completely');

      // Collect all money from children account
      await ETHBlock.collect({ mnemonic, children, receiveAcc, collectCb });
      log.info('[collect.test] Collect money from children account completely');
    }, case1.WAIT_COLLECT_TIMEOUT);

    it(
      'End User should send coin to child account',
      async () => {
        const currBalanceETH = await ETHBlock.getBalanceInETH(endUserAcc);
        const prvBalanceETH = getKey('endUserAccBalance');
        const diffABS = Math.abs(currBalanceETH - prvBalanceETH);

        expect(diffABS).toBeCloseTo(totalSpends);
      },
      case1.WAIT_INFO_TIMEOUT
    );

    it(
      'Should collect ALL money from children\'s account',
      async () => {
        const currBalanceETH = await ETHBlock.getBalanceInETH(receiveAcc);
        const prvBalanceETH = getKey('receiveAccBalance');
        const diffABS = Math.abs(currBalanceETH - prvBalanceETH);

        expect(diffABS).toBeCloseTo(totalSpends);
      },
      case1.WAIT_INFO_TIMEOUT
    );

    it('Should call collectCb', () => {
      expect(collectMCs.length).toBe(endUserSpends.length);
    });

    it('Should call collectCb with right params\'s shape', () => {
      const expectCollectCbParams = ({
        from,
        receiveAcc: to,
        amount,
        txHash
      }) => {
        expect(from).toBeTruthy();
        expect(to).toBeTruthy();
        expect(amount).toBeTruthy();
        expect(txHash.length).toBe(case1.HASH_LENGTH);
      };

      expectCollectCbParams(collectMCs[0][0]);
    });
  });
});
