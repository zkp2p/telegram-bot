const TelegramBot = require('node-telegram-bot-api');
const config = require('../config');
const { db } = require('../database');
const { registerAllCommands } = require('./commands');

async function createBot() {
  const bot = new TelegramBot(config.TELEGRAM_BOT_TOKEN, { polling: true });
  
  return bot;
}

async function initializeBot(bot) {
  try {
    console.log('🔄 Bot initialization starting...');

    // Test Telegram bot connection first
    try {
      const botInfo = await bot.getMe();
      console.log(`🤖 Bot connected: @${botInfo.username} (${botInfo.first_name})`);
    } catch (error) {
      console.error('❌ Failed to connect to Telegram bot:', error.message);
      throw error;
    }

    // Wait for all systems to be ready
    await new Promise(resolve => setTimeout(resolve, 3000));

    console.log('📝 Initializing user in database...');
    await db.initUser(config.ATTESTED_GROUP_ID, 'samba_channel');

    console.log('📝 Setting listen all to true...');
    // await db.setUserListenAll(config.ATTESTED_GROUP_ID, true);
    // await db.setUserThreshold(config.SAMBA_TOPIC_ID, 0.1);

    console.log(`📤 Attempting to send message to topic ${config.ATTESTED_GROUP_ID} in group ${config.SAMBA_TOPIC_ID}`);

    // Test message sending with better error handling
    const result = await bot.sendMessage(config.ATTESTED_GROUP_ID, '🤖 Samba Bot is online!', {
      message_thread_id: config.SAMBA_TOPIC_ID,
      parse_mode: 'Markdown',
    });

    console.log('✅ Initialization message sent successfully!');
    console.log('📋 Message details:', {
      message_id: result.message_id,
      chat_id: result.chat.id,
      thread_id: result.message_thread_id,
      is_topic_message: result.is_topic_message
    });

  } catch (err) {
    console.error('❌ Bot initialization failed:', err);
    console.error('❌ Error code:', err.code);
    console.error('❌ Error message:', err.message);

    if (err.response?.body) {
      console.error('❌ Telegram API response:', JSON.stringify(err.response.body, null, 2));
    }

    // Schedule retry
    console.log('🔄 Retrying initialization in 30 seconds...');
    setTimeout(() => initializeBot(bot), 30000);
  }
}

module.exports = {
  createBot,
  initializeBot,
  registerAllCommands
};