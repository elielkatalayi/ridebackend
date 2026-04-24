module.exports = (sequelize, DataTypes) => {
  const CancellationSetting = sequelize.define('CancellationSetting', {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true
    },
    user_type: {
      type: DataTypes.ENUM('passenger', 'driver'),
      allowNull: false
    },
    cancel_window_seconds: {
      type: DataTypes.INTEGER
    },
    cancel_window_free: {
      type: DataTypes.BOOLEAN,
      defaultValue: true
    },
    fee_percentage: {
      type: DataTypes.INTEGER
    },
    fee_max: {
      type: DataTypes.INTEGER
    },
    points_penalty: {
      type: DataTypes.INTEGER
    },
    is_active: {
      type: DataTypes.BOOLEAN,
      defaultValue: true
    },
    updated_by: {
      type: DataTypes.UUID,
      references: {
        model: 'users',
        key: 'id'
      }
    }
  }, {
    tableName: 'cancellation_settings',
    timestamps: true,
    underscored: true
  });

  return CancellationSetting;
};