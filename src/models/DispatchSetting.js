module.exports = (sequelize, DataTypes) => {
  const DispatchSetting = sequelize.define('DispatchSetting', {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true
    },
    city_id: {
      type: DataTypes.UUID,
      unique: true,
      references: {
        model: 'cities',
        key: 'id'
      }
    },
    points_weight: {
      type: DataTypes.DECIMAL(3, 2),
      defaultValue: 0.6
    },
    distance_weight: {
      type: DataTypes.DECIMAL(3, 2),
      defaultValue: 0.4
    },
    max_search_radius_km: {
      type: DataTypes.INTEGER,
      defaultValue: 5
    },
    max_drivers_notified: {
      type: DataTypes.INTEGER,
      defaultValue: 10
    },
    updated_by: {
      type: DataTypes.UUID,
      references: {
        model: 'users',
        key: 'id'
      }
    }
  }, {
    tableName: 'dispatch_settings',
    timestamps: true,
    underscored: true
  });

  return DispatchSetting;
};