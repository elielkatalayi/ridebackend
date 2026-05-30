// backend/models/Notification.js (optionnel - pour historique)
const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

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
    type: DataTypes.ENUM(
      'new_post', 'post_like', 'post_comment', 'mention',
      'new_story', 'story_reply', 'group_post', 'page_post',
      'new_message', 'new_follower', 'group_join_request',
      'group_request_approved', 'user_joined_group'
    ),
    allowNull: false
  },
  title: {
    type: DataTypes.STRING(255),
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
  related_id: {
    type: DataTypes.STRING(36),
    allowNull: true
  },
  is_read: {
    type: DataTypes.BOOLEAN,
    defaultValue: false
  },
  is_delivered: {
    type: DataTypes.BOOLEAN,
    defaultValue: false
  },
  delivered_at: {
    type: DataTypes.DATE,
    allowNull: true
  },
  read_at: {
    type: DataTypes.DATE,
    allowNull: true
  }
}, {
  tableName: 'notifications',
  timestamps: true,
  indexes: [
    { fields: ['user_id'] },
    { fields: ['user_id', 'is_read'] },
    { fields: ['created_at'] }
  ]
});

module.exports = Notification;