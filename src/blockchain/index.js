const { Interface } = require('ethers');
const ResilientWebSocketProvider = require('./ResilientWebSocketProvider');
const abi = require('./contractABI');
const eventProcessors = require('./eventProcessors');
const config = require('../config');

// Create interface
const iface = new Interface(abi);

// Initialize the resilient WebSocket provider
function createBlockchainProvider(eventHandler) {
  return new ResilientWebSocketProvider(
    config.BASE_RPC,
    config.CONTRACT_ADDRESS,
    eventHandler
  );
}

module.exports = {
  ResilientWebSocketProvider,
  iface,
  eventProcessors,
  createBlockchainProvider,
  abi
};