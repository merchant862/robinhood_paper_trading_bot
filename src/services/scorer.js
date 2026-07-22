const constants = require('../constants');

function scoreToken({ token, pool, snapshot }) {
  let score = 35;
  const reasons = [];

  if (constants.quoteTokens.has(String(pool.quote_token).toLowerCase())) {
    score += 15;
    reasons.push('quoted against WETH/USDG');
  }

  const liquidity = Number(snapshot?.liquidity_usd || pool.liquidity_usd || 0);
  if (liquidity >= 10000) {
    score += 20;
    reasons.push('liquidity >= $10k');
  } else if (liquidity >= 3000) {
    score += 10;
    reasons.push('liquidity >= $3k');
  } else {
    score -= 15;
    reasons.push('thin liquidity');
  }

  const symbol = String(token.symbol || '').toLowerCase();
  const name = String(token.name || '').toLowerCase();
  const memeHints = ['cat', 'cash', 'hood', 'robin', 'stock', 'wall', 'street', 'moon', 'rwa'];
  if (memeHints.some((hint) => symbol.includes(hint) || name.includes(hint))) {
    score += 10;
    reasons.push('meme/narrative keyword');
  }

  if (!token.symbol || !token.name) {
    score -= 10;
    reasons.push('missing metadata');
  }

  return {
    score: Math.max(0, Math.min(100, score)),
    reasons,
  };
}

module.exports = { scoreToken };
