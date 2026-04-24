const { DataTypes } = require('sequelize');
const { sequelize } = require('../../config/database');

const UserDevice = sequelize.define('UserDevice', {
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
  device_token: {
    type: DataTypes.TEXT,
    allowNull: false,
    unique: true
  },
  platform: {
    type: DataTypes.STRING(20),
    allowNull: false,
    validate: {
      isIn: [['ios', 'android', 'web']]
    }
  },
  app_version: {
    type: DataTypes.STRING(20),
    allowNull: true
  },
  os_version: {
    type: DataTypes.STRING(20),
    allowNull: true
  },
  device_model: {
    type: DataTypes.STRING(100),
    allowNull: true
  },
  locale: {
    type: DataTypes.STRING(10),
    defaultValue: 'fr'
  },
  timezone: {
    type: DataTypes.STRING(50),
    defaultValue: 'Africa/Kinshasa'
  },
  is_active: {
    type: DataTypes.BOOLEAN,
    defaultValue: true
  },
  last_seen_at: {
    type: DataTypes.DATE,
    defaultValue: DataTypes.NOW
  },
  last_socket_connected_at: {
    type: DataTypes.DATE,
    allowNull: true
  }
}, {
  tableName: 'user_devices',
  timestamps: true,
  createdAt: 'created_at',
  updatedAt: 'updated_at',
  indexes: [
    { fields: ['user_id'] },
    { fields: ['device_token'] },
    { fields: ['user_id', 'is_active'] },
    { fields: ['platform', 'is_active'] }
  ]
});

// Associations
UserDevice.associate = (models) => {
  UserDevice.belongsTo(models.User, { foreignKey: 'user_id', as: 'user' });
};

module.exports = UserDevice;