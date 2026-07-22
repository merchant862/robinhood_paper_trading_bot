const { Sequelize } = require('sequelize');
const config = require('../config');

const sequelize = new Sequelize(config.db.name, config.db.user, config.db.password, {
  host: config.db.host,
  port: config.db.port,
  dialect: 'mysql',
  logging: false,
  define: {
    underscored: true,
    timestamps: true,
  },
});

const Token = require('./models/token')(sequelize);
const Pool = require('./models/pool')(sequelize);
const PriceSnapshot = require('./models/price-snapshot')(sequelize);
const PaperTrade = require('./models/paper-trade')(sequelize);
const Alert = require('./models/alert')(sequelize);
const WalletEvent = require('./models/wallet-event')(sequelize);

Token.hasMany(Pool, { foreignKey: 'token_id' });
Pool.belongsTo(Token, { foreignKey: 'token_id' });

Token.hasMany(PriceSnapshot, { foreignKey: 'token_id' });
Pool.hasMany(PriceSnapshot, { foreignKey: 'pool_id' });
PriceSnapshot.belongsTo(Token, { foreignKey: 'token_id' });
PriceSnapshot.belongsTo(Pool, { foreignKey: 'pool_id' });

Token.hasMany(PaperTrade, { foreignKey: 'token_id' });
Pool.hasMany(PaperTrade, { foreignKey: 'pool_id' });
PaperTrade.belongsTo(Token, { foreignKey: 'token_id' });
PaperTrade.belongsTo(Pool, { foreignKey: 'pool_id' });

Token.hasMany(Alert, { foreignKey: 'token_id' });
Alert.belongsTo(Token, { foreignKey: 'token_id' });

Token.hasMany(WalletEvent, { foreignKey: 'token_id' });
Pool.hasMany(WalletEvent, { foreignKey: 'pool_id' });

module.exports = {
  sequelize,
  Token,
  Pool,
  PriceSnapshot,
  PaperTrade,
  Alert,
  WalletEvent,
};
