const { DataTypes } = require('sequelize');
const { sequelize } = require('../../config/database');

const NotificationBatch = sequelize.define('NotificationBatch', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true
  },
  user_id: {
    type: DataTypes.UUID,
    allowNull: false,
    references: {
      model: 'users',
      key: 'id'
    },
    onDelete: 'CASCADE'
  },
  batch_key: {
    type: DataTypes.STRING(255),
    allowNull: false
  },
  type: {
    type: DataTypes.STRING(50),
    allowNull: false
  },
  subtype: {
    type: DataTypes.STRING(50),
    allowNull: true
  },
  count: {
    type: DataTypes.INTEGER,
    defaultValue: 1
  },
  last_aggregated_at: {
    type: DataTypes.DATE,
    allowNull: true
  },
  last_notification_id: {
    type: DataTypes.UUID,
    allowNull: true
  },
  aggregation_delay: {
    type: DataTypes.INTEGER,
    defaultValue: 10
  },
  timer_active: {
    type: DataTypes.BOOLEAN,
    defaultValue: false
  }
}, {
  tableName: 'notification_batches',
  timestamps: true,
  createdAt: 'created_at',
  updatedAt: 'updated_at',
  indexes: [
    { fields: ['user_id', 'batch_key'], unique: true },
    { fields: ['user_id', 'type'] },
    { fields: ['timer_active'] }
  ]
});

// Associations
NotificationBatch.associate = (models) => {
  NotificationBatch.belongsTo(models.User, { foreignKey: 'user_id', as: 'user' });
};

module.exports = NotificationBatch;