module.exports = (sequelize, DataTypes) => {
  const AdminLog = sequelize.define('AdminLog', {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true
    },
    admin_id: {
      type: DataTypes.UUID,
      allowNull: false,
      references: {
        model: 'users',
        key: 'id'
      }
    },
    action: {
      type: DataTypes.STRING(50),
      allowNull: false
    },
    target_type: {
      type: DataTypes.STRING(50)
    },
    target_id: {
      type: DataTypes.UUID
    },
    old_value: {
      type: DataTypes.JSONB
    },
    new_value: {
      type: DataTypes.JSONB
    },
    ip_address: {
      type: DataTypes.INET
    }
  }, {
    tableName: 'admin_logs',
    timestamps: true,
    underscored: true
  });

  return AdminLog;
};