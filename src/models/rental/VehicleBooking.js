// models/VehicleBooking.js
const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  const VehicleBooking = sequelize.define('VehicleBooking', {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true
    },
    vehicle_id: { type: DataTypes.UUID, allowNull: false },
    renter_id: { type: DataTypes.UUID, allowNull: false },
    start_date: { type: DataTypes.DATE, allowNull: false },
    end_date: { type: DataTypes.DATE, allowNull: false },
    booking_type: { type: DataTypes.ENUM('hourly', 'daily'), allowNull: false },
    base_amount: { type: DataTypes.INTEGER, allowNull: false },
    platform_commission: { type: DataTypes.INTEGER, allowNull: false },
    commission_amount: { type: DataTypes.INTEGER, allowNull: false },
    net_amount: { type: DataTypes.INTEGER, allowNull: false },
    deposit_amount: { type: DataTypes.INTEGER, allowNull: false },
    total_amount: { type: DataTypes.INTEGER, allowNull: false },
    status: {
      type: DataTypes.ENUM('pending', 'confirmed', 'ongoing', 'completed', 'cancelled_by_renter', 'cancelled_by_owner'),
      defaultValue: 'pending'
    },
    pickup_address: { type: DataTypes.TEXT },
    pickup_lat: { type: DataTypes.DECIMAL(10, 8) },
    pickup_lng: { type: DataTypes.DECIMAL(11, 8) },
    dropoff_address: { type: DataTypes.TEXT },
    dropoff_lat: { type: DataTypes.DECIMAL(10, 8) },
    dropoff_lng: { type: DataTypes.DECIMAL(11, 8) },
    driver_id: { type: DataTypes.UUID },
    driver_name: { type: DataTypes.STRING(200) },
    driver_phone: { type: DataTypes.STRING(20) },
    driver_photo: { type: DataTypes.TEXT },
    start_odometer: { type: DataTypes.INTEGER },
    end_odometer: { type: DataTypes.INTEGER },
    total_km: { type: DataTypes.INTEGER },
    extra_km_charges: { type: DataTypes.INTEGER, defaultValue: 0 },
    extra_km_rate: { type: DataTypes.INTEGER, defaultValue: 500 },
    start_photos: { type: DataTypes.JSONB, defaultValue: [] },
    end_photos: { type: DataTypes.JSONB, defaultValue: [] },
    damage_report: { type: DataTypes.JSONB, defaultValue: {} },
    payment_id: { type: DataTypes.UUID },
    deposit_refunded: { type: DataTypes.BOOLEAN, defaultValue: false },
    deposit_refunded_at: { type: DataTypes.DATE },
    confirmed_at: { type: DataTypes.DATE },
    started_at: { type: DataTypes.DATE },
    completed_at: { type: DataTypes.DATE },
    cancelled_at: { type: DataTypes.DATE },
    cancelled_by: { type: DataTypes.UUID },
    cancellation_reason: { type: DataTypes.TEXT }
  }, {
    tableName: 'vehicle_bookings',
    timestamps: true,
    underscored: true,
    indexes: [
      { fields: ['vehicle_id', 'status'] },
      { fields: ['renter_id'] },
      { fields: ['start_date', 'end_date'] }
    ]
  });

  return VehicleBooking;
};