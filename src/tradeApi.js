// tradeApi.js
const express = require('express');
const router = express.Router();

// Trade counts object to keep track (in-memory)
const tradeCounts = {}; 
// Optional: If you want to share this tradeCounts with index.js, export and import

// Route: Get trade counts for all symbols
router.get('/tradeCounts', (req, res) => {
  res.json({
    success: true,
    data: tradeCounts,
  });
});

// Optional route to reset counts (for testing/debugging)
router.post('/tradeCounts/reset', (req, res) => {
  for (const sym in tradeCounts) {
    tradeCounts[sym] = { buy: 0, sell: 0 };
  }
  res.json({ success: true, message: 'Trade counts reset' });
});

/*
  If you want to handle trade orders here (instead of socket),
  you can define API like POST /tradeOrder
  Otherwise keep trade orders via socket as before.
*/

module.exports = { router, tradeCounts };
