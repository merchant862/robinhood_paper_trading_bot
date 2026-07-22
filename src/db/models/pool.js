const { DataTypes } = require('sequelize');

module.exports = (sequelize) => sequelize.define('Pool', {
  token_id: { type: DataTypes.INTEGER, allowNull: false },
  dex: { type: DataTypes.STRING(64), allowNull: false },
  pool_address: { type: DataTypes.STRING(66), allowNull: false, unique: true },
  base_token: { type: DataTypes.STRING(42), allowNull: false },
  quote_token: { type: DataTypes.STRING(42), allowNull: false },
  fee_tier: { type: DataTypes.INTEGER, allowNull: true },
  liquidity_usd: { type: DataTypes.DECIMAL(28, 8), allowNull: true },
  first_seen_at: { type: DataTypes.DATE, allowNull: false },
  source: { type: DataTypes.STRING(64), allowNull: false },
});
