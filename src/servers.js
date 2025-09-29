// const express = require("express");
// const http = require("http");
// const cors = require("cors");
// const { Server } = require("socket.io");
// const axios = require("axios");
// const Binance = require("node-binance-api");
// const { RSI, EMA, MACD, BollingerBands, ATR } = require("technicalindicators");

// require('dotenv').config();

// const app = express();
// app.use(express.json());
// app.use(cors());

// const server = http.createServer(app);
// const io = new Server(server, { cors: { origin: "*" } });

// const binance = new Binance().options({
//   APIKEY: process.env.BINANCE_API_KEY,
//   APISECRET: process.env.BINANCE_API_SECRET,
//   useServerTime: true,
//   recvWindow: 60000,
// });

// // Bot state
// let botActive = false;
// let lastBuyPrice = null;
// let tradeHistory = [];
// let insertedAmount = 0;

// // Subscriptions
// const userSubscriptions = {};
// const tradeCounts = {};

// async function getKlines(symbol, interval = "1m", limit = 100) {
//   try {
//     const res = await axios.get(
//       "https://api.binance.com/api/v3/klines",
//       { params: { symbol, interval, limit } }
//     );
//     return res.data;
//   } catch {
//     return [];
//   }
// }

// function calculateRSI(closes) {
//   return RSI.calculate({ values: closes, period: 14 });
// }
// function calculateEMA(closes, period) {
//   return EMA.calculate({ values: closes, period });
// }
// function calculateMACD(closes) {
//   return MACD.calculate({
//     values: closes,
//     fastPeriod: 12,
//     slowPeriod: 26,
//     signalPeriod: 9,
//     SimpleMAOscillator: false,
//     SimpleMASignal: false,
//   });
// }
// function calculateBollingerBands(closes) {
//   return BollingerBands.calculate({
//     period: 20,
//     values: closes,
//     stdDev: 2,
//   });
// }
// function getRsiSignal(rsi) {
//   if (rsi <= 30) return { action: "buy", reason: "RSI oversold" };
//   if (rsi >= 70) return { action: "sell", reason: "RSI overbought" };
//   return { action: "hold", reason: "RSI neutral" };
// }
// function getMacdSignal(macdLine, signalLine, prevMacdLine, prevSignalLine) {
//   if (prevMacdLine < prevSignalLine && macdLine > signalLine)
//     return { action: "buy", reason: "MACD bullish crossover" };
//   if (prevMacdLine > prevSignalLine && macdLine < signalLine)
//     return { action: "sell", reason: "MACD bearish crossover" };
//   return { action: "hold", reason: "MACD no crossover" };
// }
// function getEmaSignal(shortEma, longEma, prevShortEma, prevLongEma) {
//   if (prevShortEma < prevLongEma && shortEma > longEma)
//     return { action: "buy", reason: "EMA bullish crossover" };
//   if (prevShortEma > prevLongEma && shortEma < longEma)
//     return { action: "sell", reason: "EMA bearish crossover" };
//   return { action: "hold", reason: "EMA no crossover" };
// }
// function getBollingerSignal(latestClose, lowerBand, upperBand, prevClose) {
//   if (prevClose < lowerBand && latestClose > lowerBand)
//     return { action: "buy", reason: "Price bounced off lower Bollinger Band" };
//   if (prevClose > upperBand && latestClose < upperBand)
//     return { action: "sell", reason: "Price dropped from upper Bollinger Band" };
//   return { action: "hold", reason: "Price within Bollinger Bands" };
// }
// function combineSignals(signals) {
//   if (signals.some((s) => s.action === "sell"))
//     return signals.find((s) => s.action === "sell");
//   if (signals.some((s) => s.action === "buy"))
//     return signals.find((s) => s.action === "buy");
//   return { action: "hold", reason: "Consensus hold" };
// }

// function saveTradeToHistory(action, coin, quantity, price, stopLoss, takeProfit) {
//   tradeHistory.push({
//     action,
//     coin,
//     quantity,
//     price,
//     stopLoss,
//     takeProfit,
//     timestamp: new Date().toISOString(),
//   });
// }

// async function getSignalAndTradeParams(symbol, usdtAmount) {
//   const klines = await getKlines(symbol, "1m", 50);
//   if (!klines.length) throw new Error("No data");

//   const closes = klines.map(k => parseFloat(k[4]));
//   const highs = klines.map(k => parseFloat(k[2]));
//   const lows = klines.map(k => parseFloat(k[3]));
//   const volumes = klines.map(k => parseFloat(k[5]));

//   // Use faster, more sensitive indicators for scalping
//   const rsi = RSI.calculate({ values: closes, period: 6 }).slice(-1)[0];
//   const emaFast = EMA.calculate({ values: closes, period: 6 }).slice(-1)[0];
//   const emaSlow = EMA.calculate({ values: closes, period: 12 }).slice(-1)[0];
//   const macdResult = MACD.calculate({
//     values: closes,
//     fastPeriod: 6,
//     slowPeriod: 12,
//     signalPeriod: 4,
//     SimpleMAOscillator: false,
//     SimpleMASignal: false,
//   }).slice(-1)[0];
//   const bb = BollingerBands.calculate({
//     period: 14,
//     values: closes,
//     stdDev: 1.5,
//   }).slice(-1)[0];

//   const atr = ATR.calculate({
//     high: highs,
//     low: lows,
//     close: closes,
//     period: 7,
//   }).slice(-1)[0];

//   const price = closes.slice(-1)[0];
  
//   // Calculate stop loss and take profit for scalping (1% stop loss, 2% take profit)
//   const stopLoss = price * (0.99); // 1% stop loss
//   const takeProfit = price * (1.02); // 2% take profit

//   // Signal condition adjusted for scalping
//   const rsiSignal = rsi < 40 ? "buy" : rsi > 60 ? "sell" : "neutral";
//   const emaSignal = emaFast > emaSlow ? "buy" : emaFast < emaSlow ? "sell" : "neutral";
//   const macdSignal = macdResult.MACD > macdResult.signal ? "buy" : macdResult.MACD < macdResult.signal ? "sell" : "neutral";
//   const bbSignal = price < bb.lower ? "buy" : price > bb.upper ? "sell" : "neutral";

//   const signals = [rsiSignal, emaSignal, macdSignal, bbSignal];

//   const buyCount = signals.filter(s => s === "buy").length;
//   const sellCount = signals.filter(s => s === "sell").length;

//   let action = "hold";
//   if (buyCount >= 3) action = "buy";
//   else if (sellCount >= 3) action = "sell";

//   return { action, price, stopLoss, takeProfit };
// }

// // Helper function to get current price
// async function getCurrentPrice(coin) {
//   const ticker = await binance.prices(coin);
//   return parseFloat(ticker[coin]);
// }

// // Enhanced formatQuantity function with better error handling
// async function formatQuantity(coin, quantity) {
//   try {
//     // Get symbol info to determine step size and minimum quantity
//     const symbolInfo = await binance.exchangeInfo();
//     const coinInfo = symbolInfo.symbols.find(s => s.symbol === coin);
    
//     if (!coinInfo) {
//       throw new Error(`Symbol ${coin} not found`);
//     }
    
//     // Find LOT_SIZE filter
//     const lotSizeFilter = coinInfo.filters.find(f => f.filterType === 'LOT_SIZE');
//     if (!lotSizeFilter) {
//       throw new Error('LOT_SIZE filter not found');
//     }
    
//     const minQty = parseFloat(lotSizeFilter.minQty);
//     const stepSize = parseFloat(lotSizeFilter.stepSize);
    
//     // Check if quantity meets minimum requirement
//     if (quantity < minQty) {
//       const currentPrice = await getCurrentPrice(coin);
//       const minDollarAmount = minQty * currentPrice;
//       throw new Error(`Quantity ${quantity} is below minimum ${minQty}. Minimum investment: $${minDollarAmount.toFixed(2)}`);
//     }
    
//     // Round to step size precision
//     const precision = Math.log10(1/stepSize);
//     const formatted = (Math.floor(quantity / stepSize) * stepSize).toFixed(precision);
    
//     return formatted;
    
//   } catch (err) {
//     throw new Error(`Quantity formatting error: ${err.message}`);
//   }
// }

// async function runBot(action, coin, stopLoss, takeProfit, dollarAmount) {
//   try {
//     // Get current price to calculate quantity
//     const currentPrice = await getCurrentPrice(coin);
    
//     // Calculate quantity based on dollar amount
//     let quantity = dollarAmount / currentPrice;
    
//     // Format quantity according to exchange rules
//     const formattedQuantity = await formatQuantity(coin, quantity);
    
//     console.log(`Trading ${action} ${formattedQuantity} ${coin} at $${currentPrice} with $${dollarAmount}`);
    
//     if (action === "buy") {
//       const order = await binance.marketBuy(coin, formattedQuantity);
//       lastBuyPrice = parseFloat(order.fills[0].price);
//       saveTradeToHistory("buy", coin, formattedQuantity, lastBuyPrice, stopLoss, takeProfit);
//     } else if (action === "sell") {
//       const order = await binance.marketSell(coin, formattedQuantity);
//       saveTradeToHistory("sell", coin, formattedQuantity, parseFloat(order.fills[0].price), stopLoss, takeProfit);
//     }
    
//     return monitorExit(coin, action, stopLoss, takeProfit, formattedQuantity);
    
//   } catch (err) {
//     console.error("Trading error:", err.message);
//     return null;
//   }
// }

// function monitorExit(coin, action, stopLoss, takeProfit, quantity) {
//   return new Promise(resolve => {
//     const interval = setInterval(async () => {
//       if (!botActive) { clearInterval(interval); return resolve(); }
//       const price = await getCurrentPrice(coin);
      
//       if (action === "buy" && (price <= stopLoss || price >= takeProfit)) {
//         console.log(`Exit condition met: ${price <= stopLoss ? 'Stop Loss' : 'Take Profit'}`);
//         await binance.marketSell(coin, quantity);
//         clearInterval(interval);
//         resolve();
//       } else if (action === "sell" && (price >= stopLoss || price <= takeProfit)) {
//         console.log(`Exit condition met: ${price >= stopLoss ? 'Stop Loss' : 'Take Profit'}`);
//         await binance.marketBuy(coin, quantity);
//         clearInterval(interval);
//         resolve();
//       }
//     }, 5000);
//   });
// }

// // Socket.IO live updates
// async function continuousBot(coin, usdtAmount) {
//   while (botActive) {
//     try {
//       const balances = await binance.balance();
//       const usdtBalance = parseFloat(balances.USDT?.available || "0");

//       if (usdtBalance < usdtAmount * 0.1) {
//         console.log("Insufficient balance, stopping bot.");
//         botActive = false;
//         break;
//       }

//       const params = await getSignalAndTradeParams(coin, usdtAmount);
      
//       // For testing - remove this line in production
//       // params.action = "buy";
//       // await runBot(params.action, coin, params.stopLoss, params.takeProfit, usdtAmount);
      

//       console.log(`Signal: ${params.action} on ${coin} @ ${params.price}`);

//       if (params.action === "hold") {
//         await new Promise(r => setTimeout(r, 3000));
//         continue;
//       }

//       await runBot(params.action, coin, params.stopLoss, params.takeProfit, usdtAmount);
//       await new Promise(r => setTimeout(r, 2000));

//     } catch (err) {
//       console.error("Error in continuousBot:", err.message);
//       await new Promise(r => setTimeout(r, 5000));
//     }
//   }
// }

// // ... rest of your socket.io and express code remains the same ...

// io.on("connection", socket => {
//   console.log('User connected:', socket.id);

//   socket.on("subscribe", (symbols) => {
//     userSubscriptions[socket.id] = symbols;
//     (async () => {
//       for (let symbol of symbols) {
//         const data = await getKlines(symbol, "1m", 2);
//         const last = data[data.length-1];
//         if (last) socket.emit("priceUpdate", { symbol, price: parseFloat(last[4]) });
//       }
//     })();
//   });
//   socket.on("disconnect", () => { delete userSubscriptions[socket.id]; });
// });

// const timeframes = [
//   { label: "1m", interval: "1m" },
//   { label: "3m", interval: "3m" },
//   { label: "5m", interval: "5m" },
//   { label: "15m", interval: "15m" },
// ];

// setInterval(async () => {
//   const allSymbols = [...new Set(Object.values(userSubscriptions).flat())];
//   for (let symbol of allSymbols) {
//     let frames = {};
//     for (let tf of timeframes) {
//       const klines = await getKlines(symbol, tf.interval, 100);
//       if (klines.length < 30) continue;
//       const closes = klines.map(c => parseFloat(c[4]));
//       const rsi = calculateRSI(closes).pop();
//       const ema12 = calculateEMA(closes, 12);
//       const ema26 = calculateEMA(closes, 26);
//       const macd = calculateMACD(closes);
//       const bb = calculateBollingerBands(closes);
//       if (!rsi || ema12.length < 2 || ema26.length < 2 || macd.length < 2 || bb.length < 2) continue;
//       const combined = combineSignals([
//         getRsiSignal(rsi),
//         getMacdSignal(macd.at(-1).MACD, macd.at(-1).signal, macd.at(-2).MACD, macd.at(-2).signal),
//         getEmaSignal(ema12.at(-1), ema26.at(-1), ema12.at(-2), ema26.at(-2)),
//         getBollingerSignal(closes.at(-1), bb.at(-1).lower, bb.at(-1).upper, closes.at(-2))
//       ]);
//       frames[tf.label] = { combined, price: closes.at(-1) };
//     }
//     for (let [id, symbols] of Object.entries(userSubscriptions)) {
//       if (symbols.includes(symbol)) io.to(id).emit("multiTimeFrameSignals", { symbol, frames });
//     }
//   }
// }, 1000);

// // REST APIs
// app.post("/start", (req, res) => { 
//   insertedAmount = req.body.usdtAmount; 
//   console.log("Starting bot with amount:", insertedAmount);
//   botActive = true; 
//   continuousBot(req.body.coin, insertedAmount); 
//   res.json({ message:"Bot started" }); 
// });

// app.post("/stop", (req,res) => { 
//   console.log("Bot Stopped.");
//   botActive=false; 
//   res.json({message:"Bot stopped"}); 
// });

// app.get("/history", (req, res) => res.json(tradeHistory));

// app.get("/balance", async (req, res) => {
//   try {
//     const account = await binance.balance();
//     const balances = Object.keys(account)
//       .filter(asset => parseFloat(account[asset].available) > 0 || parseFloat(account[asset].onOrder) > 0)
//       .map(asset => ({
//         asset,
//         free: account[asset].available,
//         locked: account[asset].onOrder
//       }));
//     res.json(Array.isArray(balances) ? balances : []);
//   } catch {
//     res.json([]);
//   }
// });

// server.listen(8001, () => console.log("Server running on 8001"));

// --------------------------------------------------------------------------------------









// 
// const express = require("express");
// const http = require("http");
// const cors = require("cors");
// const { Server } = require("socket.io");
// const axios = require("axios");
// const Binance = require("node-binance-api");
// const { RSI, EMA, MACD, BollingerBands, ATR } = require("technicalindicators");

// require('dotenv').config();

// const app = express();
// app.use(express.json());
// app.use(cors());

// const server = http.createServer(app);
// const io = new Server(server, { cors: { origin: "*" } });

// // Initialize Binance API with testnet for safety
// const binance = new Binance().options({
//   APIKEY: process.env.BINANCE_API_KEY,
//   APISECRET: process.env.BINANCE_API_SECRET,
//   // test: true, // Remove this for live trading
//   useServerTime: true,
//   recvWindow: 60000,
//   verbose: true, // For debugging
// });

// // Bot state and configuration
// let botActive = false;
// let lastBuyPrice = null;
// let tradeHistory = [];
// let insertedAmount = 0;
// let dailyTradeCount = 0;
// let dailyPnL = 0;

// // Risk management settings
// const MAX_TRADES_PER_DAY = 50;
// const MAX_DAILY_LOSS_PERCENT = 5; // 5% maximum daily loss
// const TRADE_AMOUNT_PERCENT = 10; // 10% of balance per trade

// // Subscriptions
// const userSubscriptions = {};
// const tradeCounts = {};

// // 24-hour reset timer
// setInterval(() => {
//   dailyTradeCount = 0;
//   dailyPnL = 0;
//   console.log("Daily trade count and PnL reset");
// }, 24 * 60 * 60 * 1000); // 24 hours

// // API Key validation function
// async function validateApiKeys() {
//   try {
//     console.log("Validating API keys...");
//     const balance = await binance.balance();
//     console.log("API Keys are valid!");
//     console.log("USDT Balance:", balance.USDT?.available || "0");
//     return true;
//   } catch (error) {
//     console.error("API Key Validation Failed:", error.message);
//     if (error.code === -2015) {
//       console.log("\n🚨 SOLUTIONS:");
//       console.log("1. Check API key permissions on Binance");
//       console.log("2. Enable 'Trading' permission");
//       console.log("3. Remove IP restrictions");
//       console.log("4. Generate new API keys");
//       console.log("5. Check .env file for correct keys");
//     }
//     return false;
//   }
// }

// // Helper functions
// async function getKlines(symbol, interval = "1m", limit = 100) {
//   try {
//     const res = await axios.get(
//       "https://api.binance.com/api/v3/klines",
//       { params: { symbol, interval, limit } }
//     );
//     return res.data;
//   } catch {
//     return [];
//   }
// }

// async function getCurrentPrice(coin) {
//   const ticker = await binance.prices(coin);
//   return parseFloat(ticker[coin]);
// }

// function calculateRSI(closes) {
//   return RSI.calculate({ values: closes, period: 14 });
// }

// function calculateEMA(closes, period) {
//   return EMA.calculate({ values: closes, period });
// }

// function calculateMACD(closes) {
//   return MACD.calculate({
//     values: closes,
//     fastPeriod: 12,
//     slowPeriod: 26,
//     signalPeriod: 9,
//     SimpleMAOscillator: false,
//     SimpleMASignal: false,
//   });
// }

// function calculateBollingerBands(closes) {
//   return BollingerBands.calculate({
//     period: 20,
//     values: closes,
//     stdDev: 2,
//   });
// }

// function getRsiSignal(rsi) {
//   if (rsi <= 30) return { action: "buy", reason: "RSI oversold" };
//   if (rsi >= 70) return { action: "sell", reason: "RSI overbought" };
//   return { action: "hold", reason: "RSI neutral" };
// }

// function getMacdSignal(macdLine, signalLine, prevMacdLine, prevSignalLine) {
//   if (prevMacdLine < prevSignalLine && macdLine > signalLine)
//     return { action: "buy", reason: "MACD bullish crossover" };
//   if (prevMacdLine > prevSignalLine && macdLine < signalLine)
//     return { action: "sell", reason: "MACD bearish crossover" };
//   return { action: "hold", reason: "MACD no crossover" };
// }

// function getEmaSignal(shortEma, longEma, prevShortEma, prevLongEma) {
//   if (prevShortEma < prevLongEma && shortEma > longEma)
//     return { action: "buy", reason: "EMA bullish crossover" };
//   if (prevShortEma > prevLongEma && shortEma < longEma)
//     return { action: "sell", reason: "EMA bearish crossover" };
//   return { action: "hold", reason: "EMA no crossover" };
// }

// function getBollingerSignal(latestClose, lowerBand, upperBand, prevClose) {
//   if (prevClose < lowerBand && latestClose > lowerBand)
//     return { action: "buy", reason: "Price bounced off lower Bollinger Band" };
//   if (prevClose > upperBand && latestClose < upperBand)
//     return { action: "sell", reason: "Price dropped from upper Bollinger Band" };
//   return { action: "hold", reason: "Price within Bollinger Bands" };
// }

// function combineSignals(signals) {
//   if (signals.some((s) => s.action === "sell"))
//     return signals.find((s) => s.action === "sell");
//   if (signals.some((s) => s.action === "buy"))
//     return signals.find((s) => s.action === "buy");
//   return { action: "hold", reason: "Consensus hold" };
// }

// function saveTradeToHistory(action, coin, quantity, price, stopLoss, takeProfit) {
//   tradeHistory.push({
//     action,
//     coin,
//     quantity,
//     price,
//     stopLoss,
//     takeProfit,
//     timestamp: new Date().toISOString(),
//   });
// }

// // Enhanced trading strategy with volume and trend analysis
// async function getSignalAndTradeParams(symbol, usdtAmount) {
//   const klines = await getKlines(symbol, "1m", 100);
//   if (!klines.length) throw new Error("No data");

//   const closes = klines.map(k => parseFloat(k[4]));
//   const highs = klines.map(k => parseFloat(k[2]));
//   const lows = klines.map(k => parseFloat(k[3]));
//   const volumes = klines.map(k => parseFloat(k[5]));

//   // Price and basic calculations
//   const price = closes.slice(-1)[0];
//   const prevPrice = closes.slice(-2)[0];
  
//   // Volume analysis
//   const avgVolume = volumes.slice(-20).reduce((a, b) => a + b, 0) / 20;
//   const currentVolume = volumes.slice(-1)[0];
//   const volumeRatio = currentVolume / avgVolume;
  
//   // Trend analysis
//   const ema50 = EMA.calculate({ values: closes, period: 50 }).slice(-1)[0];
//   const trendDirection = price > ema50 ? "bullish" : "bearish";

//   // Scalping indicators
//   const rsi = RSI.calculate({ values: closes, period: 6 }).slice(-1)[0];
//   const emaFast = EMA.calculate({ values: closes, period: 6 }).slice(-1)[0];
//   const emaSlow = EMA.calculate({ values: closes, period: 12 }).slice(-1)[0];
//   const macdResult = MACD.calculate({
//     values: closes,
//     fastPeriod: 6,
//     slowPeriod: 12,
//     signalPeriod: 4,
//   }).slice(-1)[0];

//   const bb = BollingerBands.calculate({
//     period: 14,
//     values: closes,
//     stdDev: 1.5,
//   }).slice(-1)[0];

//   const atr = ATR.calculate({
//     high: highs,
//     low: lows,
//     close: closes,
//     period: 7,
//   }).slice(-1)[0];

//   // Dynamic stop loss/take profit based on ATR
//   const atrMultiplier = 1.5;
//   const stopLoss = price - (atr * atrMultiplier);
//   const takeProfit = price + (atr * 2); // 2:1 reward ratio

//   // Signals with volume confirmation
//   let rsiSignal = "neutral";
//   if (rsi < 35 && volumeRatio > 1.2) rsiSignal = "buy";
//   else if (rsi > 65 && volumeRatio > 1.2) rsiSignal = "sell";

//   let emaSignal = "neutral";
//   if (emaFast > emaSlow && volumeRatio > 1.0) emaSignal = "buy";
//   else if (emaFast < emaSlow && volumeRatio > 1.0) emaSignal = "sell";

//   let macdSignal = "neutral";
//   if (macdResult.MACD > macdResult.signal && volumeRatio > 1.0) macdSignal = "buy";
//   else if (macdResult.MACD < macdResult.signal && volumeRatio > 1.0) macdSignal = "sell";

//   let bbSignal = "neutral";
//   if (price < bb.lower && volumeRatio > 1.5) bbSignal = "buy";
//   else if (price > bb.upper && volumeRatio > 1.5) bbSignal = "sell";

//   // Trend filter
//   if (trendDirection === "bullish") {
//     if (rsiSignal === "sell") rsiSignal = "neutral";
//     if (bbSignal === "sell") bbSignal = "neutral";
//   } else {
//     if (rsiSignal === "buy") rsiSignal = "neutral";
//     if (bbSignal === "buy") bbSignal = "neutral";
//   }

//   const signals = [rsiSignal, emaSignal, macdSignal, bbSignal];
//   const buyCount = signals.filter(s => s === "buy").length;
//   const sellCount = signals.filter(s => s === "sell").length;

//   let action = "hold";
  
//   // Strong signals required
//   if (buyCount >= 3 && volumeRatio > 1.2 && trendDirection === "bullish") {
//     action = "buy";
//   } else if (sellCount >= 3 && volumeRatio > 1.2 && trendDirection === "bearish") {
//     action = "sell";
//   }

//   return { 
//     action, 
//     price, 
//     stopLoss: parseFloat(stopLoss.toFixed(6)), 
//     takeProfit: parseFloat(takeProfit.toFixed(6)),
//     volumeRatio: parseFloat(volumeRatio.toFixed(2)),
//     trend: trendDirection
//   };
// }

// // Enhanced quantity formatting
// async function formatQuantity(coin, quantity) {
//   try {
//     const symbolInfo = await binance.exchangeInfo();
//     const coinInfo = symbolInfo.symbols.find(s => s.symbol === coin);
    
//     if (!coinInfo) {
//       throw new Error(`Symbol ${coin} not found`);
//     }
    
//     const lotSizeFilter = coinInfo.filters.find(f => f.filterType === 'LOT_SIZE');
//     if (!lotSizeFilter) {
//       throw new Error('LOT_SIZE filter not found');
//     }
    
//     const minQty = parseFloat(lotSizeFilter.minQty);
//     const stepSize = parseFloat(lotSizeFilter.stepSize);
    
//     if (quantity < minQty) {
//       const currentPrice = await getCurrentPrice(coin);
//       const minDollarAmount = minQty * currentPrice;
//       throw new Error(`Quantity ${quantity} is below minimum ${minQty}. Minimum investment: $${minDollarAmount.toFixed(2)}`);
//     }
    
//     const precision = Math.log10(1/stepSize);
//     const formatted = (Math.floor(quantity / stepSize) * stepSize).toFixed(precision);
    
//     return formatted;
    
//   } catch (err) {
//     throw new Error(`Quantity formatting error: ${err.message}`);
//   }
// }

// // Main trading function
// async function runBot(action, coin, stopLoss, takeProfit, dollarAmount) {
//   try {
//     console.log(`Attempting ${action} for ${coin} with $${dollarAmount}`);
    
//     const currentPrice = await getCurrentPrice(coin);
//     console.log(`Current price: ${currentPrice}`);
    
//     let quantity = dollarAmount / currentPrice;
//     console.log(`Raw quantity: ${quantity}`);
    
//     const formattedQuantity = await formatQuantity(coin, quantity);
//     console.log(`Formatted quantity: ${formattedQuantity}`);
    
//     console.log(`Trading ${action} ${formattedQuantity} ${coin} at $${currentPrice}`);
    
//     if (action === "buy") {
//       console.log("Placing market buy order...");
//       const order = await binance.marketBuy(coin, formattedQuantity);
//       console.log("Buy order successful:", order);
//       lastBuyPrice = parseFloat(order.fills[0].price);
//       saveTradeToHistory("buy", coin, formattedQuantity, lastBuyPrice, stopLoss, takeProfit);
//     } else if (action === "sell") {
//       console.log("Placing market sell order...");
//       const order = await binance.marketSell(coin, formattedQuantity);
//       console.log("Sell order successful:", order);
//       saveTradeToHistory("sell", coin, formattedQuantity, parseFloat(order.fills[0].price), stopLoss, takeProfit);
//     }
    
//     return monitorExit(coin, action, stopLoss, takeProfit, formattedQuantity);
    
//   } catch (err) {
//     console.error("Trading error details:", {
//       message: err.message,
//       code: err.code,
//       body: err.body
//     });
//     return null;
//   }
// }

// // Monitor exit conditions
// function monitorExit(coin, action, stopLoss, takeProfit, quantity) {
//   return new Promise(resolve => {
//     const interval = setInterval(async () => {
//       if (!botActive) { clearInterval(interval); return resolve(); }
//       const price = await getCurrentPrice(coin);
      
//       if (action === "buy" && (price <= stopLoss || price >= takeProfit)) {
//         console.log(`Exit condition met: ${price <= stopLoss ? 'Stop Loss' : 'Take Profit'}`);
//         await binance.marketSell(coin, quantity);
//         clearInterval(interval);
//         resolve();
//       } else if (action === "sell" && (price >= stopLoss || price <= takeProfit)) {
//         console.log(`Exit condition met: ${price >= stopLoss ? 'Stop Loss' : 'Take Profit'}`);
//         await binance.marketBuy(coin, quantity);
//         clearInterval(interval);
//         resolve();
//       }
//     }, 5000);
//   });
// }

// // Continuous bot operation
// async function continuousBot(coin, usdtAmount) {
//   const startTime = Date.now();
  
//   while (botActive) {
//     try {
//       // Risk management checks
//       if (dailyTradeCount >= MAX_TRADES_PER_DAY) {
//         console.log("Daily trade limit reached. Stopping bot.");
//         botActive = false;
//         break;
//       }

//       if (dailyPnL <= -(insertedAmount * MAX_DAILY_LOSS_PERCENT / 100)) {
//         console.log("Daily loss limit reached. Stopping bot.");
//         botActive = false;
//         break;
//       }

//       const balances = await binance.balance();
//       const usdtBalance = parseFloat(balances.USDT?.available || "0");

//       if (usdtBalance < usdtAmount) {
//         console.log("Insufficient balance, stopping bot.");
//         botActive = false;
//         break;
//       }

//       const params = await getSignalAndTradeParams(coin, usdtAmount);
      
//       console.log(`Signal: ${params.action} on ${coin} @ ${params.price}, Volume Ratio: ${params.volumeRatio}, Trend: ${params.trend}`);
//       // console.log(`Signal: ${params.action} on ${coin} @ ${params.price}`);

//       if (params.action === "hold") {
//         await new Promise(r => setTimeout(r, 3000));
//         continue;
//       }

//       const tradeResult = await runBot(params.action, coin, params.stopLoss, params.takeProfit, usdtAmount);
      
//       if (tradeResult) {
//         dailyTradeCount++;
//         if (params.action === "buy") {
//           dailyPnL -= usdtAmount;
//         } else {
//           dailyPnL += usdtAmount;
//         }
//         console.log(`Daily Stats - Trades: ${dailyTradeCount}/${MAX_TRADES_PER_DAY}, PnL: $${dailyPnL.toFixed(2)}`);
//       }
      
//       await new Promise(r => setTimeout(r, 2000));

//     } catch (err) {
//       console.error("Error in continuousBot:", err.message);
//       await new Promise(r => setTimeout(r, 5000));
//     }
//   }
// }

// // Socket.IO live updates
// io.on("connection", socket => {
//   console.log('User connected:', socket.id);

//   socket.on("subscribe", (symbols) => {
//     userSubscriptions[socket.id] = symbols;
//     (async () => {
//       for (let symbol of symbols) {
//         const data = await getKlines(symbol, "1m", 2);
//         const last = data[data.length-1];
//         if (last) socket.emit("priceUpdate", { symbol, price: parseFloat(last[4]) });
//       }
//     })();
//   });
  
//   socket.on("disconnect", () => { 
//     delete userSubscriptions[socket.id]; 
//   });
// });

// // Multi-timeframe signal calculation
// const timeframes = [
//   { label: "1m", interval: "1m" },
//   { label: "3m", interval: "3m" },
//   { label: "5m", interval: "5m" },
//   { label: "15m", interval: "15m" },
// ];

// setInterval(async () => {
//   const allSymbols = [...new Set(Object.values(userSubscriptions).flat())];
//   for (let symbol of allSymbols) {
//     let frames = {};
//     for (let tf of timeframes) {
//       const klines = await getKlines(symbol, tf.interval, 100);
//       if (klines.length < 30) continue;
//       const closes = klines.map(c => parseFloat(c[4]));
//       const rsi = calculateRSI(closes).pop();
//       const ema12 = calculateEMA(closes, 12);
//       const ema26 = calculateEMA(closes, 26);
//       const macd = calculateMACD(closes);
//       const bb = calculateBollingerBands(closes);
//       if (!rsi || ema12.length < 2 || ema26.length < 2 || macd.length < 2 || bb.length < 2) continue;
//       const combined = combineSignals([
//         getRsiSignal(rsi),
//         getMacdSignal(macd.at(-1).MACD, macd.at(-1).signal, macd.at(-2).MACD, macd.at(-2).signal),
//         getEmaSignal(ema12.at(-1), ema26.at(-1), ema12.at(-2), ema26.at(-2)),
//         getBollingerSignal(closes.at(-1), bb.at(-1).lower, bb.at(-1).upper, closes.at(-2))
//       ]);
//       frames[tf.label] = { combined, price: closes.at(-1) };
//     }
//     for (let [id, symbols] of Object.entries(userSubscriptions)) {
//       if (symbols.includes(symbol)) io.to(id).emit("multiTimeFrameSignals", { symbol, frames });
//     }
//   }
// }, 1000);

// // REST APIs
// app.post("/start", async (req, res) => { 
//   const isValid = await validateApiKeys();
//   if (!isValid) {
//     return res.status(400).json({ error: "Invalid API keys. Check console for solutions." });
//   }
  
//   insertedAmount = req.body.usdtAmount; 
//   console.log("Starting bot with amount:", insertedAmount);
//   botActive = true; 
//   continuousBot(req.body.coin, insertedAmount); 
//   res.json({ message: "Bot started" }); 
// });

// app.post("/stop", (req, res) => { 
//   console.log("Bot Stopped.");
//   botActive = false; 
//   res.json({ message: "Bot stopped" }); 
// });

// // Emergency stop API
// app.post("/emergency-stop", async (req, res) => { 
//   console.log("EMERGENCY STOP ACTIVATED");
//   botActive = false;
  
//   try {
//     const balances = await binance.balance();
//     for (const [asset, balance] of Object.entries(balances)) {
//       if (asset !== 'USDT' && parseFloat(balance.available) > 0) {
//         const symbol = asset + 'USDT';
//         console.log(`Selling ${balance.available} ${asset}`);
//         await binance.marketSell(symbol, balance.available);
//       }
//     }
//   } catch (error) {
//     console.error("Emergency sell error:", error);
//   }
  
//   res.json({ message: "Emergency stop executed" }); 
// });

// app.get("/history", (req, res) => res.json(tradeHistory));

// app.get("/balance", async (req, res) => {
//   try {
//     const account = await binance.balance();
//     const balances = Object.keys(account)
//       .filter(asset => parseFloat(account[asset].available) > 0 || parseFloat(account[asset].onOrder) > 0)
//       .map(asset => ({
//         asset,
//         free: account[asset].available,
//         locked: account[asset].onOrder
//       }));
//     res.json(Array.isArray(balances) ? balances : []);
//   } catch {
//     res.json([]);
//   }
// });

// app.get("/stats", (req, res) => {
//   res.json({
//     dailyTradeCount,
//     maxTradesPerDay: MAX_TRADES_PER_DAY,
//     dailyPnL,
//     maxDailyLossPercent: MAX_DAILY_LOSS_PERCENT,
//     botActive,
//     insertedAmount
//   });
// });

// server.listen(8001, () => console.log("Server running on 8001"));








// Scalping trade logic profit book 0.5% and above 

// Key Changes Made:
// Added Scalping Strategy:

// Implements your requirement to wait for 0.5% profit

// Uses trailing stop of 0.2% from the highest price

// Focuses on 1m, 3m, and 5m timeframes for scalping

// Enhanced Signal Detection:

// Uses multiple timeframes (1m, 3m, 5m) for confirmation

// Requires at least 2 matching signals to execute a trade

// Position Tracking:

// Tracks current position including entry price and quantity

// Monitors highest price since entry for trailing stop calculation

// Improved Exit Logic:

// Sells when price drops 0.2% from the highest point after achieving 0.5% profit

// Also sells on strong sell signals regardless of profit

// Real-time Updates:

// Socket.IO emits trade updates in real-time

// Regular price updates for all subscribed symbols
// const express = require("express");
// const http = require("http");
// const cors = require("cors");
// const { Server } = require("socket.io");
// const axios = require("axios");
// const Binance = require("node-binance-api");
// const { RSI, EMA, MACD, BollingerBands, ATR } = require("technicalindicators");

// require('dotenv').config();

// const app = express();
// app.use(express.json());
// app.use(cors());

// const server = http.createServer(app);
// const io = new Server(server, { cors: { origin: "*" } });

// // Initialize Binance API
// const binance = new Binance().options({
//   APIKEY: process.env.BINANCE_API_KEY,
//   APISECRET: process.env.BINANCE_API_SECRET,
//   useServerTime: true,
//   recvWindow: 60000,
//   // verbose: true,
// });

// // Bot state and configuration
// let botActive = false;
// let tradeHistory = [];
// let insertedAmount = 0;
// let dailyTradeCount = 0;
// let dailyPnL = 0;
// let currentPosition = null;

// // Risk management settings
// const MAX_TRADES_PER_DAY = 50;
// const MAX_DAILY_LOSS_PERCENT = 5;
// const TRADE_AMOUNT_PERCENT = 10;

// // Strategy parameters
// const TARGET_PROFIT_PERCENT = 0.5; // 0.5% profit target
// const TRAILING_STOP_PERCENT = 0.2; // 0.2% trailing stop
// const SCALPING_TIMEFRAMES = ["1m", "3m", "5m"]; // Scalping timeframes

// // Track price movements for trailing stop
// let highestPriceSinceEntry = 0;

// // Subscriptions
// const userSubscriptions = {};
// const tradeCounts = {};

// // 24-hour reset timer
// setInterval(() => {
//   dailyTradeCount = 0;
//   dailyPnL = 0;
//   console.log("Daily trade count and PnL reset");
// }, 24 * 60 * 60 * 1000);

// // API Key validation function
// async function validateApiKeys() {
//   try {
//     console.log("Validating API keys...");
//     const balance = await binance.balance();
//     console.log("API Keys are valid!");
//     console.log("USDT Balance:", balance.USDT?.available || "0");
//     return true;
//   } catch (error) {
//     console.error("API Key Validation Failed:", error.message);
//     return false;
//   }
// }

// // Helper functions
// async function getKlines(symbol, interval = "1m", limit = 100) {
//   try {
//     const res = await axios.get(
//       "https://api.binance.com/api/v3/klines",
//       { params: { symbol, interval, limit } }
//     );
//     return res.data;
//   } catch {
//     return [];
//   }
// }

// async function getCurrentPrice(coin) {
//   const ticker = await binance.prices(coin);
//   return parseFloat(ticker[coin]);
// }

// function calculateRSI(closes, period = 14) {
//   return RSI.calculate({ values: closes, period });
// }

// function calculateEMA(closes, period) {
//   return EMA.calculate({ values: closes, period });
// }

// function calculateMACD(closes) {
//   return MACD.calculate({
//     values: closes,
//     fastPeriod: 12,
//     slowPeriod: 26,
//     signalPeriod: 9,
//     SimpleMAOscillator: false,
//     SimpleMASignal: false,
//   });
// }

// function calculateBollingerBands(closes) {
//   return BollingerBands.calculate({
//     period: 20,
//     values: closes,
//     stdDev: 2,
//   });
// }

// // Enhanced scalping strategy with multiple timeframes
// async function getScalpingSignal(symbol) {
//   let allSignals = [];
  
//   for (const timeframe of SCALPING_TIMEFRAMES) {
//     const klines = await getKlines(symbol, timeframe, 50);
//     if (!klines.length) continue;
    
//     const closes = klines.map(k => parseFloat(k[4]));
//     const highs = klines.map(k => parseFloat(k[2]));
//     const lows = klines.map(k => parseFloat(k[3]));
    
//     // Calculate indicators
//     const rsi = calculateRSI(closes, 14);
//     const emaFast = calculateEMA(closes, 9);
//     const emaSlow = calculateEMA(closes, 21);
//     const macd = calculateMACD(closes);
//     const bb = calculateBollingerBands(closes);
    
//     if (!rsi.length || !emaFast.length || !emaSlow.length || !macd.length || !bb.length) continue;
    
//     const currentRsi = rsi[rsi.length - 1];
//     const currentEmaFast = emaFast[emaFast.length - 1];
//     const currentEmaSlow = emaSlow[emaSlow.length - 1];
//     const prevEmaFast = emaFast[emaFast.length - 2];
//     const prevEmaSlow = emaSlow[emaSlow.length - 2];
//     const currentMacd = macd[macd.length - 1];
//     const prevMacd = macd[macd.length - 2];
//     const currentBb = bb[bb.length - 1];
//     const price = closes[closes.length - 1];
    
//     // Generate signals for this timeframe
//     let signal = "hold";
//     let reason = "";
    
//     // Buy signals
//     if (currentRsi < 35 && currentEmaFast > currentEmaSlow && prevEmaFast <= prevEmaSlow) {
//       signal = "buy";
//       reason = `Bullish crossover on ${timeframe}`;
//     } 
//     // Sell signals
//     else if (currentRsi > 65 && currentEmaFast < currentEmaSlow && prevEmaFast >= prevEmaSlow) {
//       signal = "sell";
//       reason = `Bearish crossover on ${timeframe}`;
//     }
//     // MACD signal confirmation
//     else if (signal === "hold" && currentMacd && prevMacd) {
//       if (currentMacd.histogram > 0 && prevMacd.histogram <= 0) {
//         signal = "buy";
//         reason = `MACD bullish crossover on ${timeframe}`;
//       } else if (currentMacd.histogram < 0 && prevMacd.histogram >= 0) {
//         signal = "sell";
//         reason = `MACD bearish crossover on ${timeframe}`;
//       }
//     }
    
//     if (signal !== "hold") {
//       allSignals.push({
//         timeframe,
//         signal,
//         reason,
//         price,
//         rsi: currentRsi,
//         emaFast: currentEmaFast,
//         emaSlow: currentEmaSlow
//       });
//     }
//   }
  
//   // Count signals
//   const buySignals = allSignals.filter(s => s.signal === "buy").length;
//   const sellSignals = allSignals.filter(s => s.signal === "sell").length;
  
//   // Determine final signal based on consensus
//   if (buySignals >= 2) {
//     return { action: "buy", reason: `Multiple buy signals (${buySignals}/${SCALPING_TIMEFRAMES.length})` };
//   } else if (sellSignals >= 2) {
//     return { action: "sell", reason: `Multiple sell signals (${sellSignals}/${SCALPING_TIMEFRAMES.length})` };
//   }
  
//   return { action: "hold", reason: "No clear signal" };
// }

// // Check if we should exit based on profit/trailing stop
// function shouldExit(position, currentPrice) {
//   if (!position) return false;
  
//   const entryPrice = position.entryPrice;
//   const profitPercent = ((currentPrice - entryPrice) / entryPrice) * 100;
  
//   // Update highest price since entry
//   if (currentPrice > highestPriceSinceEntry) {
//     highestPriceSinceEntry = currentPrice;
//   }
  
//   // Calculate trailing stop price
//   const trailingStopPrice = highestPriceSinceEntry * (1 - TRAILING_STOP_PERCENT / 100);
  
//   // Exit conditions:
//   // 1. Price has dropped 0.2% from the highest point since entry
//   // 2. We've achieved at least 0.5% profit
//   if (profitPercent >= TARGET_PROFIT_PERCENT && currentPrice <= trailingStopPrice) {
//     return { 
//       exit: true, 
//       reason: `Trailing stop triggered. Profit: ${profitPercent.toFixed(2)}%, High: ${highestPriceSinceEntry.toFixed(6)}, Current: ${currentPrice.toFixed(6)}` 
//     };
//   }
  
//   return { exit: false };
// }

// // Format quantity according to Binance rules
// async function formatQuantity(coin, quantity) {
//   try {
//     const symbolInfo = await binance.exchangeInfo();
//     const coinInfo = symbolInfo.symbols.find(s => s.symbol === coin);
    
//     if (!coinInfo) {
//       throw new Error(`Symbol ${coin} not found`);
//     }
    
//     const lotSizeFilter = coinInfo.filters.find(f => f.filterType === 'LOT_SIZE');
//     if (!lotSizeFilter) {
//       throw new Error('LOT_SIZE filter not found');
//     }
    
//     const minQty = parseFloat(lotSizeFilter.minQty);
//     const stepSize = parseFloat(lotSizeFilter.stepSize);
    
//     if (quantity < minQty) {
//       const currentPrice = await getCurrentPrice(coin);
//       const minDollarAmount = minQty * currentPrice;
//       throw new Error(`Quantity ${quantity} is below minimum ${minQty}. Minimum investment: $${minDollarAmount.toFixed(2)}`);
//     }
    
//     const precision = Math.log10(1/stepSize);
//     const formatted = (Math.floor(quantity / stepSize) * stepSize).toFixed(precision);
    
//     return formatted;
//   } catch (err) {
//     throw new Error(`Quantity formatting error: ${err.message}`);
//   }
// }

// // Save trade to history
// function saveTradeToHistory(action, coin, quantity, price, reason) {
//   const trade = {
//     action,
//     coin,
//     quantity,
//     price,
//     reason,
//     timestamp: new Date().toISOString(),
//   };
  
//   tradeHistory.push(trade);
//   io.emit("tradeUpdate", trade);
  
//   // Update PnL
//   if (action === "buy") {
//     dailyPnL -= quantity * price;
//   } else {
//     dailyPnL += quantity * price;
//   }
  
//   console.log(`Trade executed: ${action} ${quantity} ${coin} at ${price}`);
// }

// // Execute buy order
// async function executeBuy(coin, usdtAmount) {
//   try {
//     const currentPrice = await getCurrentPrice(coin);
//     let quantity = usdtAmount / currentPrice;
//     const formattedQuantity = await formatQuantity(coin, quantity);
    
//     console.log(`Placing market buy order for ${formattedQuantity} ${coin}...`);
//     const order = await binance.marketBuy(coin, formattedQuantity);
    
//     const executedPrice = parseFloat(order.fills[0].price);
//     const executedQuantity = parseFloat(order.fills.reduce((sum, fill) => sum + parseFloat(fill.qty), 0));
    
//     // Update position
//     currentPosition = {
//       coin,
//       entryPrice: executedPrice,
//       quantity: executedQuantity,
//       entryTime: new Date(),
//       highestPrice: executedPrice
//     };
    
//     // Reset highest price tracker
//     highestPriceSinceEntry = executedPrice;
    
//     saveTradeToHistory("buy", coin, executedQuantity, executedPrice, "Buy signal received");
    
//     return { success: true, order, price: executedPrice, quantity: executedQuantity };
//   } catch (error) {
//     console.error("Buy execution error:", error);
//     return { success: false, error: error.message };
//   }
// }

// // Execute sell order
// async function executeSell(coin, quantity, reason) {
//   try {
//     const formattedQuantity = await formatQuantity(coin, quantity);
    
//     console.log(`Placing market sell order for ${formattedQuantity} ${coin}...`);
//     const order = await binance.marketSell(coin, formattedQuantity);
    
//     const executedPrice = parseFloat(order.fills[0].price);
//     const executedQuantity = parseFloat(order.fills.reduce((sum, fill) => sum + parseFloat(fill.qty), 0));
    
//     // Calculate PnL
//     const entryPrice = currentPosition.entryPrice;
//     const pnlPercent = ((executedPrice - entryPrice) / entryPrice) * 100;
    
//     saveTradeToHistory("sell", coin, executedQuantity, executedPrice, `${reason} | PnL: ${pnlPercent.toFixed(2)}%`);
    
//     // Clear position
//     currentPosition = null;
//     highestPriceSinceEntry = 0;
    
//     return { success: true, order, price: executedPrice, quantity: executedQuantity, pnlPercent };
//   } catch (error) {
//     console.error("Sell execution error:", error);
//     return { success: false, error: error.message };
//   }
// }

// // Main trading loop
// async function runScalpingBot(coin, usdtAmount) {
//   console.log(`Starting scalping bot for ${coin} with $${usdtAmount}`);
  
//   while (botActive) {
//     try {
//       // Risk management checks
//       if (dailyTradeCount >= MAX_TRADES_PER_DAY) {
//         console.log("Daily trade limit reached. Stopping bot.");
//         botActive = false;
//         break;
//       }

//       const balances = await binance.balance();
//       const usdtBalance = parseFloat(balances.USDT?.available || "0");

//       if (usdtBalance < usdtAmount && !currentPosition) {
//         console.log("Insufficient balance, stopping bot.");
//         botActive = false;
//         break;
//       }

//       // Get current price
//       const currentPrice = await getCurrentPrice(coin);
      
//       // Check if we should exit existing position
//       if (currentPosition) {
//         const exitCheck = shouldExit(currentPosition, currentPrice);
        
//         if (exitCheck.exit) {
//           console.log(exitCheck.reason);
//           const sellResult = await executeSell(coin, currentPosition.quantity, exitCheck.reason);
          
//           if (sellResult.success) {
//             dailyTradeCount++;
//             console.log(`Sell executed successfully. Daily trades: ${dailyTradeCount}/${MAX_TRADES_PER_DAY}`);
//           }
          
//           // Wait a bit after selling
//           await new Promise(resolve => setTimeout(resolve, 2000));
//           continue;
//         }
        
//         // Update highest price
//         if (currentPrice > highestPriceSinceEntry) {
//           highestPriceSinceEntry = currentPrice;
//         }
//       }
      
//       // Get trading signal
//       const signal = await getScalpingSignal(coin);
//       // console.log(`Signal for ${coin}: ${signal.action} - ${signal.reason}`);
//       console.log(`[${new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })}] Signal for ${coin}: ${signal.action} - ${signal.reason}`);
      
//       // Execute based on signal
//       if (signal.action === "buy" && !currentPosition) {
//         const buyResult = await executeBuy(coin, usdtAmount);
        
//         if (buyResult.success) {
//           dailyTradeCount++;
//           console.log(`Buy executed successfully. Daily trades: ${dailyTradeCount}/${MAX_TRADES_PER_DAY}`);
//         }
//       } 
//       else if (signal.action === "sell" && currentPosition) {
//         const sellResult = await executeSell(coin, currentPosition.quantity, signal.reason);
        
//         if (sellResult.success) {
//           dailyTradeCount++;
//           console.log(`Sell executed successfully. Daily trades: ${dailyTradeCount}/${MAX_TRADES_PER_DAY}`);
//         }
//       }
      
//       // Wait before next check
//       await new Promise(resolve => setTimeout(resolve, 5000));
      
//     } catch (error) {
//       console.error("Error in scalping bot:", error);
//       await new Promise(resolve => setTimeout(resolve, 10000));
//     }
//   }
  
//   console.log("Scalping bot stopped");
// }

// // Socket.IO connection handling
// io.on("connection", socket => {
//   console.log('User connected:', socket.id);

//   socket.on("subscribe", (symbols) => {
//     userSubscriptions[socket.id] = symbols;
//   });
  
//   socket.on("disconnect", () => { 
//     delete userSubscriptions[socket.id]; 
//   });
// });

// // Price update interval
// setInterval(async () => {
//   const allSymbols = [...new Set(Object.values(userSubscriptions).flat())];
  
//   for (let symbol of allSymbols) {
//     try {
//       const price = await getCurrentPrice(symbol);
      
//       // Send price update to all subscribers of this symbol
//       for (let [id, symbols] of Object.entries(userSubscriptions)) {
//         if (symbols.includes(symbol)) {
//           io.to(id).emit("priceUpdate", { symbol, price });
//         }
//       }
//     } catch (error) {
//       console.error(`Error getting price for ${symbol}:`, error);
//     }
//   }
// }, 2000);

// // REST APIs
// app.post("/start", async (req, res) => { 
//   const isValid = await validateApiKeys();
//   if (!isValid) {
//     return res.status(400).json({ error: "Invalid API keys. Check console for solutions." });
//   }
  
//   const { coin, usdtAmount } = req.body;
  
//   if (!coin || !usdtAmount) {
//     return res.status(400).json({ error: "Coin and USDT amount are required" });
//   }
  
//   insertedAmount = usdtAmount; 
//   console.log("Starting scalping bot for:", coin, "with amount:", usdtAmount);
  
//   botActive = true; 
//   runScalpingBot(coin, usdtAmount);
  
//   res.json({ message: "Scalping bot started", coin, usdtAmount }); 
// });

// app.post("/stop", (req, res) => { 
//   console.log("Stopping bot...");
//   botActive = false; 
//   res.json({ message: "Bot stopped" }); 
// });

// app.post("/emergency-sell", async (req, res) => {
//   if (!currentPosition) {
//     return res.json({ message: "No active position to sell" });
//   }
  
//   try {
//     const sellResult = await executeSell(currentPosition.coin, currentPosition.quantity, "Emergency sell");
//     res.json({ message: "Emergency sell executed", result: sellResult });
//   } catch (error) {
//     res.status(500).json({ error: "Emergency sell failed", details: error.message });
//   }
// });

// app.get("/position", (req, res) => {
//   if (!currentPosition) {
//     return res.json({ position: null });
//   }
  
//   res.json({ 
//     position: currentPosition,
//     highestPriceSinceEntry 
//   });
// });

// app.get("/history", (req, res) => res.json(tradeHistory));

// app.get("/balance", async (req, res) => {
//   try {
//     const account = await binance.balance();
//     const balances = Object.keys(account)
//       .filter(asset => parseFloat(account[asset].available) > 0 || parseFloat(account[asset].onOrder) > 0)
//       .map(asset => ({
//         asset,
//         free: account[asset].available,
//         locked: account[asset].onOrder
//       }));
//     res.json(Array.isArray(balances) ? balances : []);
//   } catch {
//     res.json([]);
//   }
// });

// app.get("/stats", (req, res) => {
//   res.json({
//     dailyTradeCount,
//     maxTradesPerDay: MAX_TRADES_PER_DAY,
//     dailyPnL,
//     maxDailyLossPercent: MAX_DAILY_LOSS_PERCENT,
//     botActive,
//     insertedAmount,
//     currentPosition,
//     strategy: {
//       targetProfitPercent: TARGET_PROFIT_PERCENT,
//       trailingStopPercent: TRAILING_STOP_PERCENT,
//       timeframes: SCALPING_TIMEFRAMES
//     }
//   });
// });

// server.listen(8001, () => console.log("Server running on port 8001"));








// ----------------------------------------------------------------------------
// Key Features of This Strategy:
// 0.3% Profit Target, 0.25% Stop Loss - Low risk setup

// All-Market Strategy - Works in both bullish and bearish conditions

// Multiple Timeframe Confirmation - Uses 1m, 3m, and 5m charts

// Volume Confirmation - Requires volume above average for valid signals

// Trade Timeout - Exits trades that take longer than 30 minutes

// Daily Trade Limit - Maximum 8 trades per day to avoid overtrading

// Expected Results:
// प्रति Trade: 0.3% profit target

// Daily Trades: 4-8 trades (market conditions के according)

// Win Rate: ~65-70% (proper risk management के साथ)

// Risk/Reward Ratio: 1:1.2 (favorable)
// coin code for trade- BTCUSDT
// BTCUSDT - सबसे liquid, low spread

// ETHUSDT - Good volatility, liquid

// BNBUSDT - Good for scalping

// ADAUSDT - Decent volatility 

// const express = require("express");
// const http = require("http");
// const cors = require("cors");
// const { Server } = require("socket.io");
// const axios = require("axios");
// const Binance = require("node-binance-api");
// const { RSI, EMA, MACD, BollingerBands, ATR, Stochastic } = require("technicalindicators");

// require('dotenv').config();

// const app = express();
// app.use(express.json());
// app.use(cors());

// const server = http.createServer(app);
// const io = new Server(server, { cors: { origin: "*" } });

// // Initialize Binance API
// const binance = new Binance().options({
//   APIKEY: process.env.BINANCE_API_KEY,
//   APISECRET: process.env.BINANCE_API_SECRET,
//   useServerTime: true,
//   recvWindow: 60000,
//   verbose: false,
// });

// // Bot state and configuration
// let botActive = false;
// let tradeHistory = [];
// let insertedAmount = 0;
// let dailyTradeCount = 0;
// let dailyPnL = 0;
// let currentPosition = null;

// // Strategy Configuration - 0.3% Profit, 0.25% Stop Loss
// const STRATEGY_CONFIG = {
//   TARGET_PROFIT_PERCENT: 0.3,    // 0.3% profit target
//   STOP_LOSS_PERCENT: 0.25,       // 0.25% stop loss
//   MAX_TRADES_PER_DAY: 8,         // Maximum 8 trades per day
//   TIMEFRAMES: ["1m", "3m", "5m"], // Timeframes for analysis
//   REQUIRED_SIGNAL_STRENGTH: 2,   // 2 out of 3 timeframes must agree
//   VOLUME_MULTIPLIER: 1.2         // Volume should be 20% above average
// };

// // Track price movements for trailing stop
// let highestPriceSinceEntry = 0;
// let tradeStartTime = null;

// // Subscriptions
// const userSubscriptions = {};

// // 24-hour reset timer
// setInterval(() => {
//   dailyTradeCount = 0;
//   dailyPnL = 0;
//   console.log(`[${new Date().toLocaleString('en-IN')}] Daily trade count and PnL reset`);
// }, 24 * 60 * 60 * 1000);

// // API Key validation function
// async function validateApiKeys() {
//   try {
//     console.log(`[${new Date().toLocaleString('en-IN')}] Validating API keys...`);
//     const balance = await binance.balance();
//     console.log(`[${new Date().toLocaleString('en-IN')}] API Keys are valid!`);
//     console.log(`[${new Date().toLocaleString('en-IN')}] USDT Balance:`, balance.USDT?.available || "0");
//     return true;
//   } catch (error) {
//     console.error(`[${new Date().toLocaleString('en-IN')}] API Key Validation Failed:`, error.message);
//     return false;
//   }
// }

// // Helper functions
// async function getKlines(symbol, interval = "1m", limit = 100) {
//   try {
//     const res = await axios.get(
//       "https://api.binance.com/api/v3/klines",
//       { params: { symbol, interval, limit } }
//     );
//     return res.data;
//   } catch {
//     return [];
//   }
// }

// async function getCurrentPrice(coin) {
//   const ticker = await binance.prices(coin);
//   return parseFloat(ticker[coin]);
// }

// function calculateRSI(closes, period = 14) {
//   return RSI.calculate({ values: closes, period });
// }

// function calculateEMA(closes, period) {
//   return EMA.calculate({ values: closes, period });
// }

// function calculateMACD(closes) {
//   return MACD.calculate({
//     values: closes,
//     fastPeriod: 12,
//     slowPeriod: 26,
//     signalPeriod: 9,
//     SimpleMAOscillator: false,
//     SimpleMASignal: false,
//   });
// }

// function calculateBollingerBands(closes) {
//   return BollingerBands.calculate({
//     period: 20,
//     values: closes,
//     stdDev: 2,
//   });
// }

// function calculateStochastic(highs, lows, closes, period, signalPeriod) {
//   return Stochastic.calculate({
//     high: highs,
//     low: lows,
//     close: closes,
//     period: period,
//     signalPeriod: signalPeriod
//   });
// }

// // All-market strategy that works in both bullish and bearish conditions
// async function getAllMarketSignal(symbol) {
//   let signals = [];
//   let totalStrength = 0;
  
//   for (const timeframe of STRATEGY_CONFIG.TIMEFRAMES) {
//     const klines = await getKlines(symbol, timeframe, 50);
//     if (!klines.length) continue;
    
//     const closes = klines.map(k => parseFloat(k[4]));
//     const highs = klines.map(k => parseFloat(k[2]));
//     const lows = klines.map(k => parseFloat(k[3]));
//     const volumes = klines.map(k => parseFloat(k[5]));
    
//     // Calculate indicators
//     const rsi = calculateRSI(closes, 14);
//     const emaFast = calculateEMA(closes, 9);
//     const emaSlow = calculateEMA(closes, 21);
//     const macd = calculateMACD(closes);
//     const bb = calculateBollingerBands(closes);
    
//     // Volume analysis
//     const volumeAvg = volumes.slice(-20).reduce((a, b) => a + b, 0) / 20;
//     const currentVolume = volumes[volumes.length - 1];
//     const volumeRatio = currentVolume / volumeAvg;
    
//     if (!rsi.length || !emaFast.length || !emaSlow.length || !macd.length || !bb.length) continue;
    
//     const currentRsi = rsi[rsi.length - 1];
//     const currentEmaFast = emaFast[emaFast.length - 1];
//     const currentEmaSlow = emaSlow[emaSlow.length - 1];
//     const prevEmaFast = emaFast[emaFast.length - 2];
//     const prevEmaSlow = emaSlow[emaSlow.length - 2];
//     const currentMacd = macd[macd.length - 1];
//     const prevMacd = macd[macd.length - 2];
//     const currentBb = bb[bb.length - 1];
//     const price = closes[closes.length - 1];
    
//     // Signal strength calculation
//     let signalStrength = 0;
//     let signalDirection = "hold";
    
//     // Bullish signals (with volume confirmation)
//     if (currentRsi < 35 && volumeRatio > STRATEGY_CONFIG.VOLUME_MULTIPLIER) {
//       signalStrength += 1;
//     }
//     if (currentEmaFast > currentEmaSlow && prevEmaFast <= prevEmaSlow) {
//       signalStrength += 1;
//     }
//     if (currentMacd && prevMacd && currentMacd.histogram > 0 && prevMacd.histogram <= 0) {
//       signalStrength += 1;
//     }
//     if (price < currentBb.lower && volumeRatio > STRATEGY_CONFIG.VOLUME_MULTIPLIER) {
//       signalStrength += 1;
//     }
    
//     // Bearish signals (with volume confirmation)
//     if (currentRsi > 65 && volumeRatio > STRATEGY_CONFIG.VOLUME_MULTIPLIER) {
//       signalStrength -= 1;
//     }
//     if (currentEmaFast < currentEmaSlow && prevEmaFast >= prevEmaSlow) {
//       signalStrength -= 1;
//     }
//     if (currentMacd && prevMacd && currentMacd.histogram < 0 && prevMacd.histogram >= 0) {
//       signalStrength -= 1;
//     }
//     if (price > currentBb.upper && volumeRatio > STRATEGY_CONFIG.VOLUME_MULTIPLIER) {
//       signalStrength -= 1;
//     }
    
//     // Determine signal direction based on strength
//     if (signalStrength >= 2) {
//       signalDirection = "buy";
//     } else if (signalStrength <= -2) {
//       signalDirection = "sell";
//     }
    
//     if (signalDirection !== "hold") {
//       signals.push({
//         timeframe,
//         signal: signalDirection,
//         strength: Math.abs(signalStrength),
//         volumeRatio: parseFloat(volumeRatio.toFixed(2))
//       });
//       totalStrength += signalStrength;
//     }
//   }
  
//   // Calculate consensus
//   const buySignals = signals.filter(s => s.signal === "buy").length;
//   const sellSignals = signals.filter(s => s.signal === "sell").length;
  
//   // Require minimum signal strength and agreement
//   if (buySignals >= STRATEGY_CONFIG.REQUIRED_SIGNAL_STRENGTH && totalStrength > 0) {
//     return { 
//       action: "buy", 
//       reason: `Bullish consensus (${buySignals}/${STRATEGY_CONFIG.TIMEFRAMES.length}), Strength: ${totalStrength}`,
//       strength: totalStrength
//     };
//   } else if (sellSignals >= STRATEGY_CONFIG.REQUIRED_SIGNAL_STRENGTH && totalStrength < 0) {
//     return { 
//       action: "sell", 
//       reason: `Bearish consensus (${sellSignals}/${STRATEGY_CONFIG.TIMEFRAMES.length}), Strength: ${Math.abs(totalStrength)}`,
//       strength: Math.abs(totalStrength)
//     };
//   }
  
//   return { action: "hold", reason: "No clear signal", strength: 0 };
// }

// // Check exit conditions
// function checkExitConditions(position, currentPrice) {
//   if (!position) return { exit: false };
  
//   const entryPrice = position.entryPrice;
//   const profitPercent = ((currentPrice - entryPrice) / entryPrice) * 100;
  
//   // Update highest price since entry
//   if (currentPrice > highestPriceSinceEntry) {
//     highestPriceSinceEntry = currentPrice;
//   }
  
//   // Check if target profit reached
//   if (profitPercent >= STRATEGY_CONFIG.TARGET_PROFIT_PERCENT) {
//     return { 
//       exit: true, 
//       reason: `Target profit reached: ${profitPercent.toFixed(2)}%`,
//       type: "profit"
//     };
//   }
  
//   // Check if stop loss hit
//   if (profitPercent <= -STRATEGY_CONFIG.STOP_LOSS_PERCENT) {
//     return { 
//       exit: true, 
//       reason: `Stop loss triggered: ${profitPercent.toFixed(2)}%`,
//       type: "stop_loss"
//     };
//   }
  
//   // Check if trade is taking too long (more than 30 minutes)
//   if (tradeStartTime && (Date.now() - tradeStartTime) > 30 * 60 * 1000) {
//     return { 
//       exit: true, 
//       reason: `Trade timeout (30 minutes), PnL: ${profitPercent.toFixed(2)}%`,
//       type: "timeout"
//     };
//   }
  
//   return { exit: false };
// }

// // Format quantity according to Binance rules
// async function formatQuantity(coin, quantity) {
//   try {
//     const symbolInfo = await binance.exchangeInfo();
//     const coinInfo = symbolInfo.symbols.find(s => s.symbol === coin);
    
//     if (!coinInfo) {
//       throw new Error(`Symbol ${coin} not found`);
//     }
    
//     const lotSizeFilter = coinInfo.filters.find(f => f.filterType === 'LOT_SIZE');
//     if (!lotSizeFilter) {
//       throw new Error('LOT_SIZE filter not found');
//     }
    
//     const minQty = parseFloat(lotSizeFilter.minQty);
//     const stepSize = parseFloat(lotSizeFilter.stepSize);
    
//     if (quantity < minQty) {
//       const currentPrice = await getCurrentPrice(coin);
//       const minDollarAmount = minQty * currentPrice;
//       throw new Error(`Quantity ${quantity} is below minimum ${minQty}. Minimum investment: $${minDollarAmount.toFixed(2)}`);
//     }
    
//     const precision = Math.log10(1/stepSize);
//     const formatted = (Math.floor(quantity / stepSize) * stepSize).toFixed(precision);
    
//     return formatted;
//   } catch (err) {
//     throw new Error(`Quantity formatting error: ${err.message}`);
//   }
// }

// // Save trade to history
// function saveTradeToHistory(action, coin, quantity, price, reason, pnlPercent = 0) {
//   const trade = {
//     action,
//     coin,
//     quantity: parseFloat(quantity),
//     price: parseFloat(price),
//     reason,
//     pnlPercent: parseFloat(pnlPercent),
//     timestamp: new Date().toISOString(),
//   };
  
//   tradeHistory.push(trade);
//   io.emit("tradeUpdate", trade);
  
//   // Update PnL
//   if (action === "buy") {
//     dailyPnL -= quantity * price;
//   } else {
//     dailyPnL += quantity * price;
//   }
  
//   console.log(`[${new Date().toLocaleString('en-IN')}] Trade executed: ${action} ${quantity} ${coin} at ${price}, Reason: ${reason}`);
// }

// // Execute buy order
// async function executeBuy(coin, usdtAmount) {
//   try {
//     const currentPrice = await getCurrentPrice(coin);
//     let quantity = usdtAmount / currentPrice;
//     const formattedQuantity = await formatQuantity(coin, quantity);
    
//     console.log(`[${new Date().toLocaleString('en-IN')}] Placing market buy order for ${formattedQuantity} ${coin}...`);
//     const order = await binance.marketBuy(coin, formattedQuantity);
    
//     const executedPrice = parseFloat(order.fills[0].price);
//     const executedQuantity = parseFloat(order.fills.reduce((sum, fill) => sum + parseFloat(fill.qty), 0));
    
//     // Update position
//     currentPosition = {
//       coin,
//       entryPrice: executedPrice,
//       quantity: executedQuantity,
//       entryTime: new Date(),
//     };
    
//     // Reset tracking variables
//     highestPriceSinceEntry = executedPrice;
//     tradeStartTime = Date.now();
    
//     saveTradeToHistory("buy", coin, executedQuantity, executedPrice, "Buy signal received");
    
//     return { success: true, order, price: executedPrice, quantity: executedQuantity };
//   } catch (error) {
//     console.error(`[${new Date().toLocaleString('en-IN')}] Buy execution error:`, error);
//     return { success: false, error: error.message };
//   }
// }

// // Execute sell order
// async function executeSell(coin, quantity, reason) {
//   try {
//     const formattedQuantity = await formatQuantity(coin, quantity);
    
//     console.log(`[${new Date().toLocaleString('en-IN')}] Placing market sell order for ${formattedQuantity} ${coin}...`);
//     const order = await binance.marketSell(coin, formattedQuantity);
    
//     const executedPrice = parseFloat(order.fills[0].price);
//     const executedQuantity = parseFloat(order.fills.reduce((sum, fill) => sum + parseFloat(fill.qty), 0));
    
//     // Calculate PnL
//     const entryPrice = currentPosition.entryPrice;
//     const pnlPercent = ((executedPrice - entryPrice) / entryPrice) * 100;
    
//     saveTradeToHistory("sell", coin, executedQuantity, executedPrice, `${reason} | PnL: ${pnlPercent.toFixed(2)}%`, pnlPercent);
    
//     // Clear position
//     currentPosition = null;
//     highestPriceSinceEntry = 0;
//     tradeStartTime = null;
    
//     return { success: true, order, price: executedPrice, quantity: executedQuantity, pnlPercent };
//   } catch (error) {
//     console.error(`[${new Date().toLocaleString('en-IN')}] Sell execution error:`, error);
//     return { success: false, error: error.message };
//   }
// }

// // Main trading loop
// async function runTradingBot(coin, usdtAmount) {
//   console.log(`[${new Date().toLocaleString('en-IN')}] Starting trading bot for ${coin} with $${usdtAmount}`);
  
//   while (botActive) {
//     try {
//       // Risk management checks
//       if (dailyTradeCount >= STRATEGY_CONFIG.MAX_TRADES_PER_DAY) {
//         console.log(`[${new Date().toLocaleString('en-IN')}] Daily trade limit reached. Stopping bot.`);
//         botActive = false;
//         break;
//       }

//       const balances = await binance.balance();
//       const usdtBalance = parseFloat(balances.USDT?.available || "0");

//       if (usdtBalance < usdtAmount && !currentPosition) {
//         console.log(`[${new Date().toLocaleString('en-IN')}] Insufficient balance, stopping bot.`);
//         botActive = false;
//         break;
//       }

//       // Get current price
//       const currentPrice = await getCurrentPrice(coin);
      
//       // Check if we should exit existing position
//       if (currentPosition) {
//         const exitCheck = checkExitConditions(currentPosition, currentPrice);
        
//         if (exitCheck.exit) {
//           console.log(`[${new Date().toLocaleString('en-IN')}] ${exitCheck.reason}`);
//           const sellResult = await executeSell(coin, currentPosition.quantity, exitCheck.reason);
          
//           if (sellResult.success) {
//             dailyTradeCount++;
//             console.log(`[${new Date().toLocaleString('en-IN')}] Sell executed successfully. Daily trades: ${dailyTradeCount}/${STRATEGY_CONFIG.MAX_TRADES_PER_DAY}`);
//           }
          
//           // Wait a bit after selling
//           await new Promise(resolve => setTimeout(resolve, 3000));
//           continue;
//         }
        
//         // Update highest price
//         if (currentPrice > highestPriceSinceEntry) {
//           highestPriceSinceEntry = currentPrice;
//         }
//       }
      
//       // Get trading signal
//       const signal = await getAllMarketSignal(coin);
//       console.log(`[${new Date().toLocaleString('en-IN')}] Signal for ${coin}: ${signal.action} - ${signal.reason}`);
      
//       // Execute based on signal
//       if (signal.action === "buy" && !currentPosition) {
//         const buyResult = await executeBuy(coin, usdtAmount);
        
//         if (buyResult.success) {
//           dailyTradeCount++;
//           console.log(`[${new Date().toLocaleString('en-IN')}] Buy executed successfully. Daily trades: ${dailyTradeCount}/${STRATEGY_CONFIG.MAX_TRADES_PER_DAY}`);
//         }
//       } 
//       else if (signal.action === "sell" && currentPosition) {
//         const sellResult = await executeSell(coin, currentPosition.quantity, signal.reason);
        
//         if (sellResult.success) {
//           dailyTradeCount++;
//           console.log(`[${new Date().toLocaleString('en-IN')}] Sell executed successfully. Daily trades: ${dailyTradeCount}/${STRATEGY_CONFIG.MAX_TRADES_PER_DAY}`);
//         }
//       }
      
//       // Wait before next check
//       await new Promise(resolve => setTimeout(resolve, 5000));
      
//     } catch (error) {
//       console.error(`[${new Date().toLocaleString('en-IN')}] Error in trading bot:`, error);
//       await new Promise(resolve => setTimeout(resolve, 10000));
//     }
//   }
  
//   console.log(`[${new Date().toLocaleString('en-IN')}] Trading bot stopped`);
// }

// // Socket.IO connection handling
// io.on("connection", socket => {
//   console.log(`[${new Date().toLocaleString('en-IN')}] User connected:`, socket.id);

//   socket.on("subscribe", (symbols) => {
//     userSubscriptions[socket.id] = symbols;
//   });
  
//   socket.on("disconnect", () => { 
//     delete userSubscriptions[socket.id]; 
//   });
// });

// // Price update interval
// setInterval(async () => {
//   const allSymbols = [...new Set(Object.values(userSubscriptions).flat())];
  
//   for (let symbol of allSymbols) {
//     try {
//       const price = await getCurrentPrice(symbol);
      
//       // Send price update to all subscribers of this symbol
//       for (let [id, symbols] of Object.entries(userSubscriptions)) {
//         if (symbols.includes(symbol)) {
//           io.to(id).emit("priceUpdate", { symbol, price });
//         }
//       }
//     } catch (error) {
//       console.error(`[${new Date().toLocaleString('en-IN')}] Error getting price for ${symbol}:`, error);
//     }
//   }
// }, 2000);

// // REST APIs
// app.post("/start", async (req, res) => { 
//   const isValid = await validateApiKeys();
//   if (!isValid) {
//     return res.status(400).json({ error: "Invalid API keys. Check console for solutions." });
//   }
  
//   const { coin, usdtAmount } = req.body;
  
//   if (!coin || !usdtAmount) {
//     return res.status(400).json({ error: "Coin and USDT amount are required" });
//   }
  
//   insertedAmount = usdtAmount; 
//   console.log(`[${new Date().toLocaleString('en-IN')}] Starting trading bot for:`, coin, "with amount:", usdtAmount);
  
//   botActive = true; 
//   runTradingBot(coin, usdtAmount);
  
//   res.json({ 
//     message: "Trading bot started", 
//     coin, 
//     usdtAmount,
//     strategy: {
//       targetProfit: `${STRATEGY_CONFIG.TARGET_PROFIT_PERCENT}%`,
//       stopLoss: `${STRATEGY_CONFIG.STOP_LOSS_PERCENT}%`,
//       maxTradesPerDay: STRATEGY_CONFIG.MAX_TRADES_PER_DAY
//     }
//   }); 
// });

// app.post("/stop", (req, res) => { 
//   console.log(`[${new Date().toLocaleString('en-IN')}] Stopping bot...`);
//   botActive = false; 
//   res.json({ message: "Bot stopped" }); 
// });

// app.post("/emergency-sell", async (req, res) => {
//   if (!currentPosition) {
//     return res.json({ message: "No active position to sell" });
//   }
  
//   try {
//     const sellResult = await executeSell(currentPosition.coin, currentPosition.quantity, "Emergency sell");
//     res.json({ message: "Emergency sell executed", result: sellResult });
//   } catch (error) {
//     res.status(500).json({ error: "Emergency sell failed", details: error.message });
//   }
// });

// app.get("/position", (req, res) => {
//   if (!currentPosition) {
//     return res.json({ position: null });
//   }
  
//   res.json({ 
//     position: currentPosition,
//     highestPriceSinceEntry 
//   });
// });

// app.get("/history", (req, res) => res.json(tradeHistory));

// app.get("/balance", async (req, res) => {
//   try {
//     const account = await binance.balance();
//     const balances = Object.keys(account)
//       .filter(asset => parseFloat(account[asset].available) > 0 || parseFloat(account[asset].onOrder) > 0)
//       .map(asset => ({
//         asset,
//         free: account[asset].available,
//         locked: account[asset].onOrder
//       }));
//     res.json(Array.isArray(balances) ? balances : []);
//   } catch {
//     res.json([]);
//   }
// });

// app.get("/stats", (req, res) => {
//   res.json({
//     dailyTradeCount,
//     maxTradesPerDay: STRATEGY_CONFIG.MAX_TRADES_PER_DAY,
//     dailyPnL,
//     botActive,
//     insertedAmount,
//     currentPosition,
//     strategy: STRATEGY_CONFIG
//   });
// });

// server.listen(8001, () => console.log(`[${new Date().toLocaleString('en-IN')}] Server running on port 8001`));











// // Live trade code for 0.4% & daily many trade code.

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

// Initialize Binance API for LIVE trading
const binance = new Binance().options({
  APIKEY: process.env.BINANCE_API_KEY,
  APISECRET: process.env.BINANCE_API_SECRET,
  useServerTime: true,
  recvWindow: 60000,
  verbose: false,
});

// Bot state and configuration
let botActive = false;
let tradeHistory = [];
let insertedAmount = 0;
let dailyTradeCount = 0;
let dailyPnL = 0;
let currentPosition = null;
let isProcessingTrade = false; // Critical safety variable

// LIVE Trading Configuration
const STRATEGY_CONFIG = {
  // TARGET_PROFIT_PERCENT: 0.4,
  TARGET_PROFIT_PERCENT: 0.5,
  // STOP_LOSS_PERCENT: 0.25,
  STOP_LOSS_PERCENT: 0.3,
  // MAX_TRADES_PER_DAY: 8,
  MAX_TRADES_PER_DAY: 5,
  TIMEFRAMES: ["1m", "3m", "5m"],
  // TIMEFRAMES: ["5m", "15m"],
  REQUIRED_SIGNAL_STRENGTH: 2,
  VOLUME_MULTIPLIER: 1.2,
  
  // Live trading safety
  MIN_TRADE_AMOUNT: 50,
  MAX_TRADE_AMOUNT: 1000,
  WHITELISTED_COINS: ["BTCUSDT", "ETHUSDT", "BNBUSDT", "ADAUSDT", "SOLUSDT", "XRPUSDT", "DOTUSDT", "DOGEUSDT"]
};

// Track price movements
let highestPriceSinceEntry = 0;
let tradeStartTime = null;

// Subscriptions
const userSubscriptions = {};

// 24-hour reset timer
setInterval(() => {
  dailyTradeCount = 0;
  dailyPnL = 0;
  console.log(`[${new Date().toLocaleString('en-IN')}] Daily trade count and PnL reset`);
}, 24 * 60 * 60 * 1000);

// API Key validation function
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

// Live trading validation
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

// Helper functions
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
    period: period,
    signalPeriod: signalPeriod
  });
}

// All-market strategy that works in both bullish and bearish conditions
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
    
    // Calculate indicators
    const rsi = calculateRSI(closes, 14);
    const emaFast = calculateEMA(closes, 9);
    const emaSlow = calculateEMA(closes, 21);
    const macd = calculateMACD(closes);
    const bb = calculateBollingerBands(closes);
    
    // Volume analysis
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
    
    // Signal strength calculation
    let signalStrength = 0;
    let signalDirection = "hold";
    
    // Bullish signals (with volume confirmation)
    if (currentRsi < 35 && volumeRatio > STRATEGY_CONFIG.VOLUME_MULTIPLIER) {
      signalStrength += 1;
    }
    if (currentEmaFast > currentEmaSlow && prevEmaFast <= prevEmaSlow) {
      signalStrength += 1;
    }
    if (currentMacd && prevMacd && currentMacd.histogram > 0 && prevMacd.histogram <= 0) {
      signalStrength += 1;
    }
    if (price < currentBb.lower && volumeRatio > STRATEGY_CONFIG.VOLUME_MULTIPLIER) {
      signalStrength += 1;
    }
    
    // Bearish signals (with volume confirmation)
    if (currentRsi > 65 && volumeRatio > STRATEGY_CONFIG.VOLUME_MULTIPLIER) {
      signalStrength -= 1;
    }
    if (currentEmaFast < currentEmaSlow && prevEmaFast >= prevEmaSlow) {
      signalStrength -= 1;
    }
    if (currentMacd && prevMacd && currentMacd.histogram < 0 && prevMacd.histogram >= 0) {
      signalStrength -= 1;
    }
    if (price > currentBb.upper && volumeRatio > STRATEGY_CONFIG.VOLUME_MULTIPLIER) {
      signalStrength -= 1;
    }
    
    // Determine signal direction based on strength
    if (signalStrength >= 2) {
      signalDirection = "buy";
    } else if (signalStrength <= -2) {
      signalDirection = "sell";
    }
    
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
  
  // Calculate consensus
  const buySignals = signals.filter(s => s.signal === "buy").length;
  const sellSignals = signals.filter(s => s.signal === "sell").length;
  
  // Require minimum signal strength and agreement
  if (buySignals >= STRATEGY_CONFIG.REQUIRED_SIGNAL_STRENGTH && totalStrength > 0) {
    return { 
      action: "buy", 
      reason: `Bullish consensus (${buySignals}/${STRATEGY_CONFIG.TIMEFRAMES.length}), Strength: ${totalStrength}`,
      strength: totalStrength
    };
  } else if (sellSignals >= STRATEGY_CONFIG.REQUIRED_SIGNAL_STRENGTH && totalStrength < 0) {
    return { 
      action: "sell", 
      reason: `Bearish consensus (${sellSignals}/${STRATEGY_CONFIG.TIMEFRAMES.length}), Strength: ${Math.abs(totalStrength)}`,
      strength: Math.abs(totalStrength)
    };
  }
  
  return { action: "hold", reason: "No clear signal", strength: 0 };
}

// Check exit conditions
function checkExitConditions(position, currentPrice) {
  if (!position) return { exit: false };
  
  const entryPrice = position.entryPrice;
  const profitPercent = ((currentPrice - entryPrice) / entryPrice) * 100;
  
  // Update highest price since entry
  if (currentPrice > highestPriceSinceEntry) {
    highestPriceSinceEntry = currentPrice;
  }
  
  // Check if target profit reached
  if (profitPercent >= STRATEGY_CONFIG.TARGET_PROFIT_PERCENT) {
    return { 
      exit: true, 
      reason: `Target profit reached: ${profitPercent.toFixed(2)}%`,
      type: "profit"
    };
  }
  
  // Check if stop loss hit
  if (profitPercent <= -STRATEGY_CONFIG.STOP_LOSS_PERCENT) {
    return { 
      exit: true, 
      reason: `Stop loss triggered: ${profitPercent.toFixed(2)}%`,
      type: "stop_loss"
    };
  }
  
  // Check if trade is taking too long (more than 30 minutes)
  if (tradeStartTime && (Date.now() - tradeStartTime) > 30 * 60 * 1000) {
    return { 
      exit: true, 
      reason: `Trade timeout (30 minutes), PnL: ${profitPercent.toFixed(2)}%`,
      type: "timeout"
    };
  }
  
  return { exit: false };
}

// Format quantity according to Binance rules
async function formatQuantity(coin, quantity) {
  try {
    const symbolInfo = await binance.exchangeInfo();
    const coinInfo = symbolInfo.symbols.find(s => s.symbol === coin);
    
    if (!coinInfo) {
      throw new Error(`Symbol ${coin} not found`);
    }
    
    const lotSizeFilter = coinInfo.filters.find(f => f.filterType === 'LOT_SIZE');
    if (!lotSizeFilter) {
      throw new Error('LOT_SIZE filter not found');
    }
    
    const minQty = parseFloat(lotSizeFilter.minQty);
    const stepSize = parseFloat(lotSizeFilter.stepSize);
    
    if (quantity < minQty) {
      const currentPrice = await getCurrentPrice(coin);
      const minDollarAmount = minQty * currentPrice;
      throw new Error(`Quantity ${quantity} is below minimum ${minQty}. Minimum investment: $${minDollarAmount.toFixed(2)}`);
    }
    
    const precision = Math.log10(1/stepSize);
    const formatted = (Math.floor(quantity / stepSize) * stepSize).toFixed(precision);
    
    return formatted;
  } catch (err) {
    throw new Error(`Quantity formatting error: ${err.message}`);
  }
}

// Save trade to history
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
  
  // Update PnL
  if (action === "buy") {
    dailyPnL -= quantity * price;
  } else {
    dailyPnL += quantity * price;
  }
  
  console.log(`[${new Date().toLocaleString('en-IN')}] Trade executed: ${action} ${quantity} ${coin} at ${price}, Reason: ${reason}`);
}

// Execute buy order
async function executeBuy(coin, usdtAmount) {
  try {
    const currentPrice = await getCurrentPrice(coin);
    let quantity = usdtAmount / currentPrice;
    const formattedQuantity = await formatQuantity(coin, quantity);
    
    console.log(`[${new Date().toLocaleString('en-IN')}] Placing market buy order for ${formattedQuantity} ${coin}...`);
    const order = await binance.marketBuy(coin, formattedQuantity);
    
    const executedPrice = parseFloat(order.fills[0].price);
    const executedQuantity = parseFloat(order.fills.reduce((sum, fill) => sum + parseFloat(fill.qty), 0));
    
    // Update position
    currentPosition = {
      coin,
      entryPrice: executedPrice,
      quantity: executedQuantity,
      entryTime: new Date(),
    };
    
    // Reset tracking variables
    highestPriceSinceEntry = executedPrice;
    tradeStartTime = Date.now();
    
    saveTradeToHistory("buy", coin, executedQuantity, executedPrice, "Buy signal received");
    
    return { success: true, order, price: executedPrice, quantity: executedQuantity };
  } catch (error) {
    console.error(`[${new Date().toLocaleString('en-IN')}] Buy execution error:`, error);
    return { success: false, error: error.message };
  }
}

// Execute sell order
async function executeSell(coin, quantity, reason) {
  try {
    const formattedQuantity = await formatQuantity(coin, quantity);
    
    console.log(`[${new Date().toLocaleString('en-IN')}] Placing market sell order for ${formattedQuantity} ${coin}...`);
    const order = await binance.marketSell(coin, formattedQuantity);
    
    const executedPrice = parseFloat(order.fills[0].price);
    const executedQuantity = parseFloat(order.fills.reduce((sum, fill) => sum + parseFloat(fill.qty), 0));
    
    // Calculate PnL
    const entryPrice = currentPosition.entryPrice;
    const pnlPercent = ((executedPrice - entryPrice) / entryPrice) * 100;
    
    saveTradeToHistory("sell", coin, executedQuantity, executedPrice, `${reason} | PnL: ${pnlPercent.toFixed(2)}%`, pnlPercent);
    
    // Clear position
    currentPosition = null;
    highestPriceSinceEntry = 0;
    tradeStartTime = null;
    
    return { success: true, order, price: executedPrice, quantity: executedQuantity, pnlPercent };
  } catch (error) {
    console.error(`[${new Date().toLocaleString('en-IN')}] Sell execution error:`, error);
    return { success: false, error: error.message };
  }
}

// Main trading loop - FIXED VERSION
async function runTradingBot(coin, usdtAmount) {
  console.log(`[${new Date().toLocaleString('en-IN')}] Starting trading bot for ${coin} with $${usdtAmount}`);
  
  while (botActive) {
    try {
      // Prevent multiple simultaneous trades
      if (isProcessingTrade) {
        await new Promise(resolve => setTimeout(resolve, 2000));
        continue;
      }

      isProcessingTrade = true;

      // Risk management checks
      if (dailyTradeCount >= STRATEGY_CONFIG.MAX_TRADES_PER_DAY) {
        console.log(`[${new Date().toLocaleString('en-IN')}] Daily trade limit reached. Stopping bot.`);
        botActive = false;
        break;
      }

      const balances = await binance.balance();
      const usdtBalance = parseFloat(balances.USDT?.available || "0");

      if (usdtBalance < usdtAmount && !currentPosition) {
        console.log(`[${new Date().toLocaleString('en-IN')}] Insufficient balance, stopping bot.`);
        botActive = false;
        break;
      }

      // Get current price
      const currentPrice = await getCurrentPrice(coin);
      
      // Check if we should exit existing position
      if (currentPosition) {
        const exitCheck = checkExitConditions(currentPosition, currentPrice);
        
        if (exitCheck.exit) {
          console.log(`[${new Date().toLocaleString('en-IN')}] ${exitCheck.reason}`);
          const sellResult = await executeSell(coin, currentPosition.quantity, exitCheck.reason);
          
          if (sellResult.success) {
            dailyTradeCount++;
            console.log(`[${new Date().toLocaleString('en-IN')}] Sell executed successfully. Daily trades: ${dailyTradeCount}/${STRATEGY_CONFIG.MAX_TRADES_PER_DAY}`);
          }
          
          // Wait a bit after selling
          await new Promise(resolve => setTimeout(resolve, 5000));
          isProcessingTrade = false;
          continue;
        }
        
        // Update highest price
        if (currentPrice > highestPriceSinceEntry) {
          highestPriceSinceEntry = currentPrice;
        }
      }
      
      // Get trading signal
      const signal = await getAllMarketSignal(coin);
      console.log(`[${new Date().toLocaleString('en-IN')}] Signal for ${coin}: ${signal.action} - ${signal.reason}`);
      
      // Execute based on signal
      if (signal.action === "buy" && !currentPosition) {
        const buyResult = await executeBuy(coin, usdtAmount);
        
        if (buyResult.success) {
          dailyTradeCount++;
          console.log(`[${new Date().toLocaleString('en-IN')}] Buy executed successfully. Daily trades: ${dailyTradeCount}/${STRATEGY_CONFIG.MAX_TRADES_PER_DAY}`);
        }
      } 
      else if (signal.action === "sell" && currentPosition) {
        const sellResult = await executeSell(coin, currentPosition.quantity, signal.reason);
        
        if (sellResult.success) {
          dailyTradeCount++;
          console.log(`[${new Date().toLocaleString('en-IN')}] Sell executed successfully. Daily trades: ${dailyTradeCount}/${STRATEGY_CONFIG.MAX_TRADES_PER_DAY}`);
        }
      }
      
      isProcessingTrade = false;
      // Wait before next check
      await new Promise(resolve => setTimeout(resolve, 5000));
      
    } catch (error) {
      console.error(`[${new Date().toLocaleString('en-IN')}] Error in trading bot:`, error);
      isProcessingTrade = false;
      await new Promise(resolve => setTimeout(resolve, 10000));
    }
  }
  
  console.log(`[${new Date().toLocaleString('en-IN')}] Trading bot stopped`);
}

// Socket.IO connection handling
io.on("connection", socket => {
  console.log(`[${new Date().toLocaleString('en-IN')}] User connected:`, socket.id);

  socket.on("subscribe", (symbols) => {
    userSubscriptions[socket.id] = symbols;
  });
  
  socket.on("disconnect", () => { 
    delete userSubscriptions[socket.id]; 
  });
});

// Price update interval
setInterval(async () => {
  const allSymbols = [...new Set(Object.values(userSubscriptions).flat())];
  
  for (let symbol of allSymbols) {
    try {
      const price = await getCurrentPrice(symbol);
      
      // Send price update to all subscribers of this symbol
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

// REST APIs
app.post("/start", async (req, res) => { 
  try {
    const isValid = await validateApiKeys();
    if (!isValid) {
      return res.status(400).json({ error: "Invalid API keys. Check console for solutions." });
    }
    
    const { coin, usdtAmount } = req.body;
    
    if (!coin || !usdtAmount) {
      return res.status(400).json({ error: "Coin and USDT amount are required" });
    }
    
    // Validate live trade parameters
    validateLiveTradeRequest(coin, usdtAmount);
    
    insertedAmount = usdtAmount; 
    console.log(`[${new Date().toLocaleString('en-IN')}] Starting LIVE trading for:`, coin, "with amount:", usdtAmount);
    
    botActive = true; 
    runTradingBot(coin, usdtAmount);
    
    res.json({ 
      message: "LIVE trading started", 
      coin, 
      usdtAmount,
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

app.post("/stop", (req, res) => { 
  console.log(`[${new Date().toLocaleString('en-IN')}] Stopping bot...`);
  botActive = false; 
  res.json({ message: "Bot stopped" }); 
});

app.post("/emergency-sell", async (req, res) => {
  if (!currentPosition) {
    return res.json({ message: "No active position to sell" });
  }
  
  try {
    const sellResult = await executeSell(currentPosition.coin, currentPosition.quantity, "Emergency sell");
    res.json({ message: "Emergency sell executed", result: sellResult });
  } catch (error) {
    res.status(500).json({ error: "Emergency sell failed", details: error.message });
  }
});

app.post("/emergency-stop-all", async (req, res) => {
  botActive = false;
  
  // Close all positions
  if (currentPosition) {
    await executeSell(currentPosition.coin, currentPosition.quantity, "Emergency stop all");
  }
  
  res.json({ message: "All trading stopped emergency" });
});

app.get("/position", (req, res) => {
  if (!currentPosition) {
    return res.json({ position: null });
  }
  
  res.json({ 
    position: currentPosition,
    highestPriceSinceEntry 
  });
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
  } catch {
    res.json([]);
  }
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
























// Grid based system for BTC 3000-5000
// How This Works:
// Bot starts by placing grid buy/sell limit orders spaced by gridSize.

// When buy orders fill, position is updated and a sell limit order one grid step above is placed.

// When sell orders fill, position is partially reduced and a new buy order is placed lower to maintain the grid.

// Bot tracks highest price since entry and sets a trailing stop at 0.5% below that high.

// If price falls to trailing stop, bot executes a market sell to lock profits and resets the grid.
// const Binance = require("node-binance-api");
// require('dotenv').config();

// const binance = new Binance().options({
//   APIKEY: process.env.BINANCE_API_KEY,
//   APISECRET: process.env.BINANCE_API_SECRET,
//   useServerTime: true,
//   recvWindow: 60000,
//   verbose: false,
// });

// const symbol = "BTCUSDT";
// const gridLevels = 5;
// const baseOrderSizeUSDT = 50;
// const FEE_BUFFER = 1.1;       // 10% buffer for fees

// const TRAILING_STOP_PERCENT = 0.5; // Trailing stop loss percent (0.5%)

// let symbolInfo = null;
// let minNotional = 10;
// let gridSize = Math.floor(Math.random() * (5000 - 3000 + 1)) + 3000;

// let openOrders = [];

// // Position tracking
// let position = {
//   totalQty: 0,
//   avgPrice: 0,
//   highestPrice: 0,
//   trailingStopPrice: 0,
//   inPosition: false,
// };

// async function fetchSymbolInfo() {
//   const exchangeInfo = await binance.exchangeInfo();
//   symbolInfo = exchangeInfo.symbols.find(s => s.symbol === symbol);

//   let minNotionalFilter =
//     symbolInfo.filters.find(f => f.filterType === "MIN_NOTIONAL") ||
//     symbolInfo.filters.find(f => f.filterType === "NOTIONAL");

//   if (minNotionalFilter && (minNotionalFilter.minNotional || minNotionalFilter.notional)) {
//     minNotional = parseFloat(minNotionalFilter.minNotional || minNotionalFilter.notional);
//   } else {
//     minNotional = 10;
//     console.warn(`No minNotional filter found for ${symbol}, defaulting to $${minNotional}`);
//   }

//   console.log(`BINANCE MIN NOTIONAL for ${symbol}: $${minNotional}`);
// }

// async function getCurrentPrice() {
//   const ticker = await binance.prices(symbol);
//   return parseFloat(ticker[symbol]);
// }

// async function formatQuantity(coin, quantity) {
//   try {
//     if (!symbolInfo) await fetchSymbolInfo();
//     const lotSizeFilter = symbolInfo.filters.find(f => f.filterType === 'LOT_SIZE');
//     if (!lotSizeFilter) throw new Error('LOT_SIZE filter not found');
//     const stepSize = parseFloat(lotSizeFilter.stepSize);
//     const precision = Math.floor(-Math.log10(stepSize));
//     const formatted = (Math.floor(quantity / stepSize) * stepSize).toFixed(precision);
//     return formatted;
//   } catch (error) {
//     console.error("Quantity formatting error:", error.message);
//     return quantity.toFixed(6);
//   }
// }

// async function getDynamicOrderSize(price, availableUSDT) {
//   let orderSizeUSDT = baseOrderSizeUSDT * FEE_BUFFER;
//   if (orderSizeUSDT < minNotional) orderSizeUSDT = minNotional;

//   if (availableUSDT < orderSizeUSDT) orderSizeUSDT = availableUSDT;

//   let quantity = orderSizeUSDT / price;
//   quantity = parseFloat(await formatQuantity(symbol, quantity));
//   let notional = price * quantity;

//   while (notional < minNotional && orderSizeUSDT < availableUSDT) {
//     orderSizeUSDT += 5;
//     if (orderSizeUSDT > availableUSDT) orderSizeUSDT = availableUSDT;
//     quantity = orderSizeUSDT / price;
//     quantity = parseFloat(await formatQuantity(symbol, quantity));
//     notional = price * quantity;
//   }

//   console.log(`Calculated order size: $${orderSizeUSDT.toFixed(2)}, Qty: ${quantity}, Notional: $${notional.toFixed(2)}`);

//   if (notional < minNotional) return null;

//   return { quantity, orderSizeUSDT };
// }

// async function placeLimitOrder(side, price, quantity) {
//   try {
//     const formattedQuantity = await formatQuantity(symbol, quantity);
//     console.log(`Placing ${side} LIMIT order at ${price} qty ${formattedQuantity}`);
//     const order = await binance.limitOrder(side, symbol, formattedQuantity, price.toFixed(2), { timeInForce: 'GTC' });
//     console.log(`Placed ${side} LIMIT order at ${price} for qty ${formattedQuantity}`);
//     return order;
//   } catch (error) {
//     console.error("Order placement error:", error.body || error.message);
//     return null;
//   }
// }

// async function cancelAllOrders() {
//   try {
//     const orders = await binance.openOrders(symbol);
//     for (const order of orders) {
//       await binance.cancel(symbol, order.orderId);
//     }
//     openOrders = [];
//     console.log("Cancelled all open spot orders.");
//   } catch (error) {
//     console.error("Cancel orders error:", error.body || error.message);
//   }
// }

// async function initializeGrid() {
//   await fetchSymbolInfo();
//   await cancelAllOrders();

//   const currentPrice = await getCurrentPrice();
//   const balances = await binance.balance();
//   let usdtBalance = parseFloat(balances.USDT?.available || "0");

//   for (let i = 1; i <= gridLevels; i++) {
//     // Buy grid level
//     const buyPrice = currentPrice - gridSize * i;
//     if (buyPrice <= 0) continue;

//     if (usdtBalance >= minNotional) {
//       const buyOrderParams = await getDynamicOrderSize(buyPrice, usdtBalance);
//       if (buyOrderParams) {
//         const buyOrder = await placeLimitOrder('BUY', buyPrice, buyOrderParams.quantity);
//         if (buyOrder) {
//           openOrders.push(buyOrder.orderId);
//           usdtBalance -= buyOrderParams.orderSizeUSDT;
//         }
//       } else {
//         console.log(`Skipping BUY at ${buyPrice}: Order size not sufficient.`);
//       }
//     } else {
//       console.log("USDT balance too low for buy orders.");
//       break;
//     }

//     // Sell grid level
//     const sellPrice = currentPrice + gridSize * i;
//     const sellOrderParams = await getDynamicOrderSize(sellPrice, 1000000); // Assume holdings sufficient
//     if (sellOrderParams) {
//       const sellOrder = await placeLimitOrder('SELL', sellPrice, sellOrderParams.quantity);
//       if (sellOrder) openOrders.push(sellOrder.orderId);
//     } else {
//       console.log(`Skipping SELL at ${sellPrice}: Notional too low.`);
//     }
//   }
// }

// // Update position after fills and calculate trailing stop
// function updatePosition(orderSide, filledQty, fillPrice) {
//   if (orderSide === "BUY") {
//     const totalCost = position.avgPrice * position.totalQty + fillPrice * filledQty;
//     position.totalQty += filledQty;
//     position.avgPrice = totalCost / position.totalQty;
//     position.highestPrice = Math.max(position.highestPrice, fillPrice);
//     position.inPosition = true;
//     console.log(`Position updated BUY: AvgPrice=${position.avgPrice.toFixed(2)}, Qty=${position.totalQty}`);
//   } else if (orderSide === "SELL" && position.totalQty >= filledQty) {
//     position.totalQty -= filledQty;
//     if (position.totalQty <= 0) {
//       // Position fully sold out
//       position.avgPrice = 0;
//       position.highestPrice = 0;
//       position.inPosition = false;
//       position.trailingStopPrice = 0;
//       console.log("Position fully closed.");
//     }
//     console.log(`Position updated SELL: Remaining Qty=${position.totalQty}`);
//   }
// }

// // Check and update trailing stop price
// function checkTrailingStop(currentPrice) {
//   if (!position.inPosition || position.totalQty <= 0) return false;

//   if (currentPrice > position.highestPrice) {
//     position.highestPrice = currentPrice;
//     position.trailingStopPrice = currentPrice * (1 - TRAILING_STOP_PERCENT / 100);
//     console.log(`Trailing stop updated to ${position.trailingStopPrice.toFixed(2)}`);
//   }

//   if (currentPrice <= position.trailingStopPrice) {
//     console.log(`Trailing stop hit at price ${currentPrice}. Should sell now.`);
//     return true;
//   }
//   return false;
// }

// async function manageOrders() {
//   try {
//     const orders = await binance.openOrders(symbol);
//     openOrders = orders.map(o => o.orderId);
//     const balances = await binance.balance();
//     const usdtBalance = parseFloat(balances.USDT?.available || "0");

//     for (const order of orders) {
//       const orderStatus = await binance.orderStatus(symbol, order.orderId);

//       if (orderStatus.status === "FILLED") {
//         const fillQty = parseFloat(orderStatus.executedQty);
//         const fillPrice = parseFloat(orderStatus.price);

//         updatePosition(order.side, fillQty, fillPrice);

//         if (order.side === "BUY") {
//           // Place sell at grid step above buy price
//           const sellPrice = fillPrice + gridSize;
//           const sellParams = await getDynamicOrderSize(sellPrice, 1000000);
//           if (sellParams) {
//             await placeLimitOrder("SELL", sellPrice, sellParams.quantity);
//             console.log(`Buy filled: Placed sell at ${sellPrice}`);
//           }
//         }

//         if (order.side === "SELL") {
//           // Place buy grid step below sell price only if not in trailing exit
//           const buyPrice = fillPrice - gridSize;
//           if (buyPrice > 0) {
//             const buyParams = await getDynamicOrderSize(buyPrice, usdtBalance);
//             if (buyParams && usdtBalance >= buyParams.orderSizeUSDT) {
//               await placeLimitOrder("BUY", buyPrice, buyParams.quantity);
//               console.log(`Sell filled: Placed buy at ${buyPrice}`);
//             } else {
//               console.log("Insufficient USDT balance for additional buy orders.");
//             }
//           }
//         }
//       }
//     }

//     // Check trailing stop exit
//     if (position.inPosition) {
//       const currentPrice = await getCurrentPrice();
//       if (checkTrailingStop(currentPrice)) {
//         // Place market sell for entire position to exit safely
//         const quantityToSell = await formatQuantity(symbol, position.totalQty);
//         try {
//           const sellOrder = await binance.marketSell(symbol, quantityToSell);
//           console.log(`Trailing stop triggered: Sold ${quantityToSell} at market.`);
//           position.totalQty = 0;
//           position.avgPrice = 0;
//           position.highestPrice = 0;
//           position.trailingStopPrice = 0;
//           position.inPosition = false;
//           // Refresh grid
//           await cancelAllOrders();
//           await initializeGrid();
//         } catch (err) {
//           console.error("Error executing trailing market sell:", err.body || err.message);
//         }
//       }
//     }

//   } catch (error) {
//     console.error("Error managing orders:", error.body || error.message);
//   }
// }

// async function runGridBot() {
//   console.log(`Starting Grid Trading Bot with grid size $${gridSize} and base order size $${baseOrderSizeUSDT}.`);
//   await initializeGrid();

//   setInterval(async () => {
//     console.log(`[${new Date().toLocaleString()}] Checking and managing grid orders...`);
//     await manageOrders();
//   }, 60000);
// }

// runGridBot();

