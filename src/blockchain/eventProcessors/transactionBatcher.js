// Transaction batching logic for handling multiple events in the same transaction
const pendingTransactions = new Map(); // txHash -> {fulfilled: Set, pruned: Set, blockNumber: number, rawIntents: Map}
const processingScheduled = new Set(); // Track which transactions are scheduled for processing

function scheduleTransactionProcessing(txHash, processCallback) {
  if (processingScheduled.has(txHash)) return; // Already scheduled

  processingScheduled.add(txHash);

  setTimeout(async () => {
    await processCallback(txHash);
    processingScheduled.delete(txHash);
  }, 3000); // Wait 3 seconds for all events to arrive
}

function addFulfilledIntent(txHash, intentHash, intentData, blockNumber) {
  // Initialize transaction data if not exists
  if (!pendingTransactions.has(txHash)) {
    pendingTransactions.set(txHash, {
      fulfilled: new Set(),
      pruned: new Set(),
      blockNumber: blockNumber,
      rawIntents: new Map()
    });
  }

  // Store the fulfillment data
  const txData = pendingTransactions.get(txHash);
  txData.fulfilled.add(intentHash.toLowerCase());
  txData.rawIntents.set(intentHash.toLowerCase(), {
    type: 'fulfilled',
    ...intentData
  });
}

function addPrunedIntent(txHash, intentHash, intentData, blockNumber) {
  // Initialize transaction data if not exists
  if (!pendingTransactions.has(txHash)) {
    pendingTransactions.set(txHash, {
      fulfilled: new Set(),
      pruned: new Set(),
      blockNumber: blockNumber,
      rawIntents: new Map()
    });
  }

  // Store the pruned data
  const txData = pendingTransactions.get(txHash);
  txData.pruned.add(intentHash.toLowerCase());
  txData.rawIntents.set(intentHash.toLowerCase(), {
    type: 'pruned',
    ...intentData
  });
}

function getTransactionData(txHash) {
  return pendingTransactions.get(txHash);
}

function removeTransaction(txHash) {
  pendingTransactions.delete(txHash);
}

module.exports = {
  scheduleTransactionProcessing,
  addFulfilledIntent,
  addPrunedIntent,
  getTransactionData,
  removeTransaction
};