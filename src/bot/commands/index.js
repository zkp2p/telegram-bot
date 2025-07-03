const { registerDepositCommands } = require('./deposit');
const { registerSniperCommands } = require('./sniper');
const { registerGeneralCommands } = require('./general');

function registerAllCommands(bot, resilientProvider) {
  registerDepositCommands(bot);
  registerSniperCommands(bot);
  registerGeneralCommands(bot, resilientProvider);
}

module.exports = {
  registerAllCommands,
  registerDepositCommands,
  registerSniperCommands,
  registerGeneralCommands
};