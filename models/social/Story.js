const { DataTypes } = require('sequelize');
const { sequelize } = require('../../config/database');

const Story = sequelize.define('Story', {
    id: {
        type: DataTypes.UUID,
        defaultValue: DataTypes.UUIDV4,
        primaryKey: true
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
    type: {
        type: DataTypes.STRING(20),
        allowNull: false,
        validate: {
            isIn: [['photo', 'video', 'audio', 'text']]
        }
    },
    content: {
        type: DataTypes.TEXT,
        allowNull: true
    },
    media_url: {
        type: DataTypes.TEXT,
        allowNull: true
    },
    media_type: {
        type: DataTypes.STRING(20),
        allowNull: true
    },
    thumbnail_url: {
        type: DataTypes.TEXT,
        allowNull: true
    },
    duration: {
        type: DataTypes.INTEGER,
        defaultValue: 24,
        validate: {
            isIn: [[6, 12, 24, 48, 168]]
        }
    },
    expires_at: {
        type: DataTypes.DATE,
        allowNull: false
    },
    is_highlight: {
        type: DataTypes.BOOLEAN,
        defaultValue: false
    },
    highlight_id: {
        type: DataTypes.UUID,
        allowNull: true,
        references: {
            model: 'story_highlights',
            key: 'id'
        },
        onDelete: 'SET NULL'
    },
    view_count: {
        type: DataTypes.INTEGER,
        defaultValue: 0
    },
    like_count: {
        type: DataTypes.INTEGER,
        defaultValue: 0
    },
    comment_count: {
        type: DataTypes.INTEGER,
        defaultValue: 0
    },
    share_count: {
        type: DataTypes.INTEGER,
        defaultValue: 0
    },
    mentions: {
        type: DataTypes.JSONB,
        defaultValue: []
    },
    settings: {
        type: DataTypes.JSONB,
        defaultValue: {
            allow_comments: true,
            allow_reactions: true,
            allow_sharing: true,
            allow_screenshots: false,
            show_viewers: true
        }
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
    tableName: 'stories',
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: 'updated_at',
    indexes: [
        { fields: ['expires_at'] },
        { fields: ['user_id', 'created_at'] },
        { fields: ['page_id', 'created_at'] },
        { fields: ['highlight_id'] },
        { fields: ['is_highlight'] }
    ]
});

// Associations - Version corrigée
Story.associate = (models) => {
    Story.belongsTo(models.User, { foreignKey: 'user_id', as: 'user' });
    Story.belongsTo(models.Page, { foreignKey: 'page_id', as: 'page' });
    Story.belongsTo(models.StoryHighlight, { foreignKey: 'highlight_id', as: 'highlight' });
    Story.hasMany(models.StoryView, { foreignKey: 'story_id', as: 'views' });
    Story.hasMany(models.StoryComment, { foreignKey: 'story_id', as: 'comments' });
};

module.exports = Story;