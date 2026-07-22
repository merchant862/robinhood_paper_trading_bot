const { DataTypes } = require('sequelize');

module.exports = (sequelize) => sequelize.define('Alert', {
  token_id: { type: DataTypes.INTEGER, allowNull: true },
  alert_type: { type: DataTypes.STRING(64), allowNull: false },
  score: { type: DataTypes.INTEGER, allowNull: true },
  message: { type: DataTypes.TEXT, allowNull: false },
  sent_to: { type: DataTypes.STRING(128), allowNull: true },
  sent_at: { type: DataTypes.DATE, allowNull: false },
  status: { type: DataTypes.STRING(32), allowNull: false, defaultValue: 'sent' },
});
