const { db } = require('../../database');
const { validateCurrency, validatePlatform } = require('../../utils');
const { CURRENCY_HASH_TO_CODE, SUPPORTED_PLATFORMS } = require('../../config/constants');
const { initUserMiddleware } = require('../middleware/userInit');

function registerSniperCommands(bot) {
  bot.onText(/\/sniper threshold (.+)/, async (msg, match) => {
    const chatId = msg.chat.id;
    const input = match[1].trim();

    await initUserMiddleware(msg);

    const threshold = parseFloat(input);

    if (isNaN(threshold)) {
      bot.sendMessage(chatId, `❌ Invalid threshold. Please provide a number (e.g., 0.5 for 0.5%)`, { parse_mode: 'Markdown' });
      return;
    }

    await db.setUserThreshold(chatId, threshold);

    bot.sendMessage(chatId, `🎯 *Sniper threshold set to ${threshold}%*\n\nYou'll now be alerted when deposits offer rates ${threshold}% or better than market rates.`, { parse_mode: 'Markdown' });
  });

  bot.onText(/\/sniper (?!threshold)(.+)/, async (msg, match) => {
    const chatId = msg.chat.id;
    const input = match[1].trim().toLowerCase();

    await initUserMiddleware(msg);

    if (input === 'list') {
      const snipers = await db.getUserSnipers(chatId);
      if (snipers.length === 0) {
        bot.sendMessage(chatId, `🎯 No sniper currencies set.`, { parse_mode: 'Markdown' });
      } else {
        let message = `🎯 *Active Snipers:*\n\n`;
        snipers.forEach(sniper => {
          const platformText = sniper.platform ? ` on ${sniper.platform}` : ' (all platforms)';
          message += `• ${sniper.currency}${platformText}\n`;
        });
        bot.sendMessage(chatId, message, { parse_mode: 'Markdown' });
      }
      return;
    }

    if (input === 'clear') {
      await db.removeUserSniper(chatId);
      bot.sendMessage(chatId, `🎯 Cleared all sniper settings.`, { parse_mode: 'Markdown' });
      return;
    }

    // Parse input: "eur" or "eur revolut"
    const parts = input.split(' ');
    const currency = parts[0].toUpperCase();
    const platform = parts[1] ? parts[1].toLowerCase() : null;

    const supportedCurrencies = Object.values(CURRENCY_HASH_TO_CODE);

    if (!validateCurrency(currency)) {
      bot.sendMessage(chatId, `❌ Currency '${currency}' not supported.\n\n*Supported currencies:*\n${supportedCurrencies.join(', ')}`, { parse_mode: 'Markdown' });
      return;
    }

    if (platform && !validatePlatform(platform)) {
      bot.sendMessage(chatId, `❌ Platform '${platform}' not supported.\n\n*Supported platforms:*\n${SUPPORTED_PLATFORMS.join(', ')}`, { parse_mode: 'Markdown' });
      return;
    }

    await db.setUserSniper(chatId, currency, platform);

    const platformText = platform ? ` on ${platform}` : ' (all platforms)';
    bot.sendMessage(chatId, `🎯 *Sniper activated for ${currency}${platformText}!*\n\nYou'll be alerted when new deposits offer better rates than market.`, { parse_mode: 'Markdown' });
  });

  bot.onText(/\/unsnipe (.+)/, async (msg, match) => {
    const chatId = msg.chat.id;
    const input = match[1].trim().toLowerCase();

    // Parse input: "eur" or "eur revolut"
    const parts = input.split(' ');
    const currency = parts[0].toUpperCase();
    const platform = parts[1] ? parts[1].toLowerCase() : null;

    await db.removeUserSniper(chatId, currency, platform);

    const platformText = platform ? ` on ${platform}` : ' (all platforms)';
    bot.sendMessage(chatId, `🎯 Stopped sniping ${currency}${platformText}.`, { parse_mode: 'Markdown' });
  });
}

module.exports = {
  registerSniperCommands
};