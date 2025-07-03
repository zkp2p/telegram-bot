const { db } = require('../../database');

// Middleware to initialize user before processing commands
async function initUserMiddleware(msg) {
  const chatId = msg.chat.id;
  const username = msg.from?.username;
  const firstName = msg.from?.first_name;
  const lastName = msg.from?.last_name;

  await db.initUser(chatId, username, firstName, lastName);
}

module.exports = {
  initUserMiddleware
};