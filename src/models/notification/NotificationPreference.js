const { DataTypes } = require('sequelize');
const { sequelize } = require('../../config/database');

const NotificationPreference = sequelize.define('NotificationPreference', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true
  },
  user_id: {
    type: DataTypes.UUID,
    allowNull: false,
    unique: true,
    references: {
      model: 'users',
      key: 'id'
    },
    onDelete: 'CASCADE'
  },
  push_enabled: {
    type: DataTypes.BOOLEAN,
    defaultValue: true
  },
  in_app_enabled: {
    type: DataTypes.BOOLEAN,
    defaultValue: true
  },
  email_enabled: {
    type: DataTypes.BOOLEAN,
    defaultValue: false
  },
  sound_enabled: {
    type: DataTypes.BOOLEAN,
    defaultValue: true
  },
  vibration_enabled: {
    type: DataTypes.BOOLEAN,
    defaultValue: true
  },
  badge_enabled: {
    type: DataTypes.BOOLEAN,
    defaultValue: true
  },
  quiet_hours_enabled: {
    type: DataTypes.BOOLEAN,
    defaultValue: false
  },
  quiet_hours_start: {
    type: DataTypes.TIME,
    defaultValue: '22:00'
  },
  quiet_hours_end: {
    type: DataTypes.TIME,
    defaultValue: '08:00'
  },
  preferences: {
    type: DataTypes.JSONB,
    defaultValue: {
      ride: { enabled: true, push: true, sound: 'default', vibration: true },
      payment: { enabled: true, push: true, sound: 'default' },
      wallet: { enabled: true, push: true, balance_low_threshold: 5000 },
      chat_private: { enabled: true, push: true, preview: true },
      chat_group: { enabled: true, push: true, mentions_only: false, preview: true },
      social_post: { enabled: true, push: false, from_followed_only: true },
      social_comment: { enabled: true, push: true, on_my_posts_only: true },
      social_like: { enabled: true, push: false, group_delay: 10 },
      social_mention: { enabled: true, push: true, priority: 'high' },
      story: { enabled: true, push: false, from_followed_only: true },
      story_comment: { enabled: true, push: true, on_my_stories_only: true },
      rental: { enabled: true, push: true, reminder_hours_before: 2 },
      admin: { enabled: true, push: true, priority: 'high' },
      system: { enabled: true, push: true }
    }
  }
}, {
  tableName: 'notification_preferences',
  timestamps: true,
  createdAt: 'created_at',
  updatedAt: 'updated_at'
});

// Associations
NotificationPreference.associate = (models) => {
  NotificationPreference.belongsTo(models.User, { foreignKey: 'user_id', as: 'user' });
};

module.exports = NotificationPreference;