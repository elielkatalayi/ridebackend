module.exports = (sequelize, DataTypes) => {
  const HeavyEquipmentRental = sequelize.define('HeavyEquipmentRental', {
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
    equipment_type: {
      type: DataTypes.STRING(50),
      allowNull: false
    },
    equipment_model: {
      type: DataTypes.STRING(100)
    },
    start_date: {
      type: DataTypes.DATE,
      allowNull: false
    },
    end_date: {
      type: DataTypes.DATE,
      allowNull: false
    },
    hourly_rate: {
      type: DataTypes.INTEGER
    },
    daily_rate: {
      type: DataTypes.INTEGER
    },
    total_amount: {
      type: DataTypes.INTEGER
    },
    deposit_amount: {
      type: DataTypes.INTEGER
    },
    site_address: {
      type: DataTypes.TEXT,
      allowNull: false
    },
    site_lat: {
      type: DataTypes.DECIMAL(10, 8)
    },
    site_lng: {
      type: DataTypes.DECIMAL(11, 8)
    },
    with_operator: {
      type: DataTypes.BOOLEAN,
      defaultValue: false
    },
    operator_fee: {
      type: DataTypes.INTEGER
    },
    status: {
      type: DataTypes.ENUM('pending', 'confirmed', 'ongoing', 'completed', 'cancelled'),
      defaultValue: 'pending'
    },
    completed_at: {
      type: DataTypes.DATE
    }
  }, {
    tableName: 'heavy_equipment_rentals',
    timestamps: true,
    underscored: true
  });

  return HeavyEquipmentRental;
};