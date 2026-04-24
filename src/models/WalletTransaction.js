// models/WalletTransaction.js

module.exports = (sequelize, DataTypes) => {
  const WalletTransaction = sequelize.define('WalletTransaction', {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true
    },
    wallet_id: {
      type: DataTypes.UUID,
      allowNull: false,
      references: {
        model: 'wallets',
        key: 'id'
      }
    },
    type: {
      type: DataTypes.ENUM('deposit', 'transfer_sent', 'transfer_received', 'withdrawal'),
      allowNull: false
    },
    status: {
      type: DataTypes.ENUM('pending', 'completed', 'failed', 'cancelled'),
      defaultValue: 'completed'
    },
    amount: {
      type: DataTypes.INTEGER,
      allowNull: false
    },
    fee: {
      type: DataTypes.INTEGER,
      defaultValue: 0
    },
    net_amount: {
      type: DataTypes.INTEGER,
      allowNull: false
    },
    balance_after: {
      type: DataTypes.INTEGER,
      allowNull: false
    },
    reference_type: {
      type: DataTypes.ENUM('ride', 'transfer', 'deposit', 'withdrawal'),
      allowNull: true
    },
    reference_id: {
      type: DataTypes.UUID,
      allowNull: true
    },
    to_user_id: {
      type: DataTypes.UUID,
      allowNull: true,
      comment: 'Pour les transferts'
    },
    from_user_id: {
      type: DataTypes.UUID,
      allowNull: true,
      comment: 'Pour les transferts'
    },
    description: {
      type: DataTypes.STRING(255)
    },
    external_reference: {
      type: DataTypes.STRING(255)
    },
    completed_at: {
      type: DataTypes.DATE
    }
  }, {
    tableName: 'wallet_transactions',
    timestamps: true,
    underscored: true
  });

  return WalletTransaction;
};