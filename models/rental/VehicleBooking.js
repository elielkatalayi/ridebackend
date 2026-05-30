const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  const VehicleBooking = sequelize.define('VehicleBooking', {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true
    },
    booking_number: {
      type: DataTypes.STRING(50),
      unique: true,
      allowNull: false
    },
    vehicle_id: {
      type: DataTypes.UUID,
      allowNull: false,
      references: {
        model: 'vehicles',
        key: 'id'
      }
    },
    renter_id: {
      type: DataTypes.UUID,
      allowNull: false,
      references: {
        model: 'users',
        key: 'id'
      }
    },
    owner_id: {
      type: DataTypes.UUID,
      allowNull: false,
      references: {
        model: 'users',
        key: 'id'
      }
    },
    start_date: {
      type: DataTypes.DATE,
      allowNull: false
    },
    end_date: {
      type: DataTypes.DATE,
      allowNull: false
    },
    booking_type: {
      type: DataTypes.ENUM('daily', 'hourly'),
      defaultValue: 'daily'
    },
    total_amount: {
      type: DataTypes.INTEGER,
      allowNull: false,
      comment: 'Montant total à payer'
    },
    deposit_amount: {
      type: DataTypes.INTEGER,
      allowNull: false,
      comment: 'Caution (50% du total)'
    },
    status: {
      type: DataTypes.ENUM(
        'pending',      // En attente validation propriétaire
        'accepted',     // Accepté par propriétaire
        'ongoing',      // Location en cours
        'completed',    // Terminée
        'cancelled_by_renter',   // Annulée par locataire
        'cancelled_by_owner'     // Annulée par propriétaire
      ),
      defaultValue: 'pending'
    },
    cancelled_at: {
      type: DataTypes.DATE
    },
    cancelled_by: {
      type: DataTypes.UUID
    },
    cancellation_reason: {
      type: DataTypes.TEXT
    },
    completed_at: {
      type: DataTypes.DATE
    },
    notes: {
      type: DataTypes.TEXT,
      comment: 'Instructions spéciales'
    }
  }, {
    tableName: 'vehicle_bookings',
    timestamps: true,
    underscored: true
  });

  return VehicleBooking;
};