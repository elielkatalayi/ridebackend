module.exports = (sequelize, DataTypes) => {
  const RideNegotiation = sequelize.define('RideNegotiation', {
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
    proposed_by: {
      type: DataTypes.ENUM('passenger', 'driver', 'system'),
      allowNull: false
    },
    proposed_price: {
      type: DataTypes.INTEGER,
      allowNull: false
    },
    previous_price: {
      type: DataTypes.INTEGER
    },
    status: {
      type: DataTypes.ENUM('pending', 'accepted', 'rejected', 'countered'),
      defaultValue: 'pending'
    },
    rejected_reason: {
      type: DataTypes.TEXT
    }
  }, {
    tableName: 'ride_negotiations',
    timestamps: true,
    underscored: true
  });

  return RideNegotiation;
};