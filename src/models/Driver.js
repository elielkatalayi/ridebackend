// src/models/Driver.js
module.exports = (sequelize, DataTypes) => {
  const Driver = sequelize.define('Driver', {
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
    city_id: {
      type: DataTypes.UUID,
      allowNull: true,
      references: {
        model: 'cities',
        key: 'id'
      }
    },
    unique_id: {
      type: DataTypes.STRING(20),
      allowNull: false,
      unique: true,
      defaultValue: () => {
        const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
        let id = 'MD-';
        for (let i = 0; i < 8; i++) {
          id += chars.charAt(Math.floor(Math.random() * chars.length));
        }
        return id;
      }
    },
    address: {
      type: DataTypes.TEXT
    },
    
    // Documents
    license_number: {
      type: DataTypes.STRING(50)
    },
    license_photo_url: {
      type: DataTypes.TEXT
    },
    vehicle_registration_number: {
      type: DataTypes.STRING(50)
    },
    vehicle_registration_url: {
      type: DataTypes.TEXT
    },
    insurance_number: {
      type: DataTypes.STRING(50)
    },
    insurance_url: {
      type: DataTypes.TEXT
    },
    id_photo_url: {
      type: DataTypes.TEXT
    },
    portrait_photo_url: {
      type: DataTypes.TEXT
    },
    
    // Véhicule
    vehicle_type: {
      type: DataTypes.STRING(50),
      allowNull: true
    },
    vehicle_brand: {
      type: DataTypes.STRING(50),
      allowNull: true
    },
    vehicle_model: {
      type: DataTypes.STRING(50),
      allowNull: true
    },
    vehicle_color: {
      type: DataTypes.STRING(30),
      allowNull: true
    },
    vehicle_year: {
      type: DataTypes.INTEGER,
      allowNull: true,
      validate: {
        min: 1900,
        max: new Date().getFullYear() + 1
      }
    },
    plate_number: {
      type: DataTypes.STRING(20),
      unique: true,
      allowNull: true
    },
    vehicle_plate: {
      type: DataTypes.STRING(20),
      unique: true,
      allowNull: true
    },
    vehicle_photo_front_url: {
      type: DataTypes.TEXT
    },
    vehicle_photo_back_url: {
      type: DataTypes.TEXT
    },
    vehicle_photo_interior_url: {
      type: DataTypes.TEXT
    },
    
    // Statut
    is_approved: {
      type: DataTypes.BOOLEAN,
      defaultValue: true  // Auto-approve pour les tests
    },
    is_online: {
      type: DataTypes.BOOLEAN,
      defaultValue: false
    },
    is_suspended: {
      type: DataTypes.BOOLEAN,
      defaultValue: false
    },
    suspension_reason: {
      type: DataTypes.TEXT
    },
    suspended_at: {
      type: DataTypes.DATE
    },
    suspended_until: {
      type: DataTypes.DATE
    },
    
    // Position GPS
    current_lat: {
      type: DataTypes.DECIMAL(10, 8)
    },
    current_lng: {
      type: DataTypes.DECIMAL(11, 8)
    },
    last_location_update: {
      type: DataTypes.DATE
    },
    
    // Statistiques
    rating: {
      type: DataTypes.DECIMAL(2, 1),
      defaultValue: 5.0
    },
    total_rides: {
      type: DataTypes.INTEGER,
      defaultValue: 0
    },
    total_earnings: {
      type: DataTypes.INTEGER,
      defaultValue: 0
    },
    total_cancellations: {
      type: DataTypes.INTEGER,
      defaultValue: 0
    },
    total_reports: {
      type: DataTypes.INTEGER,
      defaultValue: 0
    },
    activity_points: {
      type: DataTypes.INTEGER,
      defaultValue: 500,
      validate: {
        min: 0,
        max: 1000
      }
    }
  }, {
    tableName: 'drivers',
    timestamps: true,
    underscored: true,
    hooks: {
      beforeCreate: (driver) => {
        if (!driver.unique_id) {
          const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
          let id = 'MD-';
          for (let i = 0; i < 8; i++) {
            id += chars.charAt(Math.floor(Math.random() * chars.length));
          }
          driver.unique_id = id;
        }
      }
    }
  });

  return Driver;
};