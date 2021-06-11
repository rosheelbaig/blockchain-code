const { LocalAddress, CryptoUtils } = require('loom-js');
const config = require('../config/configBasic');

async function createNewWallet() {
  try {
    const privateKey = CryptoUtils.generatePrivateKey();
    const privateKeyString = CryptoUtils.Uint8ArrayToB64(privateKey);
    const publicKey = CryptoUtils.publicKeyFromPrivateKey(
      CryptoUtils.B64ToUint8Array(privateKeyString)
    );

    let walletAddress = LocalAddress.fromPublicKey(publicKey).toString();
    console.log('walletAddress', walletAddress);

    return {
      privateKey: privateKeyString,
      walletAddress: walletAddress,
    };
  } catch (e) {
    console.log('Internal Server Error', e);
  }
}

module.exports = {
  createNewWallet: createNewWallet,
};
