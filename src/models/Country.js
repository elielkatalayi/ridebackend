module.exports = (sequelize, DataTypes) => {
  const Country = sequelize.define('Country', {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true
    },
    code: {
      type: DataTypes.STRING(5),
      allowNull: false,
      unique: true,
      validate: {
        len: [2, 5]
      }
    },
    name: {
      type: DataTypes.STRING(100),
      allowNull: false
    },
    currency_code: {
      type: DataTypes.STRING(3),
      allowNull: false,
      validate: {
        len: [3, 3]
      }
    },
    currency_symbol: {
      type: DataTypes.STRING(5),
      allowNull: false
    },
    phone_code: {
      type: DataTypes.STRING(5),
      allowNull: false
    },
    is_active: {
      type: DataTypes.BOOLEAN,
      defaultValue: true
    }
  }, {
    tableName: 'countries',
    timestamps: true,
    underscored: true
  });

  return Country;
};