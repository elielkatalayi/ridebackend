// models/CommissionHistory.js

module.exports = (sequelize, DataTypes) => {
  const CommissionHistory = sequelize.define('CommissionHistory', {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true
    },
    ride_id: {
      type: DataTypes.UUID,
      allowNull: false,
      references: { model: 'rides', key: 'id' }
    },
    driver_id: {
      type: DataTypes.UUID,
      allowNull: false,
      references: { model: 'users', key: 'id' }
    },
    total_amount: {
      type: DataTypes.INTEGER,
      allowNull: false
    },
    commission_percentage: {
      type: DataTypes.INTEGER,
      allowNull: false
    },
    commission_amount: {
      type: DataTypes.INTEGER,
      allowNull: false
    },
    driver_net: {
      type: DataTypes.INTEGER,
      allowNull: false
    },
    status: {
      type: DataTypes.STRING,
      defaultValue: 'completed'
    }
  }, {
    tableName: 'commission_history',
    timestamps: true,
    underscored: true
  });

  // ✅ AJOUTER LES ASSOCIATIONS ICI
  CommissionHistory.associate = (models) => {
    CommissionHistory.belongsTo(models.Ride, { foreignKey: 'ride_id', as: 'ride' });
    CommissionHistory.belongsTo(models.User, { foreignKey: 'driver_id', as: 'driver' });
  };

  return CommissionHistory;
};