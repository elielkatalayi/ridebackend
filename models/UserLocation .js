// models/userLocation.js
const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
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
    // Position actuelle
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
    // Précision de la position (en mètres)
    accuracy: {
      type: DataTypes.FLOAT,
      defaultValue: 0
    },
    // Vitesse (km/h)
    speed: {
      type: DataTypes.FLOAT,
      defaultValue: 0
    },
    // Direction (degrés)
    heading: {
      type: DataTypes.INTEGER,
      defaultValue: 0,
      validate: {
        min: 0,
        max: 360
      }
    },
    // Altitude (mètres)
    altitude: {
      type: DataTypes.FLOAT,
      allowNull: true
    },
    // Type d'utilisateur (pour filtrage rapide)
    user_type: {
      type: DataTypes.ENUM('passenger', 'driver', 'both'),
      defaultValue: 'both'
    },
    // Statut du mouvement
    movement_status: {
      type: DataTypes.ENUM('stationary', 'walking', 'driving', 'unknown'),
      defaultValue: 'unknown'
    },
    // Session de course active (si applicable)
    active_ride_id: {
      type: DataTypes.UUID,
      allowNull: true,
      references: {
        model: 'rides',
        key: 'id'
      }
    },
    // Métadonnées supplémentaires
    metadata: {
      type: DataTypes.JSONB,
      defaultValue: {},
      comment: 'Battery level, network type, etc.'
    },
    // Timestamps
    recorded_at: {
      type: DataTypes.DATE,
      defaultValue: DataTypes.NOW,
      allowNull: false
    },
    // Pour nettoyage automatique (TTL)
    expires_at: {
      type: DataTypes.DATE,
      allowNull: true
    }
  }, {
    tableName: 'user_locations',
    timestamps: true,
    underscored: true,
    indexes: [
      // Index pour recherches par utilisateur
      {
        fields: ['user_id', 'recorded_at']
      },
      // Index spatial pour recherches géographiques (PostGIS)
      {
        fields: ['latitude', 'longitude'],
        using: 'BTREE'
      },
      // Index pour nettoyage
      {
        fields: ['expires_at']
      },
      // Index composite pour filtrage
      {
        fields: ['user_type', 'movement_status']
      }
    ]
  });

  // Méthode pour créer un point géographique (PostGIS)
  UserLocation.prototype.getGeoPoint = function() {
    return {
      type: 'Point',
      coordinates: [parseFloat(this.longitude), parseFloat(this.latitude)]
    };
  };

  return UserLocation;
};