const { DataTypes } = require('sequelize');
const { sequelize } = require('../../config/database');

const StoryComment = sequelize.define('StoryComment', {
    id: {
        type: DataTypes.UUID,
        defaultValue: DataTypes.UUIDV4,
        primaryKey: true
    },
    story_id: {
        type: DataTypes.UUID,
        allowNull: false,
        references: {
            model: 'stories',
            key: 'id'
        },
        onDelete: 'CASCADE'
    },
    user_id: {
        type: DataTypes.UUID,
        allowNull: true,
        references: {
            model: 'users',
            key: 'id'
        },
        onDelete: 'CASCADE'
    },
    page_id: {
        type: DataTypes.UUID,
        allowNull: true,
        references: {
            model: 'pages',
            key: 'id'
        },
        onDelete: 'CASCADE'
    },
    parent_comment_id: {
        type: DataTypes.UUID,
        allowNull: true,
        references: {
            model: 'story_comments',
            key: 'id'
        },
        onDelete: 'CASCADE'
    },
    content: {
        type: DataTypes.TEXT,
        allowNull: false
    },
    media: {
        type: DataTypes.JSONB,
        defaultValue: []
    },
    mentions: {
        type: DataTypes.JSONB,
        defaultValue: []
    },
    like_count: {
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
    },
    deleted_at: {
        type: DataTypes.DATE,
        allowNull: true
    }
}, {
    tableName: 'story_comments',
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: 'updated_at',
    indexes: [
        { fields: ['story_id'] },
        { fields: ['parent_comment_id'] },
        { fields: ['user_id'] },
        { fields: ['page_id'] }
    ]
});

// Associations
StoryComment.associate = (models) => {
    StoryComment.belongsTo(models.Story, { foreignKey: 'story_id', as: 'story' });
    StoryComment.belongsTo(models.User, { foreignKey: 'user_id', as: 'user' });
    StoryComment.belongsTo(models.Page, { foreignKey: 'page_id', as: 'page' });
    StoryComment.belongsTo(models.StoryComment, { foreignKey: 'parent_comment_id', as: 'parent' });
    StoryComment.hasMany(models.StoryComment, { foreignKey: 'parent_comment_id', as: 'replies' });
};

module.exports = StoryComment;