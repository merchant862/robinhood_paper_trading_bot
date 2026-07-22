const { DataTypes } = require('sequelize');

module.exports = (sequelize) => sequelize.define('PaperTrade', {
  token_id: { type: DataTypes.INTEGER, allowNull: false },
  pool_id: { type: DataTypes.INTEGER, allowNull: false },
  entry_price: { type: DataTypes.DECIMAL(28, 12), allowNull: true },
  entry_liquidity_usd: { type: DataTypes.DECIMAL(28, 8), allowNull: true },
  entry_score: { type: DataTypes.INTEGER, allowNull: false },
  virtual_amount_usd: { type: DataTypes.DECIMAL(18, 8), allowNull: false },
  status: { type: DataTypes.STRING(32), allowNull: false, defaultValue: 'open' },
  opened_at: { type: DataTypes.DATE, allowNull: false },
  closed_at: { type: DataTypes.DATE, allowNull: true },
  exit_price: { type: DataTypes.DECIMAL(28, 12), allowNull: true },
  pnl_usd: { type: DataTypes.DECIMAL(28, 8), allowNull: true },
  pnl_percent: { type: DataTypes.DECIMAL(18, 6), allowNull: true },
  exit_reason: { type: DataTypes.STRING(64), allowNull: true },
});
