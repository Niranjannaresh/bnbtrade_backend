const axios = require("axios");
const crypto = require("crypto");
const { binance } = require("../config");

// Helper to get Binance server time
async function getServerTime() {
  const url = `${binance.baseUrl}/api/v3/time`;
  const response = await axios.get(url);
  return response.data.serverTime;
}

async function getPrice(symbol) {
  const url = `${binance.baseUrl}/api/v3/ticker/price?symbol=${symbol}`;
  const response = await axios.get(url);
  return response.data.price;
}

async function getAccountBalances() {
  const endpoint = "/api/v3/account";
  const timestamp = await getServerTime(); // Use Binance server time
  const recvWindow = 60000; // 60 seconds for network tolerance

  const queryString = `timestamp=${timestamp}&recvWindow=${recvWindow}`;
  const signature = crypto
    .createHmac("sha256", binance.apiSecret)
    .update(queryString)
    .digest("hex");

  const url = `${binance.baseUrl}${endpoint}?${queryString}&signature=${signature}`;

  try {
    const response = await axios.get(url, {
      headers: {
        "X-MBX-APIKEY": binance.apiKey,
      },
    });
    return response.data.balances.filter((b) => parseFloat(b.free) > 0);
  } catch (error) {
    console.error(
      "Error fetching balances:",
      error.response?.data || error.message
    );
    return [];
  }
}





// Fetch historical candles
async function getCandles(symbol, interval = '1h', limit = 100) {
  const url = `${binance.baseUrl}/api/v3/klines?symbol=${symbol}&interval=${interval}&limit=${limit}`;
  const response = await axios.get(url);
  return response.data.map(candle => ({
    openTime: candle[0],
    open: parseFloat(candle[1]),
    high: parseFloat(candle[2]),
    low: parseFloat(candle[3]),
    close: parseFloat(candle[4]),
    volume: parseFloat(candle[5])
  }));
}



// Place a market buy order
async function placeMarketBuy(symbol, quantity) {
  const endpoint = '/api/v3/order';
  const timestamp = Date.now();
  const params = `symbol=${symbol}&side=BUY&type=MARKET&quantity=${quantity}&timestamp=${timestamp}`;
  const signature = crypto.createHmac('sha256', binance.apiSecret).update(params).digest('hex');
  const url = `${binance.baseUrl}${endpoint}?${params}&signature=${signature}`;

  try {
    const response = await axios.post(url, null, {
      headers: { 'X-MBX-APIKEY': binance.apiKey }
    });
    return response.data;
  } catch (error) {
    console.error('Order Error:', error.response?.data || error.message);
    return null;
  }
}








module.exports = {
  getPrice,
  getAccountBalances,
  getCandles,
  placeMarketBuy
};
