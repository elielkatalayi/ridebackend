module.exports = (sequelize, DataTypes) => {
  const RidePause = sequelize.define('RidePause', {
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
    pause_start: {
      type: DataTypes.DATE,
      allowNull: false
    },
    pause_end: {
      type: DataTypes.DATE
    },
    duration_seconds: {
      type: DataTypes.INTEGER
    },
    rate_per_minute: {
      type: DataTypes.INTEGER
    },
    amount_charged: {
      type: DataTypes.INTEGER
    },
    status: {
      type: DataTypes.ENUM('active', 'ended'),
      defaultValue: 'active'
    }
  }, {
    tableName: 'ride_pauses',
    timestamps: true,
    underscored: true
  });

  return RidePause;
};