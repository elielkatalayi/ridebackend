// models/UserPhoneHistory.js
module.exports = (sequelize, DataTypes) => {
  const UserPhoneHistory = sequelize.define('UserPhoneHistory', {
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
      }
    },
    old_phone: {
      type: DataTypes.STRING(20),
      allowNull: false
    },
    new_phone: {
      type: DataTypes.STRING(20),
      allowNull: false
    },
    old_phone_verified: {
      type: DataTypes.BOOLEAN,
      defaultValue: false
    },
    new_phone_verified: {
      type: DataTypes.BOOLEAN,
      defaultValue: false
    },
    status: {
      type: DataTypes.ENUM('pending', 'completed', 'cancelled'),
      defaultValue: 'pending'
    },
    old_phone_otp_id: {
      type: DataTypes.UUID,
      allowNull: true
    },
    new_phone_otp_id: {
      type: DataTypes.UUID,
      allowNull: true
    },
    completed_at: {
      type: DataTypes.DATE,
      allowNull: true
    },
    cancelled_at: {
      type: DataTypes.DATE,
      allowNull: true
    }
  }, {
    tableName: 'user_phone_history',
    timestamps: true,
    underscored: true
  });

  UserPhoneHistory.associate = (models) => {
    UserPhoneHistory.belongsTo(models.User, { foreignKey: 'user_id', as: 'user' });
  };

  return UserPhoneHistory;
};