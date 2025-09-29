// const { RSI, MACD } = require('technicalindicators');
// const { getCandles, placeMarketBuy } = require('../services/binanceService');

// async function checkIndicatorsAndTrade(symbol, buyQuantity) {
//   // 1. Fetch recent candles
//   const candles = await getCandles(symbol, '1h', 100);
//   const closes = candles.map(c => c.close);

//   // 2. Calculate RSI
//   const rsi = RSI.calculate({ values: closes, period: 14 });
//   const latestRsi = rsi[rsi.length - 1];

//   // 3. Calculate MACD
//   const macdInput = {
//     values: closes,
//     fastPeriod: 12,
//     slowPeriod: 26,
//     signalPeriod: 9,
//     SimpleMAOscillator: false,
//     SimpleMASignal: false
//   };
//   const macd = MACD.calculate(macdInput);
//   const latestMacd = macd[macd.length - 1];

//   // 4. Define your buy condition
//   const rsiBuy = latestRsi < 30; // Oversold
//   const macdBuy = latestMacd.MACD > latestMacd.signal && latestMacd.histogram > 0; // MACD bullish

//   if (rsiBuy && macdBuy) {
//     console.log('Buy signal detected. Placing order...');
//     const order = await placeMarketBuy(symbol, buyQuantity);
//     console.log('Order response:', order);
//   } else {
//     console.log(`No buy signal. RSI: ${latestRsi}, MACD: ${latestMacd.MACD}, Signal: ${latestMacd.signal}`);
//   }
// }

// module.exports = { checkIndicatorsAndTrade };

const { RSI, MACD, EMA, BollingerBands } = require("technicalindicators");
const { getCandles, placeMarketBuy } = require("../services/binanceService");

async function checkIndicatorsAndTrade(symbol, buyQuantity) {
  // 1. Fetch recent candles
  //   const candles = await getCandles(symbol, '1h', 100);         // 1 hours strategies
  // 5 min candle strategies
  const candles = await getCandles(symbol, "15m", 100);
  const closes = candles.map((c) => c.close);

  // 2. Calculate RSI
  const rsi = RSI.calculate({ values: closes, period: 14 });
  const latestRsi = rsi[rsi.length - 1];

  // 3. Calculate MACD
  const macdInput = {
    values: closes,
    fastPeriod: 12,
    slowPeriod: 26,
    signalPeriod: 9,
    SimpleMAOscillator: false,
    SimpleMASignal: false,
  };
  const macd = MACD.calculate(macdInput);
  const latestMacd = macd[macd.length - 1];

  // 4. Calculate EMA
  const ema = EMA.calculate({ values: closes, period: 21 });
  const latestEma = ema[ema.length - 1];

  // 5. Calculate Bollinger Bands
  const bbInput = {
    period: 20,
    values: closes,
    stdDev: 2,
  };
  const bb = BollingerBands.calculate(bbInput);
  const latestBb = bb[bb.length - 1];

  // 6. Define your buy conditions
  const rsiBuy = latestRsi < 30;
  const macdBuy =
    latestMacd &&
    latestMacd.MACD > latestMacd.signal &&
    latestMacd.histogram > 0;
  const price = closes[closes.length - 1];
  const emaBuy = price > latestEma;
  const bbBuy = price < latestBb.lower; // price is below lower Bollinger Band

  // 7. Combine conditions as you like (all must be true)
  if (rsiBuy && macdBuy && emaBuy && bbBuy) {
    console.log("Buy signal detected by all indicators. Placing order...");
    const order = await placeMarketBuy(symbol, buyQuantity);
    console.log("Order response:", order);
  } else {
    console.log(
      `No buy signal. RSI: ${latestRsi}, MACD: ${latestMacd?.MACD}, EMA: ${latestEma}, BB Lower: ${latestBb?.lower}, Price: ${price}`
    );
  }
}

module.exports = { checkIndicatorsAndTrade };

// How the Logic Works
// RSI: Buy if oversold (RSI < 30)

// MACD: Buy if MACD line crosses above signal line and histogram is positive

// EMA: Buy if current price is above EMA (trend confirmation)

// Bollinger Bands: Buy if price is below the lower band (potential reversal)

// You can adjust these conditions or thresholds to suit your strategy.
