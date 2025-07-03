const { CURRENCY_HASH_TO_CODE, SUPPORTED_PLATFORMS } = require('../config/constants');

const validateEthereumAddress = (address) => {
  return /^0x[a-fA-F0-9]{40}$/.test(address);
};

const validateEmail = (email) => {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
};

const validateCurrency = (currency) => {
  const supportedCurrencies = Object.values(CURRENCY_HASH_TO_CODE);
  return supportedCurrencies.includes(currency.toUpperCase());
};

const validatePlatform = (platform) => {
  return SUPPORTED_PLATFORMS.includes(platform.toLowerCase());
};

const parseDepositIds = (input) => {
  return input.split(/[,\s]+/).map(id => parseInt(id.trim())).filter(id => !isNaN(id));
};

module.exports = {
  validateEthereumAddress,
  validateEmail,
  validateCurrency,
  validatePlatform,
  parseDepositIds
};