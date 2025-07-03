const { getFiatCode, formatConversionRate, formatUSDC, txLink } = require('../../utils');
const { ZKP2P_GROUP_ID, ZKP2P_TOPIC_ID } = require('../../config/constants');
const transactionBatcher = require('./transactionBatcher');

// Store intent details temporarily for rate information
const intentDetails = new Map();

async function processCompletedTransaction(txHash, db, bot, createDepositKeyboard) {
  const txData = transactionBatcher.getTransactionData(txHash);
  if (!txData) return;

  console.log(`🔄 Processing completed transaction ${txHash}`);

  // Process pruned intents first, but skip if also fulfilled
  for (const intentHash of txData.pruned) {
    if (txData.fulfilled.has(intentHash)) {
      console.log(`Intent ${intentHash} was both pruned and fulfilled in tx ${txHash}, prioritizing fulfilled status`);
      continue; // Skip sending pruned notification
    }

    // Send pruned notification
    const rawIntent = txData.rawIntents.get(intentHash);
    if (rawIntent) {
      await sendPrunedNotification(rawIntent, txHash, db, bot, createDepositKeyboard);
    }
  }

  // Process fulfilled intents
  for (const intentHash of txData.fulfilled) {
    const rawIntent = txData.rawIntents.get(intentHash);
    if (rawIntent) {
      await sendFulfilledNotification(rawIntent, txHash, db, bot, createDepositKeyboard);
    }
  }

  // Clean up
  transactionBatcher.removeTransaction(txHash);
}

async function sendFulfilledNotification(rawIntent, txHash, db, bot, createDepositKeyboard) {
  const { depositId, verifier, owner, to, amount, sustainabilityFee, verifierFee, intentHash } = rawIntent;
  const { getPlatformName } = require('../../utils');
  const platformName = getPlatformName(verifier);

  const storedDetails = intentDetails.get(intentHash.toLowerCase());
  let rateText = '';
  if (storedDetails) {
    const fiatCode = getFiatCode(storedDetails.fiatCurrency);
    const formattedRate = formatConversionRate(storedDetails.conversionRate, fiatCode);
    rateText = `\n- *Rate:* ${formattedRate}`;

    // Clean up memory after use
    intentDetails.delete(intentHash.toLowerCase());
  }

  const interestedUsers = await db.getUsersInterestedInDeposit(depositId);
  if (interestedUsers.length === 0) return;

  console.log(`📤 Sending fulfillment to ${interestedUsers.length} users interested in deposit ${depositId}`);

  const message = `
🟢 *Order Fulfilled*
- *Deposit ID:* \`${depositId}\`
- *Order ID:* \`${intentHash}\`
- *Platform:* ${platformName}
- *Owner:* \`${owner}\`
- *To:* \`${to}\`
- *Amount:* ${formatUSDC(amount)} USDC${rateText}
- *Sustainability Fee:* ${formatUSDC(sustainabilityFee)} USDC
- *Verifier Fee:* ${formatUSDC(verifierFee)} USDC
- *Tx:* [View on BaseScan](${txLink(txHash)})
`.trim();

  for (const chatId of interestedUsers) {
    await db.updateDepositStatus(chatId, depositId, 'fulfilled', intentHash);
    await db.logEventNotification(chatId, depositId, 'fulfilled');

    const sendOptions = {
      parse_mode: 'Markdown',
      disable_web_page_preview: true,
      reply_markup: createDepositKeyboard(depositId)
    };
    if (chatId === ZKP2P_GROUP_ID) {
      sendOptions.message_thread_id = ZKP2P_TOPIC_ID;
    }
    bot.sendMessage(chatId, message, sendOptions);
  }
}

async function sendPrunedNotification(rawIntent, txHash, db, bot, createDepositKeyboard) {
  const { depositId, intentHash } = rawIntent;

  const interestedUsers = await db.getUsersInterestedInDeposit(depositId);
  if (interestedUsers.length === 0) return;

  console.log(`📤 Sending cancellation to ${interestedUsers.length} users interested in deposit ${depositId}`);

  const message = `
🟠 *Order Cancelled*
- *Deposit ID:* \`${depositId}\`
- *Order ID:* \`${intentHash}\`
- *Tx:* [View on BaseScan](${txLink(txHash)})

*Order was cancelled*
`.trim();

  for (const chatId of interestedUsers) {
    await db.updateDepositStatus(chatId, depositId, 'pruned', intentHash);
    await db.logEventNotification(chatId, depositId, 'pruned');

    const sendOptions = {
      parse_mode: 'Markdown',
      disable_web_page_preview: true,
      reply_markup: createDepositKeyboard(depositId)
    };
    if (chatId === ZKP2P_GROUP_ID) {
      sendOptions.message_thread_id = ZKP2P_TOPIC_ID;
    }
    bot.sendMessage(chatId, message, sendOptions);
  }
}

function storeIntentDetails(intentHash, fiatCurrency, conversionRate, verifier) {
  intentDetails.set(intentHash.toLowerCase(), { fiatCurrency, conversionRate, verifier });
}

module.exports = {
  processCompletedTransaction,
  sendFulfilledNotification,
  sendPrunedNotification,
  storeIntentDetails
};