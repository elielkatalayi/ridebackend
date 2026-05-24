// models/Otp.js
const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const Otp = sequelize.define('Otp', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true,
  },
  destination: {
    type: DataTypes.STRING(255),
    allowNull: false,
    comment: 'Email ou numéro de téléphone',
  },
  channel: {
    type: DataTypes.ENUM('sms', 'whatsapp', 'email'),
    defaultValue: 'sms',
    allowNull: false,
  },
  code: {
    type: DataTypes.STRING(10),
    allowNull: false,
  },
  purpose: {
    type: DataTypes.ENUM(
      'register',
      'login',
      'verify_email',
      'reset_password',
      'phone_change_old',
      'phone_change_new',
      'verification'
    ),
    defaultValue: 'verification',
    allowNull: false,
  },
  is_used: {
    type: DataTypes.BOOLEAN,
    defaultValue: false,
  },
  is_valid: {
    type: DataTypes.BOOLEAN,
    defaultValue: true,
  },
  expires_at: {
    type: DataTypes.DATE,
    allowNull: false,
  },
  attempts: {
    type: DataTypes.INTEGER,
    defaultValue: 0,
  },
  created_at: {
    type: DataTypes.DATE,
    defaultValue: DataTypes.NOW,
  },
  updated_at: {
    type: DataTypes.DATE,
    defaultValue: DataTypes.NOW,
  },
}, {
  tableName: 'otps',
  timestamps: true,
  createdAt: 'created_at',
  updatedAt: 'updated_at',
  indexes: [
    {
      fields: ['destination', 'purpose', 'is_used'],
    },
    {
      fields: ['expires_at'],
    },
    {
      fields: ['code'],
    },
  ],
});

module.exports = Otp;