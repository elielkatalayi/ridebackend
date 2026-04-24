// models/UserLocation.js
const { DataTypes } = require('sequelize');

module.exports = (sequelize, DataTypes) => {
  const UserLocation = sequelize.define('UserLocation', {
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
      },
      onDelete: 'CASCADE'
    },
    latitude: {
      type: DataTypes.DECIMAL(10, 8),
      allowNull: false,
      validate: {
        min: -90,
        max: 90
      }
    },
    longitude: {
      type: DataTypes.DECIMAL(11, 8),
      allowNull: false,
      validate: {
        min: -180,
        max: 180
      }
    },
    accuracy: {
      type: DataTypes.FLOAT,
      defaultValue: 0
    },
    speed: {
      type: DataTypes.FLOAT,
      defaultValue: 0
    },
    heading: {
      type: DataTypes.INTEGER,
      defaultValue: 0,
      validate: {
        min: 0,
        max: 360
      }
    },
    altitude: {
      type: DataTypes.FLOAT,
      allowNull: true
    },
    user_type: {
      type: DataTypes.ENUM('passenger', 'driver', 'both'),
      defaultValue: 'both'
    },
    movement_status: {
      type: DataTypes.ENUM('stationary', 'walking', 'driving', 'unknown'),
      defaultValue: 'unknown'
    },
    active_ride_id: {
      type: DataTypes.UUID,
      allowNull: true,
      references: {
        model: 'rides',
        key: 'id'
      }
    },
    metadata: {
      type: DataTypes.JSONB,
      defaultValue: {}
    },
    recorded_at: {
      type: DataTypes.DATE,
      defaultValue: DataTypes.NOW,
      allowNull: false
    },
    expires_at: {
      type: DataTypes.DATE,
      allowNull: true
    }
  }, {
    tableName: 'user_locations',
    timestamps: true,
    underscored: true,
    indexes: [
      {
        fields: ['user_id', 'recorded_at']
      },
      {
        fields: ['latitude', 'longitude']
      },
      {
        fields: ['expires_at']
      },
      {
        fields: ['user_type', 'movement_status']
      }
    ]
  });

  return UserLocation;
};