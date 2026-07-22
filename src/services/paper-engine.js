const config = require('../config');
const { Op } = require('sequelize');
const { PaperTrade, Token, Pool, PriceSnapshot } = require('../db');
const { sendWhatsApp } = require('./whatsapp');
const { getPair } = require('./dexscreener');
const logger = require('../logger');

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
    current_price: snapshot?.price_usd || null,
    current_value_usd: config.paper.tradeUsd,
    highest_price: snapshot?.price_usd || null,
    highest_pnl_percent: 0,
    last_checked_at: new Date(),
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

function calculatePnl(entryPrice, currentPrice, amountUsd) {
  const entry = Number(entryPrice);
  const current = Number(currentPrice);
  const amount = Number(amountUsd);
  if (!entry || !current || !amount) return null;

  const pnlPercent = ((current - entry) / entry) * 100;
  const currentValue = amount * (current / entry);
  return {
    pnlPercent,
    pnlUsd: currentValue - amount,
    currentValue,
  };
}

function shouldCloseTrade(pnlPercent, openedAt) {
  const ageHours = (Date.now() - new Date(openedAt).getTime()) / (60 * 60 * 1000);

  if (pnlPercent <= config.paper.stopLossPercent) {
    return 'stop_loss';
  }

  if (pnlPercent >= config.paper.moonbagProfitPercent) {
    return 'moonbag_target';
  }

  if (ageHours >= config.paper.maxHoldHours && pnlPercent < config.paper.takeProfitPercent) {
    return 'max_hold';
  }

  return null;
}

function shouldSendMilestone(trade, pnlPercent) {
  const lastAlert = trade.last_alert_at ? new Date(trade.last_alert_at).getTime() : 0;
  const quietMs = 15 * 60 * 1000;
  if (Date.now() - lastAlert < quietMs) return false;

  const highest = Number(trade.highest_pnl_percent || 0);
  if (pnlPercent >= 100 && highest < 100) return true;
  if (pnlPercent >= 200 && highest < 200) return true;
  if (pnlPercent >= 500 && highest < 500) return true;
  if (pnlPercent <= config.paper.stopLossPercent) return true;
  return false;
}

async function updateOpenTradesOnce() {
  const openTrades = await PaperTrade.findAll({
    where: { status: 'open' },
    include: [Token, Pool],
    limit: 200,
  });

  for (const trade of openTrades) {
    try {
      await updateTrade(trade);
    } catch (error) {
      logger.warn({ error: error.message, tradeId: trade.id }, 'paper trade update failed');
    }
  }
}

async function updateTrade(trade) {
  const pool = trade.Pool;
  const token = trade.Token;
  if (!pool || !token) return;

  const pair = await getPair('robinhood', pool.pool_address);
  if (!pair?.priceUsd) return;

  const priceUsd = Number(pair.priceUsd);
  const liquidityUsd = pair.liquidity?.usd ? Number(pair.liquidity.usd) : null;
  const snapshot = await PriceSnapshot.create({
    token_id: token.id,
    pool_id: pool.id,
    price_usd: priceUsd,
    liquidity_usd: liquidityUsd,
    volume_5m: pair.volume?.m5 || null,
    volume_1h: pair.volume?.h1 || null,
    market_cap: pair.marketCap || pair.fdv || null,
    captured_at: new Date(),
    source: 'paper_monitor',
  });

  if (!trade.entry_price) {
    await trade.update({
      entry_price: priceUsd,
      entry_liquidity_usd: liquidityUsd,
    });
  }

  const pnl = calculatePnl(trade.entry_price || priceUsd, priceUsd, trade.virtual_amount_usd);
  if (!pnl) return;

  const highestPnl = Math.max(Number(trade.highest_pnl_percent || 0), pnl.pnlPercent);
  const highestPrice = Math.max(Number(trade.highest_price || 0), priceUsd);
  const exitReason = shouldCloseTrade(pnl.pnlPercent, trade.opened_at);

  await trade.update({
    current_price: priceUsd,
    current_value_usd: pnl.currentValue,
    highest_price: highestPrice,
    highest_pnl_percent: highestPnl,
    last_checked_at: new Date(),
    ...(exitReason ? {
      status: 'closed',
      closed_at: new Date(),
      exit_price: priceUsd,
      pnl_usd: pnl.pnlUsd,
      pnl_percent: pnl.pnlPercent,
      exit_reason: exitReason,
    } : {}),
  });

  if (exitReason || shouldSendMilestone(trade, pnl.pnlPercent)) {
    await sendWhatsApp({
      tokenId: token.id,
      type: exitReason ? 'paper_exit' : 'paper_milestone',
      score: token.risk_score,
      message: [
        exitReason ? `PAPER EXIT ${exitReason}` : 'PAPER MILESTONE',
        `${token.symbol || 'UNKNOWN'} ${token.name || ''}`.trim(),
        `PnL: ${pnl.pnlPercent.toFixed(2)}% ($${pnl.pnlUsd.toFixed(2)})`,
        `Value: $${pnl.currentValue.toFixed(2)} from $${Number(trade.virtual_amount_usd).toFixed(2)}`,
        `Price: $${priceUsd}`,
        `Liquidity: ${liquidityUsd === null ? 'n/a' : `$${liquidityUsd.toFixed(0)}`}`,
        `Pool: ${pool.pool_address}`,
      ].join('\n'),
    });

    await trade.update({ last_alert_at: new Date() });
  }

  return snapshot;
}

async function sendPaperSummary() {
  const [openCount, closedTrades] = await Promise.all([
    PaperTrade.count({ where: { status: 'open' } }),
    PaperTrade.findAll({
      where: {
        status: 'closed',
        closed_at: { [Op.gte]: new Date(Date.now() - 24 * 60 * 60 * 1000) },
      },
      limit: 500,
    }),
  ]);

  const realized = closedTrades.reduce((sum, trade) => sum + Number(trade.pnl_usd || 0), 0);
  const winners = closedTrades.filter((trade) => Number(trade.pnl_usd || 0) > 0).length;
  const losers = closedTrades.filter((trade) => Number(trade.pnl_usd || 0) <= 0).length;

  await sendWhatsApp({
    type: 'paper_summary',
    message: [
      'PAPER SUMMARY 24h',
      `Open: ${openCount}`,
      `Closed: ${closedTrades.length}`,
      `Winners: ${winners}`,
      `Losers: ${losers}`,
      `Realized PnL: $${realized.toFixed(2)}`,
    ].join('\n'),
  });
}

class PaperMonitor {
  constructor() {
    this.running = false;
    this.monitorTimer = null;
    this.summaryTimer = null;
  }

  start() {
    this.running = true;
    logger.info('paper monitor started');
    updateOpenTradesOnce().catch((error) => logger.warn({ error: error.message }, 'initial paper monitor failed'));
    this.monitorTimer = setInterval(() => {
      updateOpenTradesOnce().catch((error) => logger.warn({ error: error.message }, 'paper monitor failed'));
    }, config.paper.monitorMs);
    this.summaryTimer = setInterval(() => {
      sendPaperSummary().catch((error) => logger.warn({ error: error.message }, 'paper summary failed'));
    }, config.paper.summaryMs);
  }

  stop() {
    this.running = false;
    if (this.monitorTimer) clearInterval(this.monitorTimer);
    if (this.summaryTimer) clearInterval(this.summaryTimer);
  }
}

module.exports = {
  maybeOpenPaperTrade,
  updateOpenTradesOnce,
  sendPaperSummary,
  PaperMonitor,
};
