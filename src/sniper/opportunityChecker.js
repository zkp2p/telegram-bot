const { getExchangeRates } = require('./exchangeRates');
const { CURRENCY_HASH_TO_CODE, ZKP2P_GROUP_ID, ZKP2P_SNIPER_TOPIC_ID } = require('../config/constants');
const { getPlatformName, depositLink } = require('../utils');
const { db } = require('../database');

// In-memory cache for deposit amounts for quick access
const depositAmounts = new Map();

// Store deposit amount in memory for quick access
function storeDepositAmountInMemory(depositId, amount) {
  depositAmounts.set(Number(depositId), Number(amount));
}

// Get deposit amount from memory first, then database
async function getDepositAmountFromMemory(depositId) {
  // Try memory first
  const memoryAmount = depositAmounts.get(Number(depositId));
  if (memoryAmount) return memoryAmount;

  // Fall back to database
  return await db.getDepositAmount(depositId);
}

// Sniper logic
async function checkSniperOpportunity(depositId, depositAmount, currencyHash, conversionRate, verifierAddress, bot) {
  const currencyCode = CURRENCY_HASH_TO_CODE[currencyHash.toLowerCase()];
  const platformName = getPlatformName(verifierAddress).toLowerCase();

  if (!currencyCode) return; // Only skip unknown currencies

  console.log(`🎯 Checking sniper opportunity for deposit ${depositId}, currency: ${currencyCode}`);

  // Store amount in memory cache
  storeDepositAmountInMemory(depositId, depositAmount);

  // Get current exchange rates
  const exchangeRates = await getExchangeRates();
  if (!exchangeRates) {
    console.log('❌ No exchange rates available for sniper check');
    return;
  }

  // For USD, market rate is always 1.0 - better to hardcode than to call the api (i guess)
  const marketRate = currencyCode === 'USD' ? 1.0 : exchangeRates[currencyCode];
  if (!marketRate) {
    console.log(`❌ No market rate found for ${currencyCode}`);
    return;
  }

  // Calculate rates
  const depositRate = Number(conversionRate) / 1e18; // Convert from wei
  const percentageDiff = ((marketRate - depositRate) / marketRate) * 100;

  console.log(`📊 Market rate: ${marketRate} ${currencyCode}/USD`);
  console.log(`📊 Deposit rate: ${depositRate} ${currencyCode}/USD`);
  console.log(`📊 Percentage difference: ${percentageDiff.toFixed(2)}%`);

  // Get users with their custom thresholds and check each one individually
  const interestedUsers = await db.getUsersWithSniper(currencyCode, platformName);

  if (!interestedUsers.includes(ZKP2P_GROUP_ID)) {
    interestedUsers.push(ZKP2P_GROUP_ID);
  }

  if (interestedUsers.length > 0) {
    console.log(`🎯 Checking thresholds for ${interestedUsers.length} potential users`);

    for (const chatId of interestedUsers) {
      const userThreshold = await db.getUserThreshold(chatId);

      if (percentageDiff >= userThreshold) {
        console.log(`🎯 SNIPER OPPORTUNITY for user ${chatId}! ${percentageDiff.toFixed(2)}% >= ${userThreshold}%`);

        const formattedAmount = (Number(depositAmount) / 1e6).toFixed(2);
        const message = `
🎯 *SNIPER ALERT - ${currencyCode}*
🏦 *Platform:* ${platformName}
📊 New Deposit #${depositId}: ${formattedAmount} USDC
💰 Deposit Rate: ${depositRate.toFixed(4)} ${currencyCode}/USD
📈 Market Rate: ${marketRate.toFixed(4)} ${currencyCode}/USD  
🔥 ${percentageDiff.toFixed(1)}% BETTER than market!

💵 *If you filled this entire order:*
- You'd pay: ${(Number(depositAmount) / 1e6 * depositRate).toFixed(2)} ${currencyCode}
- Market cost: ${(Number(depositAmount) / 1e6 * marketRate).toFixed(2)} ${currencyCode}
- **You save: ${((Number(depositAmount) / 1e6) * (marketRate - depositRate)).toFixed(2)} ${currencyCode}**

*You get ${currencyCode} at ${percentageDiff.toFixed(1)}% discount on ${platformName}!*
`.trim();

        await db.logSniperAlert(chatId, depositId, currencyCode, depositRate, marketRate, percentageDiff);

        const sendOptions = {
          parse_mode: 'Markdown',
          reply_markup: {
            inline_keyboard: [[
              {
                text: `🔗 Snipe Deposit ${depositId}`,
                url: depositLink(depositId)
              }
            ]]
          }
        };

        // Send sniper messages to the sniper topic
        if (chatId === ZKP2P_GROUP_ID) {
          sendOptions.message_thread_id = ZKP2P_SNIPER_TOPIC_ID;
        }

        bot.sendMessage(chatId, message, sendOptions);
      } else {
        console.log(`📊 No opportunity for user ${chatId}: ${percentageDiff.toFixed(2)}% < ${userThreshold}%`);
      }
    }
  } else {
    console.log(`📊 No users interested in sniping ${currencyCode} on ${platformName}`);
  }
}

module.exports = {
  checkSniperOpportunity,
  storeDepositAmountInMemory,
  getDepositAmountFromMemory
};