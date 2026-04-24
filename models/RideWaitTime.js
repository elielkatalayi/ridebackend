module.exports = (sequelize, DataTypes) => {
  const RideWaitTime = sequelize.define('RideWaitTime', {
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
    driver_arrived_at: {
      type: DataTypes.DATE,
      allowNull: false
    },
    passenger_boarding_at: {
      type: DataTypes.DATE
    },
    wait_started_at: {
      type: DataTypes.DATE
    },
    wait_ended_at: {
      type: DataTypes.DATE
    },
    free_minutes_allocated: {
      type: DataTypes.INTEGER
    },
    free_minutes_used: {
      type: DataTypes.INTEGER
    },
    paid_seconds: {
      type: DataTypes.INTEGER
    },
    rate_per_minute: {
      type: DataTypes.INTEGER
    },
    amount_charged: {
      type: DataTypes.INTEGER
    },
    status: {
      type: DataTypes.ENUM('waiting', 'boarding', 'completed'),
      defaultValue: 'waiting'
    }
  }, {
    tableName: 'ride_wait_times',
    timestamps: true,
    underscored: true
  });

  return RideWaitTime;
};