module.exports = (sequelize, DataTypes) => {
  const CityCategoryPricing = sequelize.define('CityCategoryPricing', {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true
    }, 
    city_id: {
      type: DataTypes.UUID,
      allowNull: false,
      references: {
        model: 'cities',
        key: 'id'
      }
    },
    category_id: {
      type: DataTypes.UUID,
      allowNull: false,
      references: {
        model: 'categories',
        key: 'id'
      }
    },
    base_fare: {
      type: DataTypes.INTEGER
    },
    per_km_rate: {
      type: DataTypes.INTEGER
    },
    per_minute_rate: {
      type: DataTypes.INTEGER
    },
    min_fare: {
      type: DataTypes.INTEGER
    },
    wait_free_minutes: {
      type: DataTypes.INTEGER
    },
    wait_paid_per_minute: {
      type: DataTypes.INTEGER
    },
    pause_per_minute: {
      type: DataTypes.INTEGER
    },
    is_active: {
      type: DataTypes.BOOLEAN,
      defaultValue: true
    }
  }, {
    tableName: 'city_category_pricing',
    timestamps: true,
    underscored: true,
    indexes: [
      {
        unique: true,
        fields: ['city_id', 'category_id']
      }
    ]
  });

  return CityCategoryPricing;
};