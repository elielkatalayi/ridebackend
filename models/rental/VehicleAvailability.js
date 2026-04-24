// models/VehicleAvailability.js
const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  const VehicleAvailability = sequelize.define('VehicleAvailability', {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true
    },
    vehicle_id: {
      type: DataTypes.UUID,
      allowNull: false,
      references: { model: 'vehicles', key: 'id' }
    },
    start_date: { type: DataTypes.DATEONLY, allowNull: false },
    end_date: { type: DataTypes.DATEONLY, allowNull: false },
    available_from: { type: DataTypes.TIME, defaultValue: '08:00' },
    available_until: { type: DataTypes.TIME, defaultValue: '20:00' },
    is_blocked: { type: DataTypes.BOOLEAN, defaultValue: false },
    is_booked: { type: DataTypes.BOOLEAN, defaultValue: false },
    special_daily_rate: { type: DataTypes.INTEGER },
    special_hourly_rate: { type: DataTypes.INTEGER }
  }, {
    tableName: 'vehicle_availability',
    timestamps: true,
    underscored: true,
    indexes: [
      { fields: ['vehicle_id', 'start_date', 'end_date'], unique: true }
    ]
  });

  return VehicleAvailability;
};