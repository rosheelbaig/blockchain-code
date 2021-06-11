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

async function participateInOnChainVoteEvent(electionId, candidateId, voterId) {
  try {
    let candidateWallet = await Auth.getUserWalletById(DB.pool, candidateId);
    let voterWallet = await Auth.getUserWalletById(DB.pool, voterId);

    let voterPublicKey = CryptoUtils.publicKeyFromPrivateKey(
      CryptoUtils.B64ToUint8Array(voterWallet.private_key)
    );

    let ownerAddress = LocalAddress.fromPublicKey(voterPublicKey).toString();
    let web3 = new Web3(
      new LoomProvider(
        client,
        CryptoUtils.B64ToUint8Array(voterWallet.private_key)
      )
    );

    let taswitContractInstance = new web3.eth.Contract(
      ABI,
      currentNetwork.address,
      {
        from: ownerAddress,
      }
    );
    let electionIdConversion = parseInt(electionId);

    console.log(
      '1111',
      electionIdConversion - 1,
      candidateWallet.wallet_address,
      voterWallet.wallet_address
    );
    let blockchainResponse = await taswitContractInstance.methods
      .participateInVoteEvent(
        electionIdConversion - 1,
        candidateWallet.wallet_address,
        voterWallet.wallet_address
      )
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

async function addVoterToContract(voterId) {
  try {
    let adminWallet = await Auth.getUserWalletById(DB.pool, config.adminID);
    let voterWallet = await Auth.getUserWalletById(DB.pool, voterId);

    let adminPublicKey = CryptoUtils.publicKeyFromPrivateKey(
      CryptoUtils.B64ToUint8Array(adminWallet.private_key)
    );

    let ownerAddress = LocalAddress.fromPublicKey(adminPublicKey).toString();
    let web3 = new Web3(
      new LoomProvider(
        client,
        CryptoUtils.B64ToUint8Array(adminWallet.private_key)
      )
    );

    let taswitContractInstance = new web3.eth.Contract(
      ABI,
      currentNetwork.address,
      {
        from: ownerAddress,
      }
    );

    let blockchainResponse = await taswitContractInstance.methods
      .addNewParticipant(voterId, voterWallet.wallet_address, true)
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
  addVoterToContract: addVoterToContract,
  participateInOnChainVoteEvent: participateInOnChainVoteEvent,
};
