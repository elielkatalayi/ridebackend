const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  const Vehicle = sequelize.define('Vehicle', {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true
    },
    owner_id: {
      type: DataTypes.UUID,
      allowNull: false,
      references: {
        model: 'users',
        key: 'id'
      }
    },
    brand: {
      type: DataTypes.STRING(100),
      allowNull: false
    },
    model: {
      type: DataTypes.STRING(100),
      allowNull: false
    },
    year: {
      type: DataTypes.INTEGER,
      allowNull: false
    },
    color: {
      type: DataTypes.STRING(50),
      allowNull: false
    },
    plate_number: {
      type: DataTypes.STRING(20),
      unique: true,
      allowNull: false
    },
    price_per_day: {
      type: DataTypes.INTEGER,
      allowNull: false,
      comment: 'Prix par jour en FCFA'
    },
    price_per_hour: {
      type: DataTypes.INTEGER,
      allowNull: false,
      comment: 'Prix par heure en FCFA'
    },
    photos: {
      type: DataTypes.JSONB,
      defaultValue: []
    },
    cover_photo: {
      type: DataTypes.TEXT
    },
    city: {
      type: DataTypes.STRING(100),
      allowNull: false
    },
    description: {
      type: DataTypes.TEXT
    },
    is_available: {
      type: DataTypes.BOOLEAN,
      defaultValue: true,
      comment: 'Disponible pour location ou non'
    },
    is_active: {
      type: DataTypes.BOOLEAN,
      defaultValue: true,
      comment: 'Compte propriétaire actif ou non'
    },
    total_bookings: {
      type: DataTypes.INTEGER,
      defaultValue: 0
    },
    average_rating: {
      type: DataTypes.FLOAT,
      defaultValue: 0
    }
  }, {
    tableName: 'vehicles',
    timestamps: true,
    underscored: true
  });

  return Vehicle;
};