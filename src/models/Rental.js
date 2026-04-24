module.exports = (sequelize, DataTypes) => {
  const Rental = sequelize.define('Rental', {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true
    },
    user_id: {
      type: DataTypes.UUID,
      allowNull: false,
      references: {
        model: 'users',
        key: 'id'
      }
    },
    driver_id: {
      type: DataTypes.UUID,
      references: {
        model: 'drivers',
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
    city_id: {
      type: DataTypes.UUID,
      allowNull: false,
      references: {
        model: 'cities',
        key: 'id'
      }
    },
    rental_type: {
      type: DataTypes.ENUM('hourly', 'daily', 'weekly', 'monthly'),
      allowNull: false
    },
    start_date: {
      type: DataTypes.DATE,
      allowNull: false
    },
    end_date: {
      type: DataTypes.DATE,
      allowNull: false
    },
    vehicle_brand: {
      type: DataTypes.STRING(50)
    },
    vehicle_model: {
      type: DataTypes.STRING(50)
    },
    vehicle_plate: {
      type: DataTypes.STRING(20)
    },
    base_rate: {
      type: DataTypes.INTEGER,
      allowNull: false
    },
    total_amount: {
      type: DataTypes.INTEGER
    },
    deposit_amount: {
      type: DataTypes.INTEGER
    },
    deposit_status: {
      type: DataTypes.ENUM('pending', 'collected', 'refunded'),
      defaultValue: 'pending'
    },
    km_included: {
      type: DataTypes.INTEGER
    },
    km_driven: {
      type: DataTypes.INTEGER,
      defaultValue: 0
    },
    extra_km_charges: {
      type: DataTypes.INTEGER,
      defaultValue: 0
    },
    status: {
      type: DataTypes.ENUM('pending', 'confirmed', 'ongoing', 'completed', 'cancelled'),
      defaultValue: 'pending'
    },
    delivery_address: {
      type: DataTypes.TEXT
    },
    delivery_fee: {
      type: DataTypes.INTEGER
    },
    completed_at: {
      type: DataTypes.DATE
    }
  }, {
    tableName: 'rentals',
    timestamps: true,
    underscored: true
  });

  return Rental;
};