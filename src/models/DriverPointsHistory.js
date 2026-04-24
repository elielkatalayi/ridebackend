module.exports = (sequelize, DataTypes) => {
  const DriverPointsHistory = sequelize.define('DriverPointsHistory', {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true
    },
    driver_id: {
      type: DataTypes.UUID,
      allowNull: false,
      references: {
        model: 'drivers',
        key: 'id'
      }
    },
    points_change: {
      type: DataTypes.INTEGER,
      allowNull: false
    },
    reason: {
      type: DataTypes.STRING(100),
      allowNull: false
    },
    reference_type: {
      type: DataTypes.STRING(30)
    },
    reference_id: {
      type: DataTypes.UUID
    },
    previous_points: {
      type: DataTypes.INTEGER,
      allowNull: false
    },
    new_points: {
      type: DataTypes.INTEGER,
      allowNull: false
    }
  }, {
    tableName: 'driver_points_history',
    timestamps: true,
    underscored: true
  });

  return DriverPointsHistory;
};