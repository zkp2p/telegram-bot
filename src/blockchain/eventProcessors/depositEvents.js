const { formatUSDC, txLink, createDepositKeyboard } = require('../../utils');
const { ZKP2P_GROUP_ID, ZKP2P_TOPIC_ID } = require('../../config/constants');

async function handleDepositReceived(parsed, log, db, bot) {
  const { depositId, depositor, token, amount, intentAmountRange } = parsed.args;
  const id = Number(depositId);
  const usdcAmount = Number(amount);

  console.log(`💰 DepositReceived: ${id} with ${formatUSDC(amount)} USDC`);

  // Store the deposit amount for later sniper use
  await db.storeDepositAmount(id, usdcAmount);

  // Check if this deposit is from a samba contract
  const isSambaContract = await db.isSambaContract(depositor);
  if (!isSambaContract) {
    console.log(`🚫 Deposit ${id} not from samba contract ${depositor} - ignoring`);
    return;
  }

  console.log(`✅ Deposit ${id} is from samba contract ${depositor} - processing`);

  // Send notification for new deposits from samba contracts
  const interestedUsers = await db.getUsersInterestedInDeposit(id);
  if (interestedUsers.length > 0) {
    console.log(`📢 Sending new deposit notification to ${interestedUsers.length} users for samba deposit ${id}`);

    const message = `
💰 *New Samba Deposit Created*
• *Deposit ID:* \`${id}\`
• *Contract:* \`${depositor}\`
• *Amount:* ${formatUSDC(amount)} USDC
• *Token:* ${token}
• *Intent Range:* ${intentAmountRange}
• *Block:* ${log.blockNumber}
• *Tx:* [View on BaseScan](${txLink(log.transactionHash)})
`.trim();

    for (const chatId of interestedUsers) {
      const sendOptions = {
        parse_mode: 'Markdown',
        disable_web_page_preview: true,
        reply_markup: createDepositKeyboard(id)
      };
      if (chatId === ZKP2P_GROUP_ID) {
        sendOptions.message_thread_id = ZKP2P_TOPIC_ID;
      }
      bot.sendMessage(chatId, message, sendOptions);
    }
  } else {
    console.log(`🚫 No users interested in deposit ${id} - no notification sent`);
  }
}

async function handleDepositWithdrawn(parsed, log) {
  const { depositId, depositor, amount } = parsed.args;
  const id = Number(depositId);
  const { formatUSDC } = require('../../utils');

  console.log(`💸 DepositWithdrawn: ${formatUSDC(amount)} USDC from deposit ${id} by ${depositor} - ignored`);
}

async function handleDepositClosed(parsed, log) {
  const { depositId, depositor } = parsed.args;
  const id = Number(depositId);

  console.log(`🔒 DepositClosed: deposit ${id} by ${depositor} - ignored`);
}

module.exports = {
  handleDepositReceived,
  handleDepositWithdrawn,
  handleDepositClosed
};