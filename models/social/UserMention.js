const { DataTypes } = require('sequelize');
const { sequelize } = require('../../config/database');

const UserMention = sequelize.define('UserMention', {
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
    mentioner_id: {
        type: DataTypes.UUID,
        allowNull: false,
        references: {
            model: 'users',
            key: 'id'
        }
    },
    target_type: {
        type: DataTypes.STRING(20),
        allowNull: false,
        validate: {
            isIn: [['post', 'comment', 'reply', 'story']]
        }
    },
    target_id: {
        type: DataTypes.UUID,
        allowNull: false
    },
    is_read: {
        type: DataTypes.BOOLEAN,
        defaultValue: false
    }
}, {
    tableName: 'user_mentions',
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: false,
    indexes: [
        { fields: ['user_id', 'is_read'] },
        { fields: ['target_type', 'target_id'] }
    ]
});

// Associations
UserMention.associate = (models) => {
    UserMention.belongsTo(models.User, { foreignKey: 'user_id', as: 'user' });
    UserMention.belongsTo(models.User, { foreignKey: 'mentioner_id', as: 'mentioner' });
};

module.exports = UserMention;