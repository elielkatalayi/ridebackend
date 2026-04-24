module.exports = (sequelize, DataTypes) => {
  const OtpCode = sequelize.define('OtpCode', {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true
    },
    phone: {
      type: DataTypes.STRING(20),
      allowNull: false
    },
    email: {
      type: DataTypes.STRING(255)
    },
    code: {
      type: DataTypes.STRING(6),
      allowNull: false
    },
    channel: {
      type: DataTypes.ENUM('sms', 'email'),
      allowNull: false
    },
    purpose: {
      type: DataTypes.ENUM('verification', 'login', 'reset_password', 'payment'),
      defaultValue: 'verification'
    },
    attempts: {
      type: DataTypes.INTEGER,
      defaultValue: 0
    },
    is_used: {
      type: DataTypes.BOOLEAN,
      defaultValue: false
    },
    expires_at: {
      type: DataTypes.DATE,
      allowNull: false
    }
  }, {
    tableName: 'otp_codes',
    timestamps: true,
    underscored: true,
    indexes: [
      {
        fields: ['phone']
      },
      {
        fields: ['expires_at']
      }
    ]
  });

  return OtpCode;
}; 