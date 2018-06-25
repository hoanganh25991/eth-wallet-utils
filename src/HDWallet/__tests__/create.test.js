import HDWallet from 'HDWallet';
import { Wallet } from 'ethers';
import { createCases as cases } from './test-cases';

const log = console.log;

describe('Create HD Wallet', () => {
  it('Should create success with mnemonic phrase', () => {
    const hdWallet = HDWallet.fromMnemonic(cases.success.mnemonic);
    const address = new Wallet(hdWallet.privateKey).getAddress();
    // log('[publicKey]', hdWallet.publicKey);
    // log('[privateKey]', hdWallet.privateKey);
    // log('[address]', new Wallet(hdWallet.privateKey).address);
    expect(address).toBe('0xE6EA8442BD58A0241a50f088eDEb5a0C99bfA888');
  });
});
