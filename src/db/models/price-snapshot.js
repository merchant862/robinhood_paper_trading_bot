const { DataTypes } = require('sequelize');

module.exports = (sequelize) => sequelize.define('PriceSnapshot', {
  token_id: { type: DataTypes.INTEGER, allowNull: false },
  pool_id: { type: DataTypes.INTEGER, allowNull: false },
  price_usd: { type: DataTypes.DECIMAL(28, 12), allowNull: true },
  liquidity_usd: { type: DataTypes.DECIMAL(28, 8), allowNull: true },
  volume_5m: { type: DataTypes.DECIMAL(28, 8), allowNull: true },
  volume_1h: { type: DataTypes.DECIMAL(28, 8), allowNull: true },
  market_cap: { type: DataTypes.DECIMAL(28, 8), allowNull: true },
  captured_at: { type: DataTypes.DATE, allowNull: false },
  source: { type: DataTypes.STRING(64), allowNull: false },
});
