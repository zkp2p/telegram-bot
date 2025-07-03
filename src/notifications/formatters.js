const { formatUSDC, formatTimestamp, txLink, getPlatformName, getFiatCode, formatConversionRate } = require('../utils');

function formatFulfilledNotification(rawIntent, txHash, storedDetails) {
  const { depositId, verifier, owner, to, amount, sustainabilityFee, verifierFee, intentHash } = rawIntent;
  const platformName = getPlatformName(verifier);

  let rateText = '';
  if (storedDetails) {
    const fiatCode = getFiatCode(storedDetails.fiatCurrency);
    const formattedRate = formatConversionRate(storedDetails.conversionRate, fiatCode);
    rateText = `\n- *Rate:* ${formattedRate}`;
  }

  return `
🟢 *Order Fulfilled*
- *Deposit ID:* \`${depositId}\`
- *Order ID:* \`${intentHash}\`
- *Platform:* ${platformName}
- *Owner:* \`${owner}\`
- *To:* \`${to}\`
- *Amount:* ${formatUSDC(amount)} USDC${rateText}
- *Sustainability Fee:* ${formatUSDC(sustainabilityFee)} USDC
- *Verifier Fee:* ${formatUSDC(verifierFee)} USDC
- *Tx:* [View on BaseScan](${txLink(txHash)})
`.trim();
}

function formatPrunedNotification(rawIntent, txHash) {
  const { depositId, intentHash } = rawIntent;

  return `
🟠 *Order Cancelled*
- *Deposit ID:* \`${depositId}\`
- *Order ID:* \`${intentHash}\`
- *Tx:* [View on BaseScan](${txLink(txHash)})

*Order was cancelled*
`.trim();
}

function formatDepositReceivedNotification(parsed, log) {
  const { depositId, depositor, token, amount, intentAmountRange } = parsed.args;
  const id = Number(depositId);

  return `
💰 *New Samba Deposit Created*
• *Deposit ID:* \`${id}\`
• *Contract:* \`${depositor}\`
• *Amount:* ${formatUSDC(amount)} USDC
• *Token:* ${token}
• *Intent Range:* ${intentAmountRange}
• *Block:* ${log.blockNumber}
• *Tx:* [View on BaseScan](${txLink(log.transactionHash)})
`.trim();
}

function formatUnrecognizedEventNotification(topicDepositId, log) {
  return `
⚠️ *Unrecognized Event for Deposit*
• *Deposit ID:* \`${topicDepositId}\`
• *Event Signature:* \`${log.topics[0]}\`
• *Block:* ${log.blockNumber}
• *Tx:* [View on BaseScan](${txLink(log.transactionHash)})
`.trim();
}

module.exports = {
  formatFulfilledNotification,
  formatPrunedNotification,
  formatDepositReceivedNotification,
  formatUnrecognizedEventNotification
};