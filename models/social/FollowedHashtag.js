const { DataTypes } = require('sequelize');
const { sequelize } = require('../../config/database');

const FollowedHashtag = sequelize.define('FollowedHashtag', {
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
    tag: {
        type: DataTypes.STRING(100),
        allowNull: false
    },
    is_notified: {
        type: DataTypes.BOOLEAN,
        defaultValue: true
    }
}, {
    tableName: 'followed_hashtags',
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: false,
    indexes: [
        { fields: ['user_id', 'tag'], unique: true },
        { fields: ['tag'] }
    ]
});

// Associations
FollowedHashtag.associate = (models) => {
    FollowedHashtag.belongsTo(models.User, { foreignKey: 'user_id', as: 'user' });
};

module.exports = FollowedHashtag;