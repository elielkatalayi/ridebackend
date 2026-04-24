const { DataTypes } = require('sequelize');
const { sequelize } = require('../../config/database');

const PendingPushNotification = sequelize.define('PendingPushNotification', {
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
  notification_id: {
    type: DataTypes.UUID,
    allowNull: true,
    references: {
      model: 'notifications',
      key: 'id'
    },
    onDelete: 'SET NULL'
  },
  title: {
    type: DataTypes.TEXT,
    allowNull: false
  },
  body: {
    type: DataTypes.TEXT,
    allowNull: true
  },
  data: {
    type: DataTypes.JSONB,
    defaultValue: {}
  },
  image_url: {
    type: DataTypes.TEXT,
    allowNull: true
  },
  attempts: {
    type: DataTypes.INTEGER,
    defaultValue: 0
  },
  max_attempts: {
    type: DataTypes.INTEGER,
    defaultValue: 3
  },
  last_attempt_at: {
    type: DataTypes.DATE,
    allowNull: true
  },
  next_attempt_at: {
    type: DataTypes.DATE,
    allowNull: true
  },
  status: {
    type: DataTypes.STRING(20),
    defaultValue: 'pending',
    validate: {
      isIn: [['pending', 'processing', 'sent', 'failed', 'expired']]
    }
  },
  expires_at: {
    type: DataTypes.DATE,
    defaultValue: () => new Date(Date.now() + 48 * 60 * 60 * 1000)
  }
}, {
  tableName: 'pending_push_notifications',
  timestamps: true,
  createdAt: 'created_at',
  updatedAt: 'updated_at',
  indexes: [
    { fields: ['user_id'] },
    { fields: ['status', 'next_attempt_at'] },
    { fields: ['expires_at'] },
    { fields: ['status', 'attempts'] }
  ]
});

// Associations
PendingPushNotification.associate = (models) => {
  PendingPushNotification.belongsTo(models.User, { foreignKey: 'user_id', as: 'user' });
  PendingPushNotification.belongsTo(models.Notification, { foreignKey: 'notification_id', as: 'notification' });
};

module.exports = PendingPushNotification;