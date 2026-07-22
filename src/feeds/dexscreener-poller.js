const { JsonRpcProvider } = require('ethers');
const axios = require('axios');
const config = require('../config');
const logger = require('../logger');
const { handleDexScreenerPair } = require('../services/token-processor');

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

class DexScreenerPoller {
  constructor() {
    this.provider = new JsonRpcProvider(config.chain.httpRpc, config.chain.id);
    this.running = false;
    this.seenPairs = new Set();
  }

  async start() {
    if (!config.dexscreener.enabled) return;

    this.running = true;
    logger.info('dexscreener poller started');
    while (this.running) {
      try {
        await this.pollOnce();
      } catch (error) {
        logger.warn({ error: error.message }, 'dexscreener poll failed');
      }
      await sleep(config.dexscreener.pollMs);
    }
  }

  stop() {
    this.running = false;
  }

  async pollOnce() {
    const response = await axios.get('https://api.dexscreener.com/latest/dex/search', {
      params: { q: 'robinhood' },
      timeout: 15000,
    });

    const pairs = Array.isArray(response.data?.pairs) ? response.data.pairs : [];
    for (const pair of pairs) {
      const chainId = String(pair.chainId || '').toLowerCase();
      const pairAddress = String(pair.pairAddress || '').toLowerCase();
      if (!pairAddress || chainId !== 'robinhood') continue;

      const firstTime = !this.seenPairs.has(pairAddress);
      this.seenPairs.add(pairAddress);

      if (firstTime || Number(pair.liquidity?.usd || 0) >= 3000) {
        await handleDexScreenerPair(this.provider, pair);
      }
    }
  }
}

module.exports = { DexScreenerPoller };
