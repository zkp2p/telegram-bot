const { db } = require('../../database');
const { parseDepositIds } = require('../../utils');
const { initUserMiddleware } = require('../middleware/userInit');

function registerDepositCommands(bot) {
  bot.onText(/\/deposit (.+)/, async (msg, match) => {
    const chatId = msg.chat.id;
    const input = match[1].trim().toLowerCase();

    // Initialize user
    await initUserMiddleware(msg);

    if (input === 'all') {
      await db.setUserListenAll(chatId, true);
      bot.sendMessage(chatId, `🌍 *Now listening to ALL deposits!*\n\nYou will receive notifications for every event on every deposit.\n\nUse \`/deposit stop\` to stop listening to all deposits.`, { parse_mode: 'Markdown' });
      return;
    }

    if (input === 'stop') {
      await db.setUserListenAll(chatId, false);
      bot.sendMessage(chatId, `🛑 *Stopped listening to all deposits.*\n\nYou will now only receive notifications for specifically tracked deposits.`, { parse_mode: 'Markdown' });
      return;
    }

    const newIds = parseDepositIds(input);

    if (newIds.length === 0) {
      bot.sendMessage(chatId, `❌ No valid deposit IDs provided. Use:\n• \`/deposit all\` - Listen to all deposits\n• \`/deposit 123\` - Track specific deposit\n• \`/deposit 123,456,789\` - Track multiple deposits`, { parse_mode: 'Markdown' });
      return;
    }

    for (const id of newIds) {
      await db.addUserDeposit(chatId, id);
    }

    const userDeposits = await db.getUserDeposits(chatId);
    const idsArray = Array.from(userDeposits).sort((a, b) => a - b);
    bot.sendMessage(chatId, `✅ Now tracking deposit IDs: \`${idsArray.join(', ')}\``, { parse_mode: 'Markdown' });
  });

  bot.onText(/\/remove (.+)/, async (msg, match) => {
    const chatId = msg.chat.id;
    const idsString = match[1];
    const idsToRemove = parseDepositIds(idsString);

    if (idsToRemove.length === 0) {
      bot.sendMessage(chatId, `❌ No valid deposit IDs provided. Use: /remove 123 or /remove 123,456,789`, { parse_mode: 'Markdown' });
      return;
    }

    for (const id of idsToRemove) {
      await db.removeUserDeposit(chatId, id);
    }

    const userDeposits = await db.getUserDeposits(chatId);
    const remainingIds = Array.from(userDeposits).sort((a, b) => a - b);

    if (remainingIds.length > 0) {
      bot.sendMessage(chatId, `✅ Removed specified IDs. Still tracking: \`${remainingIds.join(', ')}\``, { parse_mode: 'Markdown' });
    } else {
      bot.sendMessage(chatId, `✅ Removed specified IDs. No deposits being tracked.`, { parse_mode: 'Markdown' });
    }
  });
}

module.exports = {
  registerDepositCommands
};