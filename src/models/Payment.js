module.exports = (sequelize, DataTypes) => {
  const Payment = sequelize.define('Payment', {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true
    },
    ride_id: {
      type: DataTypes.UUID,
      references: {
        model: 'rides',
        key: 'id'
      }
    },
    rental_id: {
      type: DataTypes.UUID,
      references: {
        model: 'rentals',
        key: 'id'
      }
    },
    user_id: {
      type: DataTypes.UUID,
      allowNull: false,
      references: {
        model: 'users',
        key: 'id'
      }
    },
    driver_id: {
      type: DataTypes.UUID,
      references: {
        model: 'drivers',
        key: 'id'
      }
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
    method: {
      type: DataTypes.ENUM('shawari', 'cash', 'wallet'),
      allowNull: false
    },
    status: {
      type: DataTypes.ENUM('pending', 'processing', 'completed', 'failed', 'refunded'),
      defaultValue: 'pending'
    },
    shawari_transaction_id: {
      type: DataTypes.STRING(100)
    },
    shawari_reference: {
      type: DataTypes.STRING(100)
    },
    shawari_response: {
      type: DataTypes.JSONB
    },
    metadata: {
      type: DataTypes.JSONB
    },
    completed_at: {
      type: DataTypes.DATE
    },
    refunded_at: {
      type: DataTypes.DATE
    }
  }, {
    tableName: 'payments',
    timestamps: true,
    underscored: true
  });

  return Payment;
};