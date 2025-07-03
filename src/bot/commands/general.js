const { db, supabase } = require('../../database');

function registerGeneralCommands(bot, resilientProvider) {
  bot.onText(/\/list/, async (msg) => {
    const chatId = msg.chat.id;
    const userDeposits = await db.getUserDeposits(chatId);
    const userStates = await db.getUserDepositStates(chatId);
    const listeningAll = await db.getUserListenAll(chatId);
    const snipers = await db.getUserSnipers(chatId);

    let message = '';

    if (listeningAll) {
      message += `🌍 *Listening to ALL deposits*\n\n`;
    }

    if (snipers.length > 0) {
      message += `🎯 *Active Snipers:*\n`;
      snipers.forEach(sniper => {
        const platformText = sniper.platform ? ` on ${sniper.platform}` : ' (all platforms)';
        message += `• ${sniper.currency}${platformText}\n`;
      });
      message += `\n`;
    }

    const idsArray = Array.from(userDeposits).sort((a, b) => a - b);
    if (idsArray.length === 0 && !listeningAll && snipers.length === 0) {
      bot.sendMessage(chatId, `📋 No deposits currently being tracked and no snipers set.`, { parse_mode: 'Markdown' });
      return;
    }

    if (idsArray.length > 0) {
      message += `📋 *Specifically tracking ${idsArray.length} deposits:*\n\n`;
      idsArray.forEach(id => {
        const state = userStates.get(id);
        const status = state ? state.status : 'tracking';
        const emoji = status === 'fulfilled' ? '✅' :
          status === 'pruned' ? '🟠' : '👀';
        message += `${emoji} \`${id}\` - ${status}\n`;
      });
    }

    bot.sendMessage(chatId, message, { parse_mode: 'Markdown' });
  });

  bot.onText(/\/clearall/, async (msg) => {
    const chatId = msg.chat.id;
    await db.clearUserData(chatId);
    bot.sendMessage(chatId, `🗑️ Cleared all tracked deposit IDs, stopped listening to all deposits, and cleared all sniper settings.`, { parse_mode: 'Markdown' });
  });

  bot.onText(/\/status/, async (msg) => {
    const chatId = msg.chat.id;

    try {
      const wsConnected = resilientProvider?.isConnected || false;
      const wsStatus = wsConnected ? '🟢 Connected' : '🔴 Disconnected';

      // Test database connection
      let dbStatus = '🔴 Disconnected';
      try {
        const { data, error } = await supabase.from('users').select('chat_id').limit(1);
        if (!error) dbStatus = '🟢 Connected';
      } catch (error) {
        console.error('Database test failed:', error);
      }

      // Test Telegram connection
      let botStatus = '🔴 Disconnected';
      try {
        await bot.getMe();
        botStatus = '🟢 Connected';
      } catch (error) {
        console.error('Bot test failed:', error);
      }

      const listeningAll = await db.getUserListenAll(chatId);
      const trackedCount = (await db.getUserDeposits(chatId)).size;
      const snipers = await db.getUserSnipers(chatId);

      let message = `🔧 *System Status:*\n\n`;
      message += `• *WebSocket:* ${wsStatus}\n`;
      message += `• *Database:* ${dbStatus}\n`;
      message += `• *Telegram:* ${botStatus}\n\n`;
      message += `📊 *Your Settings:*\n`;

      if (listeningAll) {
        message += `• *Listening to:* ALL deposits\n`;
      } else {
        message += `• *Tracking:* ${trackedCount} specific deposits\n`;
      }

      if (snipers.length > 0) {
        message += `• *Sniping:* `;
        const sniperTexts = snipers.map(sniper => {
          const platformText = sniper.platform ? ` on ${sniper.platform}` : '';
          return `${sniper.currency}${platformText}`;
        });
        message += `${sniperTexts.join(', ')}\n`;
      }

      // Add reconnection info if disconnected
      if (!wsConnected && resilientProvider) {
        message += `\n⚠️ *WebSocket reconnection attempts:* ${resilientProvider.reconnectAttempts}/${resilientProvider.maxReconnectAttempts}`;
      }

      bot.sendMessage(chatId, message, { parse_mode: 'Markdown' });

    } catch (error) {
      console.error('Status command failed:', error);
      bot.sendMessage(chatId, '❌ Failed to get status', { parse_mode: 'Markdown' });
    }
  });

  // Handle /start command - show help
  bot.onText(/\/start/, (msg) => {
    const chatId = msg.chat.id;
    const helpMessage = `
🤖 *ZKP2P Tracker Commands:*

**Deposit Tracking:**
- \`/deposit all\` - Listen to ALL deposits (every event)
- \`/deposit stop\` - Stop listening to all deposits
- \`/deposit 123\` - Track a specific deposit
- \`/deposit 123,456,789\` - Track multiple deposits
- \`/remove 123\` - Stop tracking specific deposit(s)

**Sniper (Arbitrage Alerts):**
- \`/sniper eur\` - Snipe EUR on ALL platforms
- \`/sniper eur revolut\` - Snipe EUR only on Revolut
- \`/sniper usd zelle\` - Snipe USD only on Zelle
- \`/sniper threshold 0.5\` - Set your alert threshold to 0.5%
- \`/sniper list\` - Show active sniper settings
- \`/sniper clear\` - Clear all sniper settings
- \`/unsnipe eur\` - Stop sniping EUR (all platforms)
- \`/unsnipe eur wise\` - Stop sniping EUR on Wise only

**General:**
- \`/list\` - Show all tracking status (deposits + snipers)
- \`/clearall\` - Stop all tracking and clear everything
- \`/status\` - Check WebSocket connection and settings
- \`/help\` - Show this help message

*Note: Each user has their own settings. Sniper alerts you when deposits offer better exchange rates than market!*
`.trim();

    bot.sendMessage(chatId, helpMessage, { parse_mode: 'Markdown' });
  });

  bot.onText(/\/help/, (msg) => {
    const chatId = msg.chat.id;
    const helpMessage = `
🤖 *ZKP2P Tracker Commands:*

**Deposit Tracking:**
• \`/deposit all\` - Listen to ALL deposits (every event)
• \`/deposit stop\` - Stop listening to all deposits
• \`/deposit 123\` - Track a specific deposit
• \`/deposit 123,456,789\` - Track multiple deposits
• \`/remove 123\` - Stop tracking specific deposit(s)

**Sniper (Arbitrage Alerts):**
- \`/sniper eur\` - Snipe EUR on ALL platforms
- \`/sniper eur revolut\` - Snipe EUR only on Revolut
- \`/sniper usd zelle\` - Snipe USD only on Zelle
- \`/sniper threshold 0.5\` - Set your alert threshold to 0.5%
- \`/sniper list\` - Show active sniper settings
- \`/sniper clear\` - Clear all sniper settings
- \`/unsnipe eur\` - Stop sniping EUR (all platforms)
- \`/unsnipe eur wise\` - Stop sniping EUR on Wise only

**General:**
• \`/list\` - Show all tracking status (deposits + snipers)
• \`/clearall\` - Stop all tracking and clear everything
• \`/status\` - Check WebSocket connection and settings
• \`/help\` - Show this help message

*Note: Each user has their own settings. Sniper alerts you when deposits offer better exchange rates than market!*
`.trim();

    bot.sendMessage(chatId, helpMessage, { parse_mode: 'Markdown' });
  });
}

module.exports = {
  registerGeneralCommands
};