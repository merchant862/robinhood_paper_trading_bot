const { DataTypes } = require('sequelize');

module.exports = (sequelize) => sequelize.define('Token', {
  chain_id: { type: DataTypes.INTEGER, allowNull: false },
  token_address: { type: DataTypes.STRING(42), allowNull: false, unique: true },
  symbol: { type: DataTypes.STRING(64), allowNull: true },
  name: { type: DataTypes.STRING(255), allowNull: true },
  decimals: { type: DataTypes.INTEGER, allowNull: true },
  deployer_address: { type: DataTypes.STRING(42), allowNull: true },
  first_seen_at: { type: DataTypes.DATE, allowNull: false },
  risk_score: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
  status: { type: DataTypes.STRING(32), allowNull: false, defaultValue: 'new' },
  source: { type: DataTypes.STRING(64), allowNull: false },
  notes: { type: DataTypes.TEXT, allowNull: true },
});
