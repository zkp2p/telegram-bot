const { registerDepositCommands } = require('./deposit');
const { registerGeneralCommands } = require('./general');

function registerAllCommands(bot, resilientProvider) {
  registerDepositCommands(bot);
  registerGeneralCommands(bot, resilientProvider);
}

module.exports = {
  registerAllCommands,
  registerDepositCommands,
  registerGeneralCommands
};