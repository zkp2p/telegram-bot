const { CURRENCY_HASH_TO_CODE, VERIFIER_MAPPING } = require('../config/constants');

// Helper functions
const formatUSDC = (amount) => (Number(amount) / 1e6).toFixed(2);
const formatTimestamp = (ts) => new Date(Number(ts) * 1000).toUTCString();
const txLink = (hash) => `https://basescan.org/tx/${hash}`;
const depositLink = (id) => `https://www.zkp2p.xyz/deposit/${id}`;

const getFiatCode = (hash) => CURRENCY_HASH_TO_CODE[hash.toLowerCase()] || '❓ Unknown';

const formatConversionRate = (conversionRate, fiatCode) => {
  const rate = (Number(conversionRate) / 1e18).toFixed(6);
  return `${rate} ${fiatCode} / USDC`;
};

const getPlatformName = (verifierAddress) => {
  const mapping = VERIFIER_MAPPING[verifierAddress.toLowerCase()];
  return mapping ? mapping.platform : `Unknown (${verifierAddress.slice(0, 6)}...${verifierAddress.slice(-4)})`;
};

module.exports = {
  formatUSDC,
  formatTimestamp,
  txLink,
  depositLink,
  getFiatCode,
  formatConversionRate,
  getPlatformName
};