const { DataTypes } = require('sequelize');

module.exports = (sequelize) => sequelize.define('WalletEvent', {
  token_id: { type: DataTypes.INTEGER, allowNull: false },
  pool_id: { type: DataTypes.INTEGER, allowNull: true },
  wallet_address: { type: DataTypes.STRING(42), allowNull: false },
  event_type: { type: DataTypes.STRING(64), allowNull: false },
  amount_usd: { type: DataTypes.DECIMAL(28, 8), allowNull: true },
  tx_hash: { type: DataTypes.STRING(66), allowNull: true },
  seen_at: { type: DataTypes.DATE, allowNull: false },
  source: { type: DataTypes.STRING(64), allowNull: false },
});
