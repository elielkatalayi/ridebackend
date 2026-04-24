const { DataTypes } = require('sequelize');
const { sequelize } = require('../../config/database');

const NotificationLog = sequelize.define('NotificationLog', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true
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
  user_id: {
    type: DataTypes.UUID,
    allowNull: false,
    references: {
      model: 'users',
      key: 'id'
    },
    onDelete: 'CASCADE'
  },
  channel: {
    type: DataTypes.STRING(20),
    allowNull: false,
    validate: {
      isIn: [['socket', 'push', 'email', 'in_app', 'system']]
    }
  },
  status: {
    type: DataTypes.STRING(20),
    defaultValue: 'sent',
    validate: {
      isIn: [['sent', 'failed', 'delivered', 'opened']]
    }
  },
  error_message: {
    type: DataTypes.TEXT,
    allowNull: true
  },
  sent_at: {
    type: DataTypes.DATE,
    defaultValue: DataTypes.NOW
  },
  delivered_at: {
    type: DataTypes.DATE,
    allowNull: true
  },
  metadata: {
    type: DataTypes.JSONB,
    defaultValue: {}
  }
}, {
  tableName: 'notification_logs',
  timestamps: false,
  indexes: [
    { fields: ['notification_id'] },
    { fields: ['user_id'] },
    { fields: ['channel'] },
    { fields: ['sent_at'] },
    { fields: ['status', 'sent_at'] }
  ]
});

// Associations
NotificationLog.associate = (models) => {
  NotificationLog.belongsTo(models.Notification, { foreignKey: 'notification_id', as: 'notification' });
  NotificationLog.belongsTo(models.User, { foreignKey: 'user_id', as: 'user' });
};

module.exports = NotificationLog;