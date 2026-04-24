const { DataTypes } = require('sequelize');
const { sequelize } = require('../../config/database');

const GroupMember = sequelize.define('GroupMember', {
    id: {
        type: DataTypes.UUID,
        defaultValue: DataTypes.UUIDV4,
        primaryKey: true
    },
    group_id: {
        type: DataTypes.UUID,
        allowNull: false,
        references: {
            model: 'groups',
            key: 'id'
        }
    },
    user_id: {
        type: DataTypes.UUID,
        allowNull: false,
        references: {
            model: 'users',
            key: 'id'
        }
    },
    role: {
        type: DataTypes.STRING(20),
        defaultValue: 'member',
        validate: {
            isIn: [['admin', 'moderator', 'member']]
        }
    },
    status: {
        type: DataTypes.STRING(20),
        defaultValue: 'active',
        validate: {
            isIn: [['active', 'pending', 'banned']]
        }
    },
    joined_at: {
        type: DataTypes.DATE,
        defaultValue: DataTypes.NOW
    }
}, {
    tableName: 'group_members',
    timestamps: true,
    createdAt: false,
    updatedAt: 'updated_at'
});

// Associations
GroupMember.associate = (models) => {
    GroupMember.belongsTo(models.Group, { foreignKey: 'group_id', as: 'group' });
    GroupMember.belongsTo(models.User, { foreignKey: 'user_id', as: 'user' });
};

module.exports = GroupMember;