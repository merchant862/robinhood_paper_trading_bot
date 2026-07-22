const { sequelize } = require('./db');
const logger = require('./logger');
const { UniswapLogPoller } = require('./feeds/uniswap-log-poller');
const { DexScreenerPoller } = require('./feeds/dexscreener-poller');
const { PaperMonitor } = require('./services/paper-engine');

async function main() {
  await sequelize.authenticate();
  logger.info('database connected');

  const uniswap = new UniswapLogPoller();
  const dexscreener = new DexScreenerPoller();
  const paperMonitor = new PaperMonitor();

  const shutdown = async () => {
    logger.info('shutting down');
    uniswap.stop();
    dexscreener.stop();
    paperMonitor.stop();
    await sequelize.close();
    process.exit(0);
  };

  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);

  paperMonitor.start();

  await Promise.all([
    uniswap.start(),
    dexscreener.start(),
  ]);
}

main().catch((error) => {
  logger.error({ error }, 'bot crashed');
  process.exit(1);
});
