const { DataTypes } = require('sequelize');
const { sequelize } = require('../../config/database');

const BlockedUser = sequelize.define('BlockedUser', {
    id: {
        type: DataTypes.UUID,
        defaultValue: DataTypes.UUIDV4,
        primaryKey: true
    },
    blocker_id: {
        type: DataTypes.UUID,
        allowNull: false,
        references: {
            model: 'users',
            key: 'id'
        }
    },
    blocked_id: {
        type: DataTypes.UUID,
        allowNull: false,
        references: {
            model: 'users',
            key: 'id'
        }
    },
    reason: {
        type: DataTypes.TEXT,
        allowNull: true
    }
}, {
    tableName: 'blocked_users',
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: false,
    indexes: [
        { fields: ['blocker_id', 'blocked_id'], unique: true }
    ]
});

// Associations
BlockedUser.associate = (models) => {
    BlockedUser.belongsTo(models.User, { foreignKey: 'blocker_id', as: 'blocker' });
    BlockedUser.belongsTo(models.User, { foreignKey: 'blocked_id', as: 'blocked' });
};

module.exports = BlockedUser;