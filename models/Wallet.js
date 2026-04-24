// models/Wallet.js

module.exports = (sequelize, DataTypes) => {
  const Wallet = sequelize.define('Wallet', {
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
      }
    },
    balance: {
      type: DataTypes.INTEGER,
      defaultValue: 0,
      allowNull: false
    },
    pin_hash: {
      type: DataTypes.STRING(255)
    },
    pin_attempts: {
      type: DataTypes.INTEGER,
      defaultValue: 0
    },
    pin_locked_until: {
      type: DataTypes.DATE
    },
    daily_transfer_limit: {
      type: DataTypes.INTEGER,
      defaultValue: 500000
    },
    daily_transfer_amount: {
      type: DataTypes.INTEGER,
      defaultValue: 0
    },
    last_transfer_reset: {
      type: DataTypes.DATE,
      defaultValue: DataTypes.NOW
    },
    is_active: {
      type: DataTypes.BOOLEAN,
      defaultValue: true
    }
    // ❌ SUPPRIME TOUTE RÉFÉRENCE À driver_id ICI
  }, {
    tableName: 'wallets',
    timestamps: true,
    underscored: true
  });

  return Wallet;
};