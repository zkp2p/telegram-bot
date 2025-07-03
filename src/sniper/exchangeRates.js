const config = require('../config');

// Exchange rate fetcher
let exchangeRatesCache = null;
let lastRatesFetch = 0;

async function getExchangeRates() {
  const now = Date.now();

  // Return cached rates if still fresh
  if (exchangeRatesCache && (now - lastRatesFetch) < config.RATES_CACHE_DURATION) {
    return exchangeRatesCache;
  }

  try {
    const response = await fetch(config.EXCHANGE_API_URL);
    const data = await response.json();

    if (data.result === 'success') {
      exchangeRatesCache = data.conversion_rates;
      lastRatesFetch = now;
      console.log('📊 Exchange rates updated');
      return exchangeRatesCache;
    } else {
      console.error('❌ Exchange API error:', data);
      return null;
    }
  } catch (error) {
    console.error('❌ Failed to fetch exchange rates:', error);
    return null;
  }
}

module.exports = {
  getExchangeRates
};