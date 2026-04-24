module.exports = (sequelize, DataTypes) => {
  const SanctionRule = sequelize.define('SanctionRule', {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true
    },
    rule_name: {
      type: DataTypes.STRING(100),
      allowNull: false,
      unique: true
    },
    user_type: {
      type: DataTypes.ENUM('driver', 'passenger'),
      allowNull: false
    },
    action: {
      type: DataTypes.STRING(50),
      allowNull: false
    },
    points_change: {
      type: DataTypes.INTEGER,
      allowNull: false
    },
    applies_after_count: {
      type: DataTypes.INTEGER,
      defaultValue: 1
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
    tableName: 'sanction_rules',
    timestamps: true,
    underscored: true
  });

  return SanctionRule;
};