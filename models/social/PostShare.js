const { DataTypes } = require('sequelize');
const { sequelize } = require('../../config/database');

const PostShare = sequelize.define('PostShare', {
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
    platform: {
        type: DataTypes.STRING(50),
        allowNull: true,
        validate: {
            isIn: [['whatsapp', 'facebook', 'twitter', 'telegram', 'copy_link', 'other']]
        }
    },
    share_url: {
        type: DataTypes.TEXT,
        allowNull: true
    }
}, {
    tableName: 'post_shares',
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: false
});

// Associations
PostShare.associate = (models) => {
    PostShare.belongsTo(models.Post, { foreignKey: 'post_id', as: 'post' });
    PostShare.belongsTo(models.User, { foreignKey: 'user_id', as: 'user' });
};

module.exports = PostShare;