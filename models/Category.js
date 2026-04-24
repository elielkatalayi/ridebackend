module.exports = (sequelize, DataTypes) => {
  const Category = sequelize.define('Category', {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true
    },
    name: {
      type: DataTypes.STRING(50),
      allowNull: false
    },
    slug: {
      type: DataTypes.STRING(50),
      allowNull: false,
      unique: true
    },
    type: {
      type: DataTypes.ENUM('ride', 'rental', 'heavy'),
      allowNull: false,
      defaultValue: 'ride'
    },
    icon: {
      type: DataTypes.STRING(10)
    },
    description: {
      type: DataTypes.TEXT
    },
    base_fare: {
      type: DataTypes.INTEGER,
      defaultValue: 500
    },
    per_km_rate: {
      type: DataTypes.INTEGER,
      defaultValue: 1000
    },
    per_minute_rate: {
      type: DataTypes.INTEGER,
      defaultValue: 80
    },
    min_fare: {
      type: DataTypes.INTEGER,
      defaultValue: 2000
    },
    wait_free_minutes: {
      type: DataTypes.INTEGER,
      defaultValue: 5
    },
    wait_paid_per_minute: {
      type: DataTypes.INTEGER,
      defaultValue: 150
    },
    pause_per_minute: {
      type: DataTypes.INTEGER,
      defaultValue: 100
    },
    rental_half_day_rate: {
      type: DataTypes.INTEGER
    },
    rental_full_day_rate: {
      type: DataTypes.INTEGER
    },
    rental_week_rate: {
      type: DataTypes.INTEGER
    },
    rental_km_included: {
      type: DataTypes.INTEGER,
      defaultValue: 100
    },
    rental_extra_km_rate: {
      type: DataTypes.INTEGER,
      defaultValue: 500
    },
    heavy_hourly_rate: {
      type: DataTypes.INTEGER
    },
    heavy_daily_rate: {
      type: DataTypes.INTEGER
    },
    display_order: {
      type: DataTypes.INTEGER,
      defaultValue: 0
    },
    is_active: {
      type: DataTypes.BOOLEAN,
      defaultValue: true
    }
  }, {
    tableName: 'categories',
    timestamps: true,
    underscored: true
  });

  return Category;
};