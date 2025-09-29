// Required modules and initialization
const express = require("express");
const http = require("http");
const cors = require("cors");
const { Server } = require("socket.io");
const axios = require("axios");
const Binance = require("node-binance-api");
const { RSI, EMA, MACD, BollingerBands, ATR, Stochastic } = require("technicalindicators");

require('dotenv').config();

const app = express();
app.use(express.json());
app.use(cors());

const server = http.createServer(app);
const io = new Server(server, { cors: { origin: "*" } });

const binance = new Binance().options({
  APIKEY: process.env.BINANCE_API_KEY,
  APISECRET: process.env.BINANCE_API_SECRET,
  useServerTime: true,
  recvWindow: 60000,
  verbose: false,
});

// State
let botActive = false;
let tradeHistory = [];
let insertedAmount = 0;
let dailyTradeCount = 0;
let dailyPnL = 0;
let currentPosition = null;
let isProcessingTrade = false;

const STRATEGY_CONFIG = {
  TARGET_PROFIT_PERCENT: 0.5,
  STOP_LOSS_PERCENT: 0.3,
  MAX_TRADES_PER_DAY: 5,
  TIMEFRAMES: ["1m", "3m", "5m"],
  REQUIRED_SIGNAL_STRENGTH: 2,
  VOLUME_MULTIPLIER: 1.2,
  MIN_TRADE_AMOUNT: 50,
  MAX_TRADE_AMOUNT: 1000,
  WHITELISTED_COINS: ["BTCUSDT", "ETHUSDT", "BNBUSDT", "ADAUSDT", "SOLUSDT", "XRPUSDT", "DOTUSDT", "DOGEUSDT"]
};

let highestPriceSinceEntry = 0;
let tradeStartTime = null;
const userSubscriptions = {};

setInterval(() => {
  dailyTradeCount = 0;
  dailyPnL = 0;
  console.log(`[${new Date().toLocaleString('en-IN')}] Daily trade count and PnL reset`);
}, 24 * 60 * 60 * 1000);

async function validateApiKeys() {
  try {
    console.log(`[${new Date().toLocaleString('en-IN')}] Validating API keys...`);
    const balance = await binance.balance();
    console.log(`[${new Date().toLocaleString('en-IN')}] API Keys are valid!`);
    console.log(`[${new Date().toLocaleString('en-IN')}] USDT Balance:`, balance.USDT?.available || "0");
    return true;
  } catch (error) {
    console.error(`[${new Date().toLocaleString('en-IN')}] API Key Validation Failed:`, error.message);
    return false;
  }
}

function validateLiveTradeRequest(coin, amount) {
  if (!STRATEGY_CONFIG.WHITELISTED_COINS.includes(coin)) {
    throw new Error(`${coin} is not whitelisted for trading. Allowed: ${STRATEGY_CONFIG.WHITELISTED_COINS.join(', ')}`);
  }
  if (amount < STRATEGY_CONFIG.MIN_TRADE_AMOUNT) {
    throw new Error(`Minimum trade amount is $${STRATEGY_CONFIG.MIN_TRADE_AMOUNT}`);
  }
  if (amount > STRATEGY_CONFIG.MAX_TRADE_AMOUNT) {
    throw new Error(`Maximum trade amount is $${STRATEGY_CONFIG.MAX_TRADE_AMOUNT}`);
  }
  return true;
}

async function getKlines(symbol, interval = "1m", limit = 100) {
  try {
    const res = await axios.get(
      "https://api.binance.com/api/v3/klines",
      { params: { symbol, interval, limit } }
    );
    return res.data;
  } catch {
    return [];
  }
}

async function getCurrentPrice(coin) {
  const ticker = await binance.prices(coin);
  return parseFloat(ticker[coin]);
}

function calculateRSI(closes, period = 14) {
  return RSI.calculate({ values: closes, period });
}
function calculateEMA(closes, period) {
  return EMA.calculate({ values: closes, period });
}
function calculateMACD(closes) {
  return MACD.calculate({
    values: closes,
    fastPeriod: 12,
    slowPeriod: 26,
    signalPeriod: 9,
    SimpleMAOscillator: false,
    SimpleMASignal: false,
  });
}
function calculateBollingerBands(closes) {
  return BollingerBands.calculate({
    period: 20,
    values: closes,
    stdDev: 2,
  });
}
function calculateStochastic(highs, lows, closes, period, signalPeriod) {
  return Stochastic.calculate({
    high: highs,
    low: lows,
    close: closes,
    period,
    signalPeriod
  });
}

// ---- VWAP Calculation ----
function calculateVWAP(klines, window = 20) {
  let tpvSum = 0, volSum = 0;
  for (let i = klines.length - window; i < klines.length; i++) {
    if (i < 0) continue;
    const [ , , high, low, close, volume ] = klines[i];
    const typical = (parseFloat(high) + parseFloat(low) + parseFloat(close)) / 3;
    const vol = parseFloat(volume);
    tpvSum += typical * vol;
    volSum += vol;
  }
  return volSum > 0 ? tpvSum / volSum : null;
}

// ---- NEW SCALPING SIGNAL (5m chart, EMA9/21, VWAP, RSI14, Volume) ----
async function getScalpingSignal(symbol) {
  const klines = await getKlines(symbol, "5m", 50);
  if (klines.length < 21) return { action: "hold", reason: "Not enough data" };
  const closes = klines.map(k => parseFloat(k[4]));
  const highs = klines.map(k => parseFloat(k[2]));
  const lows = klines.map(k => parseFloat(k[3]));
  const volumes = klines.map(k => parseFloat(k[5]));

  const ema9 = calculateEMA(closes, 9);
  const ema21 = calculateEMA(closes, 21);
  const rsiArr = calculateRSI(closes, 14);
  const vwap = calculateVWAP(klines, 20);

  if (!ema9.length || !ema21.length || !rsiArr.length || !vwap) {
    return { action: "hold", reason: "Indicators incomplete" };
  }
  const idx = closes.length - 1;
  const price = closes[idx];
  const ema9Val = ema9[ema9.length - 1];
  const ema21Val = ema21[ema21.length - 1];
  const rsi = rsiArr[rsiArr.length - 1];
  const prevVol = volumes[volumes.length - 2];
  const currVol = volumes[volumes.length - 1];

  // Entry conditions
  const isUptrend = price > vwap && ema9Val > ema21Val;
  const rsiOk = rsi >= 40 && rsi <= 65;
  const greenCandle = closes[idx] > klines[idx][1];
  const volumeUp = currVol > prevVol;
  const nearEMA9 = Math.abs(price - ema9Val) / ema9Val < 0.0015;
  const nearEMA21 = Math.abs(price - ema21Val) / ema21Val < 0.0015;

  if (isUptrend && rsiOk && greenCandle && volumeUp && (nearEMA9 || nearEMA21)) {
    return {
      action: "buy",
      reason: `EMA9 > EMA21, price > VWAP, RSI ${rsi.toFixed(2)}, Vol: ${currVol}`
    };
  }

  if (currentPosition && price < ema21Val) {
    return {
      action: "sell",
      reason: "Breakdown EMA21 - exit signal"
    };
  }
  return { action: "hold", reason: "No entry or exit setup" };
}

// ---- Your original multi-timeframe strategy, unchanged ----
async function getAllMarketSignal(symbol) {
  let signals = [];
  let totalStrength = 0;
  for (const timeframe of STRATEGY_CONFIG.TIMEFRAMES) {
    const klines = await getKlines(symbol, timeframe, 50);
    if (!klines.length) continue;
    const closes = klines.map(k => parseFloat(k[4]));
    const highs = klines.map(k => parseFloat(k[2]));
    const lows = klines.map(k => parseFloat(k[3]));
    const volumes = klines.map(k => parseFloat(k[5]));
    const rsi = calculateRSI(closes, 14);
    const emaFast = calculateEMA(closes, 9);
    const emaSlow = calculateEMA(closes, 21);
    const macd = calculateMACD(closes);
    const bb = calculateBollingerBands(closes);

    const volumeAvg = volumes.slice(-20).reduce((a, b) => a + b, 0) / 20;
    const currentVolume = volumes[volumes.length - 1];
    const volumeRatio = currentVolume / volumeAvg;

    if (!rsi.length || !emaFast.length || !emaSlow.length || !macd.length || !bb.length) continue;

    const currentRsi = rsi[rsi.length - 1];
    const currentEmaFast = emaFast[emaFast.length - 1];
    const currentEmaSlow = emaSlow[emaSlow.length - 1];
    const prevEmaFast = emaFast[emaFast.length - 2];
    const prevEmaSlow = emaSlow[emaSlow.length - 2];
    const currentMacd = macd[macd.length - 1];
    const prevMacd = macd[macd.length - 2];
    const currentBb = bb[bb.length - 1];
    const price = closes[closes.length - 1];

    let signalStrength = 0;
    let signalDirection = "hold";
    if (currentRsi < 35 && volumeRatio > STRATEGY_CONFIG.VOLUME_MULTIPLIER) { signalStrength += 1; }
    if (currentEmaFast > currentEmaSlow && prevEmaFast <= prevEmaSlow) { signalStrength += 1; }
    if (currentMacd && prevMacd && currentMacd.histogram > 0 && prevMacd.histogram <= 0) { signalStrength += 1; }
    if (price < currentBb.lower && volumeRatio > STRATEGY_CONFIG.VOLUME_MULTIPLIER) { signalStrength += 1; }
    if (currentRsi > 65 && volumeRatio > STRATEGY_CONFIG.VOLUME_MULTIPLIER) { signalStrength -= 1; }
    if (currentEmaFast < currentEmaSlow && prevEmaFast >= prevEmaSlow) { signalStrength -= 1; }
    if (currentMacd && prevMacd && currentMacd.histogram < 0 && prevMacd.histogram >= 0) { signalStrength -= 1; }
    if (price > currentBb.upper && volumeRatio > STRATEGY_CONFIG.VOLUME_MULTIPLIER) { signalStrength -= 1; }

    if (signalStrength >= 2) { signalDirection = "buy"; }
    else if (signalStrength <= -2) { signalDirection = "sell"; }

    if (signalDirection !== "hold") {
      signals.push({
        timeframe,
        signal: signalDirection,
        strength: Math.abs(signalStrength),
        volumeRatio: parseFloat(volumeRatio.toFixed(2))
      });
      totalStrength += signalStrength;
    }
  }
  const buySignals = signals.filter(s => s.signal === "buy").length;
  const sellSignals = signals.filter(s => s.signal === "sell").length;
  if (buySignals >= STRATEGY_CONFIG.REQUIRED_SIGNAL_STRENGTH && totalStrength > 0) {
    return { action: "buy", reason: `Bullish consensus (${buySignals}/${STRATEGY_CONFIG.TIMEFRAMES.length}), Strength: ${totalStrength}`, strength: totalStrength };
  } else if (sellSignals >= STRATEGY_CONFIG.REQUIRED_SIGNAL_STRENGTH && totalStrength < 0) {
    return { action: "sell", reason: `Bearish consensus (${sellSignals}/${STRATEGY_CONFIG.TIMEFRAMES.length}), Strength: ${Math.abs(totalStrength)}`, strength: Math.abs(totalStrength) };
  }
  return { action: "hold", reason: "No clear signal", strength: 0 };
}

function checkExitConditions(position, currentPrice) {
  if (!position) return { exit: false };
  const entryPrice = position.entryPrice;
  const profitPercent = ((currentPrice - entryPrice) / entryPrice) * 100;
  if (currentPrice > highestPriceSinceEntry) highestPriceSinceEntry = currentPrice;
  if (profitPercent >= STRATEGY_CONFIG.TARGET_PROFIT_PERCENT) {
    return { exit: true, reason: `Target profit reached: ${profitPercent.toFixed(2)}%`, type: "profit" };
  }
  if (profitPercent <= -STRATEGY_CONFIG.STOP_LOSS_PERCENT) {
    return { exit: true, reason: `Stop loss triggered: ${profitPercent.toFixed(2)}%`, type: "stop_loss" };
  }
  if (tradeStartTime && (Date.now() - tradeStartTime) > 30 * 60 * 1000) {
    return { exit: true, reason: `Trade timeout (30 minutes), PnL: ${profitPercent.toFixed(2)}%`, type: "timeout" };
  }
  return { exit: false };
}
async function formatQuantity(coin, quantity) {
  try {
    const symbolInfo = await binance.exchangeInfo();
    const coinInfo = symbolInfo.symbols.find(s => s.symbol === coin);
    if (!coinInfo) { throw new Error(`Symbol ${coin} not found`); }
    const lotSizeFilter = coinInfo.filters.find(f => f.filterType === 'LOT_SIZE');
    if (!lotSizeFilter) { throw new Error('LOT_SIZE filter not found'); }
    const minQty = parseFloat(lotSizeFilter.minQty);
    const stepSize = parseFloat(lotSizeFilter.stepSize);
    if (quantity < minQty) {
      const currentPrice = await getCurrentPrice(coin);
      const minDollarAmount = minQty * currentPrice;
      throw new Error(`Quantity ${quantity} is below minimum ${minQty}. Minimum investment: $${minDollarAmount.toFixed(2)}`);
    }
    const precision = Math.log10(1 / stepSize);
    const formatted = (Math.floor(quantity / stepSize) * stepSize).toFixed(precision);
    return formatted;
  } catch (err) {
    throw new Error(`Quantity formatting error: ${err.message}`);
  }
}
function saveTradeToHistory(action, coin, quantity, price, reason, pnlPercent = 0) {
  const trade = {
    action,
    coin,
    quantity: parseFloat(quantity),
    price: parseFloat(price),
    reason,
    pnlPercent: parseFloat(pnlPercent),
    timestamp: new Date().toISOString(),
  };
  tradeHistory.push(trade);
  io.emit("tradeUpdate", trade);
  if (action === "buy") { dailyPnL -= quantity * price; }
  else { dailyPnL += quantity * price; }
  console.log(`[${new Date().toLocaleString('en-IN')}] Trade executed: ${action} ${quantity} ${coin} at ${price}, Reason: ${reason}`);
}
async function executeBuy(coin, usdtAmount) {
  try {
    const currentPrice = await getCurrentPrice(coin);
    let quantity = usdtAmount / currentPrice;
    const formattedQuantity = await formatQuantity(coin, quantity);
    console.log(`[${new Date().toLocaleString('en-IN')}] Placing market buy order for ${formattedQuantity} ${coin}...`);
    const order = await binance.marketBuy(coin, formattedQuantity);
    const executedPrice = parseFloat(order.fills[0].price);
    const executedQuantity = parseFloat(order.fills.reduce((sum, fill) => sum + parseFloat(fill.qty), 0));
    currentPosition = {
      coin,
      entryPrice: executedPrice,
      quantity: executedQuantity,
      entryTime: new Date(),
    };
    highestPriceSinceEntry = executedPrice;
    tradeStartTime = Date.now();
    saveTradeToHistory("buy", coin, executedQuantity, executedPrice, "Buy signal received");
    return { success: true, order, price: executedPrice, quantity: executedQuantity };
  } catch (error) {
    console.error(`[${new Date().toLocaleString('en-IN')}] Buy execution error:`, error);
    return { success: false, error: error.message };
  }
}
async function executeSell(coin, quantity, reason) {
  try {
    const formattedQuantity = await formatQuantity(coin, quantity);
    console.log(`[${new Date().toLocaleString('en-IN')}] Placing market sell order for ${formattedQuantity} ${coin}...`);
    const order = await binance.marketSell(coin, formattedQuantity);
    const executedPrice = parseFloat(order.fills[0].price);
    const executedQuantity = parseFloat(order.fills.reduce((sum, fill) => sum + parseFloat(fill.qty), 0));
    const entryPrice = currentPosition.entryPrice;
    const pnlPercent = ((executedPrice - entryPrice) / entryPrice) * 100;
    saveTradeToHistory("sell", coin, executedQuantity, executedPrice, `${reason} | PnL: ${pnlPercent.toFixed(2)}%`, pnlPercent);
    currentPosition = null;
    highestPriceSinceEntry = 0;
    tradeStartTime = null;
    return { success: true, order, price: executedPrice, quantity: executedQuantity, pnlPercent };
  } catch (error) {
    console.error(`[${new Date().toLocaleString('en-IN')}] Sell execution error:`, error);
    return { success: false, error: error.message };
  }
}

// ---- MAIN TRADING LOOP: supports modes ----
async function runTradingBot(coin, usdtAmount, mode = "all") {
  console.log(`[${new Date().toLocaleString('en-IN')}] Starting trading bot for ${coin} with $${usdtAmount}, mode: ${mode}`);
  while (botActive) {
    try {
      if (isProcessingTrade) { await new Promise(resolve => setTimeout(resolve, 2000)); continue; }
      isProcessingTrade = true;
      if (dailyTradeCount >= STRATEGY_CONFIG.MAX_TRADES_PER_DAY) {
        console.log(`[${new Date().toLocaleString('en-IN')}] Daily trade limit reached. Stopping bot.`);
        botActive = false; break;
      }
      const balances = await binance.balance();
      const usdtBalance = parseFloat(balances.USDT?.available || "0");
      if (usdtBalance < usdtAmount && !currentPosition) {
        console.log(`[${new Date().toLocaleString('en-IN')}] Insufficient balance, stopping bot.`);
        botActive = false; break;
      }

      const currentPrice = await getCurrentPrice(coin);
      if (currentPosition) {
        const exitCheck = checkExitConditions(currentPosition, currentPrice);
        if (exitCheck.exit) {
          console.log(`[${new Date().toLocaleString('en-IN')}] ${exitCheck.reason}`);
          const sellResult = await executeSell(coin, currentPosition.quantity, exitCheck.reason);
          if (sellResult.success) {
            dailyTradeCount++;
            console.log(`[${new Date().toLocaleString('en-IN')}] Sell executed successfully. Daily trades: ${dailyTradeCount}/${STRATEGY_CONFIG.MAX_TRADES_PER_DAY}`);
          }
          await new Promise(resolve => setTimeout(resolve, 5000));
          isProcessingTrade = false;
          continue;
        }
        if (currentPrice > highestPriceSinceEntry) highestPriceSinceEntry = currentPrice;
      }

      let signal = (mode === "scalping")
        ? await getScalpingSignal(coin)
        : await getAllMarketSignal(coin);

      console.log(`[${new Date().toLocaleString('en-IN')}] Signal for ${coin}: ${signal.action} - ${signal.reason}`);
      if (signal.action === "buy" && !currentPosition) {
        const buyResult = await executeBuy(coin, usdtAmount);
        if (buyResult.success) {
          dailyTradeCount++;
          console.log(`[${new Date().toLocaleString('en-IN')}] Buy executed successfully. Daily trades: ${dailyTradeCount}/${STRATEGY_CONFIG.MAX_TRADES_PER_DAY}`);
        }
      } else if (signal.action === "sell" && currentPosition) {
        const sellResult = await executeSell(coin, currentPosition.quantity, signal.reason);
        if (sellResult.success) {
          dailyTradeCount++;
          console.log(`[${new Date().toLocaleString('en-IN')}] Sell executed successfully. Daily trades: ${dailyTradeCount}/${STRATEGY_CONFIG.MAX_TRADES_PER_DAY}`);
        }
      }
      isProcessingTrade = false;
      await new Promise(resolve => setTimeout(resolve, 5000));
    } catch (error) {
      console.error(`[${new Date().toLocaleString('en-IN')}] Error in trading bot:`, error);
      isProcessingTrade = false;
      await new Promise(resolve => setTimeout(resolve, 10000));
    }
  }
  console.log(`[${new Date().toLocaleString('en-IN')}] Trading bot stopped`);
}

// --- Socket.IO real-time user subscription update (UNCHANGED) ---
io.on("connection", socket => {
  console.log(`[${new Date().toLocaleString('en-IN')}] User connected:`, socket.id);
  socket.on("subscribe", (symbols) => { userSubscriptions[socket.id] = symbols; });
  socket.on("disconnect", () => { delete userSubscriptions[socket.id]; });
});
setInterval(async () => {
  const allSymbols = [...new Set(Object.values(userSubscriptions).flat())];
  for (let symbol of allSymbols) {
    try {
      const price = await getCurrentPrice(symbol);
      for (let [id, symbols] of Object.entries(userSubscriptions)) {
        if (symbols.includes(symbol)) {
          io.to(id).emit("priceUpdate", { symbol, price });
        }
      }
    } catch (error) {
      console.error(`[${new Date().toLocaleString('en-IN')}] Error getting price for ${symbol}:`, error);
    }
  }
}, 2000);

// --- REST APIs ---
// Start bot: NEW PARAMETER "mode": "scalping" or "all"
app.post("/start", async (req, res) => { 
  try {
    const isValid = await validateApiKeys();
    if (!isValid) {
      return res.status(400).json({ error: "Invalid API keys. Check console for solutions." });
    }
    const { coin, usdtAmount, mode } = req.body;
    if (!coin || !usdtAmount) {
      return res.status(400).json({ error: "Coin and USDT amount are required" });
    }
    validateLiveTradeRequest(coin, usdtAmount);
    insertedAmount = usdtAmount; 
    console.log(`[${new Date().toLocaleString('en-IN')}] Starting LIVE trading for:`, coin, "with amount:", usdtAmount, "mode:", mode || "all");
    botActive = true; 
    runTradingBot(coin, usdtAmount, mode || "all");
    res.json({ 
      message: "LIVE trading started", 
      coin, 
      usdtAmount,
      mode: mode || "all",
      riskWarning: "You are now trading with real funds!",
      strategy: {
        targetProfit: `${STRATEGY_CONFIG.TARGET_PROFIT_PERCENT}%`,
        stopLoss: `${STRATEGY_CONFIG.STOP_LOSS_PERCENT}%`,
        maxTradesPerDay: STRATEGY_CONFIG.MAX_TRADES_PER_DAY
      }
    }); 
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});
app.post("/stop", (req, res) => { botActive = false; res.json({ message: "Bot stopped" }); });
app.post("/emergency-sell", async (req, res) => {
  if (!currentPosition) { return res.json({ message: "No active position to sell" }); }
  try {
    const sellResult = await executeSell(currentPosition.coin, currentPosition.quantity, "Emergency sell");
    res.json({ message: "Emergency sell executed", result: sellResult });
  } catch (error) {
    res.status(500).json({ error: "Emergency sell failed", details: error.message });
  }
});
app.post("/emergency-stop-all", async (req, res) => {
  botActive = false;
  if (currentPosition) { await executeSell(currentPosition.coin, currentPosition.quantity, "Emergency stop all"); }
  res.json({ message: "All trading stopped emergency" });
});
app.get("/position", (req, res) => {
  if (!currentPosition) { return res.json({ position: null }); }
  res.json({ position: currentPosition, highestPriceSinceEntry });
});
app.get("/history", (req, res) => res.json(tradeHistory));
app.get("/balance", async (req, res) => {
  try {
    const account = await binance.balance();
    const balances = Object.keys(account)
      .filter(asset => parseFloat(account[asset].available) > 0 || parseFloat(account[asset].onOrder) > 0)
      .map(asset => ({
        asset,
        free: account[asset].available,
        locked: account[asset].onOrder
      }));
    res.json(Array.isArray(balances) ? balances : []);
  } catch { res.json([]); }
});
app.get("/stats", (req, res) => {
  res.json({
    dailyTradeCount,
    maxTradesPerDay: STRATEGY_CONFIG.MAX_TRADES_PER_DAY,
    dailyPnL,
    botActive,
    insertedAmount,
    currentPosition,
    strategy: STRATEGY_CONFIG
  });
});

server.listen(8001, () => console.log(`[${new Date().toLocaleString('en-IN')}] Server running on port 8001`));
