const config = require('../config');
const { PaperTrade } = require('../db');
const { sendWhatsApp } = require('./whatsapp');

async function maybeOpenPaperTrade({ token, pool, snapshot, score, reasons }) {
  if (score < config.paper.minScore) return null;

  const openCount = await PaperTrade.count({ where: { status: 'open' } });
  if (openCount >= config.paper.maxOpenTrades) return null;

  const existing = await PaperTrade.findOne({
    where: { token_id: token.id, status: 'open' },
  });
  if (existing) return existing;

  const trade = await PaperTrade.create({
    token_id: token.id,
    pool_id: pool.id,
    entry_price: snapshot?.price_usd || null,
    entry_liquidity_usd: snapshot?.liquidity_usd || pool.liquidity_usd || null,
    entry_score: score,
    virtual_amount_usd: config.paper.tradeUsd,
    status: 'open',
    opened_at: new Date(),
  });

  await sendWhatsApp({
    tokenId: token.id,
    type: 'paper_entry',
    score,
    message: [
      `PAPER ENTRY score ${score}`,
      `${token.symbol || 'UNKNOWN'} ${token.name || ''}`.trim(),
      `Token: ${token.token_address}`,
      `Pool: ${pool.pool_address}`,
      `Size: $${config.paper.tradeUsd}`,
      `Reasons: ${reasons.join(', ') || 'n/a'}`,
    ].join('\n'),
  });

  return trade;
}

module.exports = { maybeOpenPaperTrade };
