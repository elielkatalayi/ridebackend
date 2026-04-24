const { DataTypes } = require('sequelize');
const { sequelize } = require('../../config/database');

const Comment = sequelize.define('Comment', {
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
    parent_comment_id: {
        type: DataTypes.UUID,
        allowNull: true,
        references: {
            model: 'comments',
            key: 'id'
        }
    },
    content: {
        type: DataTypes.TEXT,
        allowNull: true
    },
    media: {
        type: DataTypes.JSONB,
        defaultValue: null
    },
    mentions: {
        type: DataTypes.JSONB,
        defaultValue: []
    },
    likes_count: {
        type: DataTypes.INTEGER,
        defaultValue: 0
    },
    loves_count: {
        type: DataTypes.INTEGER,
        defaultValue: 0
    },
    fires_count: {
        type: DataTypes.INTEGER,
        defaultValue: 0
    },
    replies_count: {
        type: DataTypes.INTEGER,
        defaultValue: 0
    },
    is_pinned: {
        type: DataTypes.BOOLEAN,
        defaultValue: false
    },
    is_deleted: {
        type: DataTypes.BOOLEAN,
        defaultValue: false
    }
}, {
    tableName: 'comments',
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: 'updated_at'
});

// Associations
Comment.associate = (models) => {
    Comment.belongsTo(models.Post, { foreignKey: 'post_id', as: 'post' });
    Comment.belongsTo(models.User, { foreignKey: 'user_id', as: 'user' });
    Comment.belongsTo(models.Comment, { foreignKey: 'parent_comment_id', as: 'parent' });
    Comment.hasMany(models.Comment, { foreignKey: 'parent_comment_id', as: 'replies' });
    Comment.hasMany(models.CommentReaction, { foreignKey: 'comment_id', as: 'reactions' });
};

module.exports = Comment;