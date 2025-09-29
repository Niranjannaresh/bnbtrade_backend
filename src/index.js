// const express = require('express');
// const http = require('http');
// const cors = require('cors');
// const { Server } = require('socket.io');
// const axios = require('axios');
// const ti = require('technicalindicators');

// const app = express();
// app.use(cors());
// const server = http.createServer(app);
// const io = new Server(server, {
//   cors: { origin: "*" },
// });

// // Helper function: Binance klines data fetch karne ke liye
// async function getKlines(symbol, interval = '1m', limit = 100) {
//   try {
//     const res = await axios.get(
//       'https://api.binance.com/api/v3/klines',
//       { params: { symbol, interval, limit } }
//     );
//     return res.data;
//   } catch (err) {
//     return [];
//   }
// }

// // Indicator calculation functions (RSI, EMA, MACD, Bollinger Bands)
// function calculateRSI(closes) {
//   return ti.RSI.calculate({ values: closes, period: 14 });
// }
// function calculateEMA(closes, period) {
//   return ti.EMA.calculate({ values: closes, period });
// }
// function calculateMACD(closes) {
//   return ti.MACD.calculate({
//     values: closes,
//     fastPeriod: 12,
//     slowPeriod: 26,
//     signalPeriod: 9,
//     SimpleMAOscillator: false,
//     SimpleMASignal: false,
//   });
// }
// function calculateBollingerBands(closes) {
//   return ti.BollingerBands.calculate({
//     period: 20,
//     values: closes,
//     stdDev: 2,
//   });
// }

// // Indicator-based signal generators
// function getRsiSignal(rsi) {
//   if (rsi <= 30) return { action: 'buy', reason: 'RSI oversold' };
//   if (rsi >= 70) return { action: 'sell', reason: 'RSI overbought' };
//   return { action: 'hold', reason: 'RSI neutral' };
// }
// function getMacdSignal(macdLine, signalLine, prevMacdLine, prevSignalLine) {
//   if (prevMacdLine < prevSignalLine && macdLine > signalLine)
//     return { action: 'buy', reason: 'MACD bullish crossover' };
//   if (prevMacdLine > prevSignalLine && macdLine < signalLine)
//     return { action: 'sell', reason: 'MACD bearish crossover' };
//   return { action: 'hold', reason: 'MACD no crossover' };
// }
// function getEmaSignal(shortEma, longEma, prevShortEma, prevLongEma) {
//   if (prevShortEma < prevLongEma && shortEma > longEma)
//     return { action: 'buy', reason: 'EMA bullish crossover' };
//   if (prevShortEma > prevLongEma && shortEma < longEma)
//     return { action: 'sell', reason: 'EMA bearish crossover' };
//   return { action: 'hold', reason: 'EMA no crossover' };
// }
// function getBollingerSignal(latestClose, lowerBand, upperBand, prevClose) {
//   if (prevClose < lowerBand && latestClose > lowerBand)
//     return { action: 'buy', reason: 'Price bounced off lower Bollinger Band' };
//   if (prevClose > upperBand && latestClose < upperBand)
//     return { action: 'sell', reason: 'Price dropped from upper Bollinger Band' };
//   return { action: 'hold', reason: 'Price within Bollinger Bands' };
// }

// // Combine multiple signals, priority: sell > buy > hold
// function combineSignals(signals) {
//   if (signals.some(s => s.action === 'sell')) return signals.find(s => s.action === 'sell');
//   if (signals.some(s => s.action === 'buy')) return signals.find(s => s.action === 'buy');
//   return { action: 'hold', reason: 'Consensus hold' };
// }

// // User subscriptions tracking
// const userSubscriptions = {};
// // Trade counts tracking
// const tradeCounts = {}; // { BTCUSDT: { buy: 0, sell: 0 }, ETHUSDT: {...} }

// io.on('connection', (socket) => {
//   console.log('User connected:', socket.id);

//   // User ke symbols subscribe karne ke liye
//   socket.on('subscribe', (symbols) => {
//     userSubscriptions[socket.id] = symbols;

//     // Pehla price immediately bhejo
//     (async () => {
//       for (let symbol of symbols) {
//         const klines = await getKlines(symbol, '1m', 2);
//         const last = klines[klines.length - 1];
//         if (last) {
//           socket.emit('priceUpdate', { symbol, price: parseFloat(last[4]) });
//         }
//       }
//     })();
//   });

//   // Buy/Sell order handle karen
//   socket.on('tradeOrder', async ({ symbol, action, quantity }) => {
//     if (!tradeCounts[symbol]) tradeCounts[symbol] = { buy: 0, sell: 0 };
//     if (action === 'buy' || action === 'sell') {
//       tradeCounts[symbol][action]++;
//     }

//     // Order success ka message bheje
//     socket.emit('tradeResult', {
//       symbol,
//       action,
//       quantity,
//       status: 'success',
//       message: `Order to ${action} ${quantity} ${symbol} placed successfully!`,
//       tradeCounts: tradeCounts[symbol],
//     });

//     // Sabko updated trade counts bheje realtime
//     io.emit('tradeCountsUpdate', { symbol, counts: tradeCounts[symbol] });
//   });

//   // Connection close hone par cleanup
//   socket.on('disconnect', () => {
//     delete userSubscriptions[socket.id];
//     console.log('User disconnected:', socket.id);
//   });
// });

// const timeframes = [
//   { label: "1m", interval: "1m" },
//   { label: "3m", interval: "3m" },
//   { label: "5m", interval: "5m" },
//   { label: "15m", interval: "15m" },
//   { label: "30m", interval: "30m" },
//   { label: "1h", interval: "1h" },
// ];

// // Har 1 second pe sab symbols ke indicators calculate karo aur signals bhejo
// setInterval(async () => {
//   const allSymbols = [...new Set(Object.values(userSubscriptions).flat())];

//   for (let symbol of allSymbols) {
//     let multiTimeFrameSignals = {};
//     for (let tf of timeframes) {
//       const klines = await getKlines(symbol, tf.interval, 100);
//       if (klines.length < 30) continue;
//       const closes = klines.map(c => parseFloat(c[4]));

//       const rsiArr = calculateRSI(closes);
//       const rsi = rsiArr[rsiArr.length - 1] || null;
//       const ema12Arr = calculateEMA(closes, 12);
//       const ema26Arr = calculateEMA(closes, 26);
//       if (ema12Arr.length < 2 || ema26Arr.length < 2) continue;
//       const macdArr = calculateMACD(closes);
//       if (macdArr.length < 2) continue;
//       const bbArr = calculateBollingerBands(closes);
//       if (bbArr.length < 2) continue;

//       // Previous & current values for crossover detection
//       const prevMacd = macdArr[macdArr.length - 2];
//       const currMacd = macdArr[macdArr.length - 1];
//       const prevEma12 = ema12Arr[ema12Arr.length - 2];
//       const currEma12 = ema12Arr[ema12Arr.length - 1];
//       const prevEma26 = ema26Arr[ema26Arr.length - 2];
//       const currEma26 = ema26Arr[ema26Arr.length - 1];
//       const prevClose = closes[closes.length - 2];
//       const currClose = closes[closes.length - 1];

//       // Signals from indicators
//       const rsiSignal = rsi !== null ? getRsiSignal(rsi) : { action: 'hold', reason: 'RSI insufficient data' };
//       const macdSignal = getMacdSignal(currMacd.MACD, currMacd.signal, prevMacd.MACD, prevMacd.signal);
//       const emaSignal = getEmaSignal(currEma12, currEma26, prevEma12, prevEma26);
//       const bbSignal = getBollingerSignal(currClose, bbArr[bbArr.length - 1].lower, bbArr[bbArr.length - 1].upper, prevClose);

//       const combined = combineSignals([rsiSignal, macdSignal, emaSignal, bbSignal]);

//       multiTimeFrameSignals[tf.label] = {
//         combined,
//         rsi: rsiSignal,
//         macd: macdSignal,
//         ema: emaSignal,
//         bollinger: bbSignal,
//         price: currClose,
//       };
//     }

//     // Har subscribed user ko signals bhejo
//     for (let [id, symbols] of Object.entries(userSubscriptions)) {
//       if (symbols.includes(symbol)) {
//         io.to(id).emit("multiTimeFrameSignals", {
//           symbol,
//           frames: multiTimeFrameSignals,
//         });
//       }
//     }
//   }
// }, 1000);

// // ---- Naya REST API endpoint for trade counts ----
// app.get('/api/tradeCounts', (req, res) => {
//   res.json({
//     success: true,
//     data: tradeCounts,
//   });
// });

// // Server start
// server.listen(3000, () => {
//   console.log('Server running on http://localhost:3000');
// });
