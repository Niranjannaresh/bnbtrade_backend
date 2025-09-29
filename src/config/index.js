require('dotenv').config();

module.exports = {
  binance: {
    apiKey: process.env.BINANCE_API_KEY,
    apiSecret: process.env.BINANCE_API_SECRET,
    baseUrl: 'https://api.binance.com'
  }
};
