const { DataTypes } = require('sequelize');
const { sequelize } = require('../../config/database');

const SavedPost = sequelize.define('SavedPost', {
    id: {
        type: DataTypes.UUID,
        defaultValue: DataTypes.UUIDV4,
        primaryKey: true
    },
    post_id: {
        type: DataTypes.UUID,
        allowNull: false,
        references: {
            model: 'posts',
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
    collection_name: {
        type: DataTypes.STRING(100),
        defaultValue: 'default'
    }
}, {
    tableName: 'saved_posts',
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: false
});

// Associations
SavedPost.associate = (models) => {
    SavedPost.belongsTo(models.Post, { foreignKey: 'post_id', as: 'post' });
    SavedPost.belongsTo(models.User, { foreignKey: 'user_id', as: 'user' });
};

module.exports = SavedPost;