require('dotenv').config();

function numberEnv(name, fallback) {
  const value = process.env[name];
  if (value === undefined || value === '') return fallback;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function boolEnv(name, fallback = false) {
  const value = process.env[name];
  if (value === undefined || value === '') return fallback;
  return ['1', 'true', 'yes', 'on'].includes(String(value).toLowerCase());
}

module.exports = {
  chain: {
    id: numberEnv('ROBINHOOD_CHAIN_ID', 4663),
    httpRpc: process.env.ROBINHOOD_RPC_HTTP || 'https://rpc.mainnet.chain.robinhood.com',
    wssRpc: process.env.ROBINHOOD_RPC_WSS || 'wss://feed.mainnet.chain.robinhood.com',
    explorerBaseUrl: 'https://robinhoodchain.blockscout.com',
  },
  db: {
    host: process.env.DB_HOST || '127.0.0.1',
    port: numberEnv('DB_PORT', 3306),
    name: process.env.DB_NAME || 'robinhood_bot',
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
  },
  whatsapp: {
    enabled: boolEnv('WHATSAPP_ENABLED', false),
    apiUrl: process.env.GREEN_API_URL || 'https://api.green-api.com',
    instanceId: process.env.GREEN_API_INSTANCE_ID || '',
    token: process.env.GREEN_API_TOKEN || '',
    chatId: process.env.WHATSAPP_CHAT_ID || '',
    minScore: numberEnv('WHATSAPP_MIN_SCORE', 70),
    maxPerHour: numberEnv('WHATSAPP_MAX_ALERTS_PER_HOUR', 30),
  },
  paper: {
    tradeUsd: numberEnv('PAPER_TRADE_USD', 50),
    minScore: numberEnv('PAPER_ENTRY_MIN_SCORE', 70),
    maxOpenTrades: numberEnv('PAPER_MAX_OPEN_TRADES', 20),
    monitorMs: numberEnv('PAPER_MONITOR_MS', 60000),
    summaryMs: numberEnv('PAPER_SUMMARY_MS', 3600000),
    stopLossPercent: numberEnv('PAPER_STOP_LOSS_PERCENT', -50),
    takeProfitPercent: numberEnv('PAPER_TAKE_PROFIT_PERCENT', 100),
    moonbagProfitPercent: numberEnv('PAPER_MOONBAG_PROFIT_PERCENT', 500),
    maxHoldHours: numberEnv('PAPER_MAX_HOLD_HOURS', 24),
  },
  scanner: {
    sequencerFeedEnabled: boolEnv('SEQUENCER_FEED_ENABLED', true),
    pollMs: numberEnv('CHAIN_POLL_MS', 5000),
    httpFallbackMs: numberEnv('CHAIN_HTTP_FALLBACK_MS', 60000),
    lookbackBlocks: numberEnv('CHAIN_LOOKBACK_BLOCKS', 250),
    maxBlockRange: numberEnv('CHAIN_MAX_BLOCK_RANGE', 200),
  },
  dexscreener: {
    enabled: boolEnv('DEXSCREENER_ENABLED', true),
    pollMs: numberEnv('DEXSCREENER_POLL_MS', 30000),
  },
};
