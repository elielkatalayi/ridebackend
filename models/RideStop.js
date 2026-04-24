module.exports = (sequelize, DataTypes) => {
  const RideStop = sequelize.define('RideStop', {
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
    stop_order: {
      type: DataTypes.INTEGER,
      allowNull: false
    },
    lat: {
      type: DataTypes.DECIMAL(10, 8),
      allowNull: false
    },
    lng: {
      type: DataTypes.DECIMAL(11, 8),
      allowNull: false
    },
    address: {
      type: DataTypes.TEXT
    },
    name: {
      type: DataTypes.STRING(255)
    },
    is_extra: {
      type: DataTypes.BOOLEAN,
      defaultValue: false
    },
    price_adjustment: {
      type: DataTypes.INTEGER,
      defaultValue: 0
    },
    arrived_at: {
      type: DataTypes.DATE
    }
  }, {
    tableName: 'ride_stops',
    timestamps: true,
    underscored: true
  });

  return RideStop;
};