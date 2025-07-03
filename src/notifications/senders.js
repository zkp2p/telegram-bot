const { ZKP2P_GROUP_ID, ZKP2P_TOPIC_ID } = require('../config/constants');
const { createDepositKeyboard } = require('../utils');

async function sendNotificationToUsers(bot, interestedUsers, message, depositId, options = {}) {
  for (const chatId of interestedUsers) {
    const sendOptions = {
      parse_mode: 'Markdown',
      disable_web_page_preview: true,
      reply_markup: createDepositKeyboard(depositId),
      ...options
    };
    
    if (chatId === ZKP2P_GROUP_ID) {
      sendOptions.message_thread_id = ZKP2P_TOPIC_ID;
    }
    
    bot.sendMessage(chatId, message, sendOptions);
  }
}

async function sendNotificationToUser(bot, chatId, message, depositId, options = {}) {
  const sendOptions = {
    parse_mode: 'Markdown',
    disable_web_page_preview: true,
    reply_markup: createDepositKeyboard(depositId),
    ...options
  };
  
  if (chatId === ZKP2P_GROUP_ID) {
    sendOptions.message_thread_id = ZKP2P_TOPIC_ID;
  }
  
  bot.sendMessage(chatId, message, sendOptions);
}

module.exports = {
  sendNotificationToUsers,
  sendNotificationToUser
};