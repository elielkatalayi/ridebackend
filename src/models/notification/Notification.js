const { DataTypes } = require('sequelize');
const { sequelize } = require('../../config/database');

const Notification = sequelize.define('Notification', {
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
  type: {
    type: DataTypes.STRING(50),
    allowNull: false,
    validate: {
      isIn: [['ride', 'payment', 'wallet', 'driver', 'sos', 'auth',
               'chat_private', 'chat_group', 'social_post', 'social_comment',
               'social_reply', 'social_like', 'social_mention', 'social_follow',
               'story', 'story_comment', 'story_reply', 'story_mention', 'story_reaction',
               'rental', 'heavy_equipment', 'admin', 'system']]
    }
  },
  subtype: {
    type: DataTypes.STRING(50),
    allowNull: true
  },
  priority: {
    type: DataTypes.STRING(20),
    defaultValue: 'normal',
    validate: {
      isIn: [['critical', 'high', 'normal', 'low']]
    }
  },
  title: {
    type: DataTypes.TEXT,
    allowNull: false
  },
  body: {
    type: DataTypes.TEXT,
    allowNull: true
  },
  media_preview: {
    type: DataTypes.JSONB,
    defaultValue: {}
  },
  data: {
    type: DataTypes.JSONB,
    defaultValue: {},
    allowNull: false
  },
  reference_id: {
    type: DataTypes.UUID,
    allowNull: true
  },
  reference_type: {
    type: DataTypes.STRING(50),
    allowNull: true
  },
  actor_id: {
    type: DataTypes.UUID,
    allowNull: true,
    references: {
      model: 'users',
      key: 'id'
    },
    onDelete: 'SET NULL'
  },
  actor_type: {
    type: DataTypes.STRING(20),
    defaultValue: 'user',
    validate: {
      isIn: [['user', 'page', 'system', 'admin']]
    }
  },
  actor_name: {
    type: DataTypes.STRING(255),
    allowNull: true
  },
  actor_avatar: {
    type: DataTypes.TEXT,
    allowNull: true
  },
  status: {
    type: DataTypes.STRING(20),
    defaultValue: 'pending',
    validate: {
      isIn: [['pending', 'delivered', 'read', 'failed', 'cancelled']]
    }
  },
  delivered_at: {
    type: DataTypes.DATE,
    allowNull: true
  },
  read_at: {
    type: DataTypes.DATE,
    allowNull: true
  },
  interacted_at: {
    type: DataTypes.DATE,
    allowNull: true
  },
  delivery_channels: {
    type: DataTypes.JSONB,
    defaultValue: []
  },
  push_sent: {
    type: DataTypes.BOOLEAN,
    defaultValue: false
  },
  push_error: {
    type: DataTypes.TEXT,
    allowNull: true
  },
  socket_sent: {
    type: DataTypes.BOOLEAN,
    defaultValue: false
  },
  socket_error: {
    type: DataTypes.TEXT,
    allowNull: true
  },
  email_sent: {
    type: DataTypes.BOOLEAN,
    defaultValue: false
  },
  batch_id: {
    type: DataTypes.UUID,
    allowNull: true
  },
  batch_count: {
    type: DataTypes.INTEGER,
    defaultValue: 1
  },
  batch_aggregated: {
    type: DataTypes.BOOLEAN,
    defaultValue: false
  },
  expires_at: {
    type: DataTypes.DATE,
    allowNull: true
  },
  is_deleted: {
    type: DataTypes.BOOLEAN,
    defaultValue: false
  },
  deleted_at: {
    type: DataTypes.DATE,
    allowNull: true
  }
}, {
  tableName: 'notifications',
  timestamps: true,
  createdAt: 'created_at',
  updatedAt: 'updated_at',
  indexes: [
    { fields: ['user_id', 'created_at'] },
    { fields: ['user_id', 'status'] },
    { fields: ['reference_id', 'reference_type'] },
    { fields: ['batch_id'] },
    { fields: ['type', 'created_at'] },
    { fields: ['status', 'created_at'] }
  ]
});

// Associations
Notification.associate = (models) => {
  Notification.belongsTo(models.User, { foreignKey: 'user_id', as: 'user' });
  Notification.belongsTo(models.User, { foreignKey: 'actor_id', as: 'actor' });
};

module.exports = Notification;