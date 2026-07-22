const config = require('../config');
const constants = require('../constants');
const { Token, Pool, PriceSnapshot } = require('../db');
const { getTokenMetadata } = require('./token-metadata');
const { scoreToken } = require('./scorer');
const { maybeOpenPaperTrade } = require('./paper-engine');
const { sendWhatsApp } = require('./whatsapp');
const logger = require('../logger');

function lower(address) {
  return String(address).toLowerCase();
}

function chooseBaseAndQuote(token0, token1) {
  const t0 = lower(token0);
  const t1 = lower(token1);

  if (constants.quoteTokens.has(t0) && !constants.quoteTokens.has(t1)) {
    return { baseToken: token1, quoteToken: token0 };
  }

  if (constants.quoteTokens.has(t1) && !constants.quoteTokens.has(t0)) {
    return { baseToken: token0, quoteToken: token1 };
  }

  return { baseToken: token0, quoteToken: token1 };
}

async function upsertToken(provider, address, source) {
  const tokenAddress = lower(address);
  const [token, created] = await Token.findOrCreate({
    where: { token_address: tokenAddress },
    defaults: {
      chain_id: config.chain.id,
      token_address: tokenAddress,
      first_seen_at: new Date(),
      source,
    },
  });

  if (created || !token.symbol || !token.name) {
    const metadata = await getTokenMetadata(provider, tokenAddress);
    await token.update(metadata);
  }

  return token;
}

async function upsertPool({ token, dex, poolAddress, baseToken, quoteToken, feeTier, source, liquidityUsd = null }) {
  const [pool] = await Pool.findOrCreate({
    where: { pool_address: lower(poolAddress) },
    defaults: {
      token_id: token.id,
      dex,
      pool_address: lower(poolAddress),
      base_token: lower(baseToken),
      quote_token: lower(quoteToken),
      fee_tier: feeTier || null,
      liquidity_usd: liquidityUsd,
      first_seen_at: new Date(),
      source,
    },
  });

  if (liquidityUsd !== null) {
    await pool.update({ liquidity_usd: liquidityUsd });
  }

  return pool;
}

async function handlePoolDetected(provider, event) {
  const { baseToken, quoteToken } = chooseBaseAndQuote(event.token0, event.token1);
  const token = await upsertToken(provider, baseToken, event.source);
  const pool = await upsertPool({
    token,
    dex: event.dex,
    poolAddress: event.poolAddress,
    baseToken,
    quoteToken,
    feeTier: event.feeTier || null,
    source: event.source,
  });

  const snapshot = await PriceSnapshot.create({
    token_id: token.id,
    pool_id: pool.id,
    price_usd: null,
    liquidity_usd: pool.liquidity_usd,
    volume_5m: null,
    volume_1h: null,
    market_cap: null,
    captured_at: new Date(),
    source: event.source,
  });

  const scored = scoreToken({ token, pool, snapshot });
  await token.update({ risk_score: scored.score });

  logger.info({
    dex: event.dex,
    token: token.token_address,
    symbol: token.symbol,
    pool: pool.pool_address,
    score: scored.score,
  }, 'new pool detected');

  if (scored.score >= config.whatsapp.minScore) {
    await sendWhatsApp({
      tokenId: token.id,
      type: 'new_pool',
      score: scored.score,
      message: [
        `NEW POOL score ${scored.score}`,
        `${token.symbol || 'UNKNOWN'} ${token.name || ''}`.trim(),
        `DEX: ${event.dex}`,
        `Token: ${token.token_address}`,
        `Pool: ${pool.pool_address}`,
        `${config.chain.explorerBaseUrl}/address/${token.token_address}`,
        `Reasons: ${scored.reasons.join(', ') || 'n/a'}`,
      ].join('\n'),
    });
  }

  await maybeOpenPaperTrade({ token, pool, snapshot, score: scored.score, reasons: scored.reasons });
}

async function handleDexScreenerPair(provider, pair) {
  const baseAddress = pair.baseToken?.address;
  const quoteAddress = pair.quoteToken?.address;
  const poolAddress = pair.pairAddress;
  if (!baseAddress || !quoteAddress || !poolAddress) return;

  const token = await upsertToken(provider, baseAddress, 'dexscreener');
  if (pair.baseToken?.symbol || pair.baseToken?.name) {
    await token.update({
      symbol: token.symbol || pair.baseToken.symbol || null,
      name: token.name || pair.baseToken.name || null,
    });
  }

  const liquidityUsd = pair.liquidity?.usd ? Number(pair.liquidity.usd) : null;
  const pool = await upsertPool({
    token,
    dex: pair.dexId || 'unknown',
    poolAddress,
    baseToken: baseAddress,
    quoteToken: quoteAddress,
    feeTier: null,
    source: 'dexscreener',
    liquidityUsd,
  });

  const snapshot = await PriceSnapshot.create({
    token_id: token.id,
    pool_id: pool.id,
    price_usd: pair.priceUsd || null,
    liquidity_usd: liquidityUsd,
    volume_5m: pair.volume?.m5 || null,
    volume_1h: pair.volume?.h1 || null,
    market_cap: pair.marketCap || pair.fdv || null,
    captured_at: new Date(),
    source: 'dexscreener',
  });

  const scored = scoreToken({ token, pool, snapshot });
  await token.update({ risk_score: scored.score });

  await maybeOpenPaperTrade({ token, pool, snapshot, score: scored.score, reasons: scored.reasons });
}

module.exports = {
  handlePoolDetected,
  handleDexScreenerPair,
};
