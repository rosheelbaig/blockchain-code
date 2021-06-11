const { Client, LocalAddress, CryptoUtils, LoomProvider } = require('loom-js');
const fs = require('fs');
const path = require('path');
const join = require('path');
const BN = require('bn.js');
const Web3 = require('web3');
const { readFileSync } = require('fs');
const config = require('../config/configBasic');

let writeUrl = config.loomNetwork.writeUrl;
let readUrl = config.loomNetwork.readUrl;
let networkId = config.loomNetwork.networkId;
let taswitABIContract = fs.readFileSync(
  './loomBlockchain/src/contracts/TaswitContract.json'
);
let taswitContract = JSON.parse(taswitABIContract);
let client = new Client(networkId, writeUrl, readUrl);
const chainID = config.loomNetwork.chainID;
let currentNetwork = taswitContract.networks[chainID];
const ABI = taswitContract.abi;
const Auth = require('../model/Authentication');
const DB = require('../model/db');

async function addNewElection(
  eventName,
  eventDescription,
  eventStartTime,
  eventEndTime,
  maxParticipantVote
) {
  try {
    let adminWallet = await Auth.getUserWalletById(DB.pool, config.adminID);
    console.log('adminWallet privateKey', adminWallet.private_key);

    let publicKey = CryptoUtils.publicKeyFromPrivateKey(
      CryptoUtils.B64ToUint8Array(adminWallet.private_key)
    );
    console.log('admin publicKey', publicKey);

    let ownerAddress = LocalAddress.fromPublicKey(publicKey).toString();
    console.log('admin address', ownerAddress);
    let web3 = new Web3(
      new LoomProvider(
        client,
        CryptoUtils.B64ToUint8Array(adminWallet.private_key)
      )
    );
    console.log('adminWallet[0].privateKey', adminWallet.private_key);

    let taswitContractInstance = new web3.eth.Contract(
      ABI,
      currentNetwork.address,
      {
        from: ownerAddress,
      }
    );
    let startTimestamp = new Date(eventStartTime).getTime() / 1000;
    let endTimestamp = new Date(eventEndTime).getTime() / 1000;

    console.log('StartTime', startTimestamp);
    console.log('endTimestamp', endTimestamp);
    let blockchainResponse = await taswitContractInstance.methods
      .addNewVoteEvent(
        eventName,
        eventDescription,
        startTimestamp,
        endTimestamp,
        maxParticipantVote
      )
      .send({
        from: ownerAddress,
      });

    if (blockchainResponse.status) {
      return {
        status: true,
        response: blockchainResponse,
      };
    } else {
      return {
        status: false,
        response: blockchainResponse,
      };
    }
  } catch (e) {
    console.log('Internal Server Error', e);
  }
}

async function activateOnChainElection(electionID) {
  try {
    let adminWallet = await Auth.getUserWalletById(DB.pool, config.adminID);
    console.log('adminWallet privateKey', adminWallet.private_key);

    let publicKey = CryptoUtils.publicKeyFromPrivateKey(
      CryptoUtils.B64ToUint8Array(adminWallet.private_key)
    );
    console.log('admin publicKey', publicKey);

    let ownerAddress = LocalAddress.fromPublicKey(publicKey).toString();
    console.log('admin address', ownerAddress);
    let web3 = new Web3(
      new LoomProvider(
        client,
        CryptoUtils.B64ToUint8Array(adminWallet.private_key)
      )
    );
    console.log('adminWallet[0].privateKey', adminWallet.private_key);

    let taswitContractInstance = new web3.eth.Contract(
      ABI,
      currentNetwork.address,
      {
        from: ownerAddress,
      }
    );
    let blockchainResponse = await taswitContractInstance.methods
      .activateVoteEvent(electionID - 1)
      .send({
        from: ownerAddress,
      });
    console.log(blockchainResponse);
    if (blockchainResponse.status) {
      return {
        status: true,
        response: blockchainResponse,
      };
    } else {
      return {
        status: false,
        response: blockchainResponse,
      };
    }
  } catch (e) {
    console.log('Internal Server Error', e);
  }
}

module.exports = {
  addNewElection: addNewElection,
  activateOnChainElection: activateOnChainElection,
};
