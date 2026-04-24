// models/Vehicle.js
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
      references: { model: 'users', key: 'id' }
    },
    brand: { type: DataTypes.STRING(100), allowNull: false },
    model: { type: DataTypes.STRING(100), allowNull: false },
    year: { type: DataTypes.INTEGER, allowNull: false },
    color: { type: DataTypes.STRING(50), allowNull: false },
    plate_number: { type: DataTypes.STRING(20), unique: true, allowNull: false },
    vin_number: { type: DataTypes.STRING(50), unique: true },
    seat_count: { type: DataTypes.INTEGER, defaultValue: 4 },
    door_count: { type: DataTypes.INTEGER, defaultValue: 4 },
    transmission: { type: DataTypes.ENUM('manual', 'automatic') },
    fuel_type: { type: DataTypes.ENUM('essence', 'diesel', 'electric', 'hybrid') },
    air_conditioning: { type: DataTypes.BOOLEAN, defaultValue: true },
    photos: { type: DataTypes.JSONB, defaultValue: [] },
    cover_photo: { type: DataTypes.TEXT },
    base_daily_rate: { type: DataTypes.INTEGER, allowNull: false },
    base_hourly_rate: { type: DataTypes.INTEGER, allowNull: false },
    commission_percentage: { type: DataTypes.INTEGER, defaultValue: 20 },
    registration_photo: { type: DataTypes.TEXT },
    insurance_photo: { type: DataTypes.TEXT },
    technical_control_photo: { type: DataTypes.TEXT },
    is_approved: { type: DataTypes.BOOLEAN, defaultValue: true },
    is_active: { type: DataTypes.BOOLEAN, defaultValue: true },
    is_deleted: { type: DataTypes.BOOLEAN, defaultValue: false },
    description: { type: DataTypes.TEXT },
    features: { type: DataTypes.JSONB, defaultValue: [] }
  }, {
    tableName: 'vehicles',
    timestamps: true,
    underscored: true
  });

  return Vehicle;
};