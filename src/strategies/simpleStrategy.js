const { getPrice } = require("../services/binanceService");

async function run(symbol) {
  const price = await getPrice(symbol);
  console.log(`Current price of ${symbol}: ${price}`);

  // Implement your buy/sell logic here
  // Example: Buy if price is below a threshold (dummy logic)
  if (parseFloat(price) < 30000) {
    console.log("Buy signal!");
    // Place buy order here
  } else {
    console.log("No action.");
  }
}

module.exports = { run };
