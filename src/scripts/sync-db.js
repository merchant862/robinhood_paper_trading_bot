const { sequelize } = require('../db');
const logger = require('../logger');

async function main() {
  await sequelize.authenticate();
  await sequelize.sync({ alter: true });
  logger.info('database synced');
  await sequelize.close();
}

main().catch((error) => {
  logger.error({ error }, 'database sync failed');
  process.exit(1);
});
