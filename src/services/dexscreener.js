const axios = require('axios');

async function getPair(chainId, pairAddress) {
  const response = await axios.get(`https://api.dexscreener.com/latest/dex/pairs/${chainId}/${pairAddress}`, {
    timeout: 15000,
  });
  const pairs = Array.isArray(response.data?.pairs) ? response.data.pairs : [];
  return pairs[0] || null;
}

module.exports = { getPair };
