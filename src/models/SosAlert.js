module.exports = (sequelize, DataTypes) => {
  const SosAlert = sequelize.define('SosAlert', {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true
    },
    ride_id: {
      type: DataTypes.UUID,
      allowNull: false,
      references: {
        model: 'rides',
        key: 'id'
      }
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
    triggered_at: {
      type: DataTypes.DATE,
      defaultValue: DataTypes.NOW
    },
    lat: {
      type: DataTypes.DECIMAL(10, 8)
    },
    lng: {
      type: DataTypes.DECIMAL(11, 8)
    },
    address: {
      type: DataTypes.TEXT
    },
    uplus_notified: {
      type: DataTypes.BOOLEAN,
      defaultValue: true
    },
    uplus_notified_at: {
      type: DataTypes.DATE
    },
    uplus_response_at: {
      type: DataTypes.DATE
    },
    contact_notified: {
      type: DataTypes.BOOLEAN,
      defaultValue: false
    },
    contact_phone: {
      type: DataTypes.STRING(20)
    },
    contact_notified_at: {
      type: DataTypes.DATE
    },
    chat_created: {
      type: DataTypes.BOOLEAN,
      defaultValue: false
    },
    chat_id: {
      type: DataTypes.UUID
    },
    status: {
      type: DataTypes.ENUM('pending', 'resolved', 'false_alarm'),
      defaultValue: 'pending'
    },
    resolved_at: {
      type: DataTypes.DATE
    },
    resolved_by: {
      type: DataTypes.UUID,
      references: {
        model: 'users',
        key: 'id'
      }
    },
    resolution_notes: {
      type: DataTypes.TEXT
    }
  }, {
    tableName: 'sos_alerts',
    timestamps: true,
    underscored: true
  });

  return SosAlert;
};