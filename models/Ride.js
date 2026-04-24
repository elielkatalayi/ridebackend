module.exports = (sequelize, DataTypes) => {
  const Ride = sequelize.define('Ride', {
    id: { 
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true
    },
    passenger_id: {
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
    category_id: {
      type: DataTypes.UUID,
      allowNull: false,
      references: {
        model: 'categories',
        key: 'id'
      }
    },
    // ❌ city_id SUPPRIMÉ
    origin_lat: {
      type: DataTypes.DECIMAL(10, 8),
      allowNull: false
    },
    origin_lng: {
      type: DataTypes.DECIMAL(11, 8),
      allowNull: false
    },
    origin_address: {
      type: DataTypes.TEXT
    },
    origin_name: {
      type: DataTypes.STRING(255)
    },
    destination_lat: {
      type: DataTypes.DECIMAL(10, 8)
    },
    destination_lng: {
      type: DataTypes.DECIMAL(11, 8)
    },
    destination_address: {
      type: DataTypes.TEXT
    },
    destination_name: {
      type: DataTypes.STRING(255)
    },
    distance_meters: {
      type: DataTypes.INTEGER
    },
    duration_with_traffic_sec: {
      type: DataTypes.INTEGER
    },
    duration_without_traffic_sec: {
      type: DataTypes.INTEGER
    },
    price_suggested: {
      type: DataTypes.INTEGER
    },
    price_negotiated: {
      type: DataTypes.INTEGER
    },
    price_final: {
      type: DataTypes.INTEGER
    },
    price_breakdown: {
      type: DataTypes.JSONB
    },
    status: {
      type: DataTypes.ENUM('pending', 'negotiating', 'accepted', 'driver_arrived', 'waiting', 'ongoing', 'paused', 'completed', 'cancelled'),
      defaultValue: 'pending'
    },
    requested_at: {
      type: DataTypes.DATE,
      defaultValue: DataTypes.NOW
    },
    accepted_at: {
      type: DataTypes.DATE
    },
    negotiated_at: {
      type: DataTypes.DATE
    },
    driver_arrived_at: {
      type: DataTypes.DATE
    },
    started_at: {
      type: DataTypes.DATE
    },
    paused_at: {
      type: DataTypes.DATE
    },
    resumed_at: {
      type: DataTypes.DATE
    },
    completed_at: {
      type: DataTypes.DATE
    },
    cancelled_at: {
      type: DataTypes.DATE
    },
    cancelled_by: {
      type: DataTypes.ENUM('passenger', 'driver', 'system', 'admin')
    },
    cancel_reason: {
      type: DataTypes.TEXT
    },
    cancellation_fee_applied: {
      type: DataTypes.BOOLEAN,
      defaultValue: false
    },
    cancellation_fee_amount: {
      type: DataTypes.INTEGER
    },
    sos_triggered: {
      type: DataTypes.BOOLEAN,
      defaultValue: false
    },
    sos_resolved_at: {
      type: DataTypes.DATE
    }
  }, {
    tableName: 'rides',
    timestamps: true,
    underscored: true,
    indexes: [
      {
        fields: ['passenger_id']
      },
      {
        fields: ['driver_id']
      },
      {
        fields: ['status']
      },
      {
        fields: ['created_at']
      }
    ]
  });

  return Ride;
};