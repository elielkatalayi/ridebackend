const { DataTypes } = require('sequelize');
const { sequelize } = require('../../config/database');

const NotificationTemplate = sequelize.define('NotificationTemplate', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true
  },
  template_key: {
    type: DataTypes.STRING(100),
    allowNull: false,
    unique: true
  },
  type: {
    type: DataTypes.STRING(50),
    allowNull: false
  },
  subtype: {
    type: DataTypes.STRING(50),
    allowNull: true
  },
  locale: {
    type: DataTypes.STRING(10),
    defaultValue: 'fr'
  },
  title_template: {
    type: DataTypes.TEXT,
    allowNull: false
  },
  body_template: {
    type: DataTypes.TEXT,
    allowNull: true
  },
  default_priority: {
    type: DataTypes.STRING(20),
    defaultValue: 'normal',
    validate: {
      isIn: [['critical', 'high', 'normal', 'low']]
    }
  },
  default_push: {
    type: DataTypes.BOOLEAN,
    defaultValue: true
  },
  default_in_app: {
    type: DataTypes.BOOLEAN,
    defaultValue: true
  },
  ttl_seconds: {
    type: DataTypes.INTEGER,
    defaultValue: 604800
  },
  is_active: {
    type: DataTypes.BOOLEAN,
    defaultValue: true
  }
}, {
  tableName: 'notification_templates',
  timestamps: true,
  createdAt: 'created_at',
  updatedAt: 'updated_at',
  indexes: [
    { fields: ['type', 'subtype', 'locale'] },
    { fields: ['template_key'] },
    { fields: ['is_active'] }
  ]
});

module.exports = NotificationTemplate;