const { DataTypes } = require('sequelize');
const { sequelize } = require('../../config/database');

const Post = sequelize.define('Post', {
    id: {
        type: DataTypes.UUID,
        defaultValue: DataTypes.UUIDV4,
        primaryKey: true
    },
    container_type: {
        type: DataTypes.STRING(10),
        allowNull: false,
        validate: {
            isIn: [['page', 'group']]
        }
    },
    container_id: {
        type: DataTypes.UUID,
        allowNull: false
    },
    author_type: {
        type: DataTypes.STRING(10),
        defaultValue: 'user',
        validate: {
            isIn: [['user', 'page']]
        }
    },
    author_id: {
        type: DataTypes.UUID,
        allowNull: false
    },
    content: {
        type: DataTypes.TEXT,
        allowNull: true
    },
    media: {
        type: DataTypes.JSONB,
        defaultValue: []
    },
    visibility: {
        type: DataTypes.STRING(20),
        defaultValue: 'public',
        validate: {
            isIn: [['public', 'members', 'admins_only']]
        }
    },
    hashtags: {
        type: DataTypes.ARRAY(DataTypes.STRING),
        defaultValue: []
    },
    mentions: {
        type: DataTypes.JSONB,
        defaultValue: []
    },
    is_album: {
        type: DataTypes.BOOLEAN,
        defaultValue: false
    },
    album_title: {
        type: DataTypes.STRING(255),
        allowNull: true
    },
    is_pinned: {
        type: DataTypes.BOOLEAN,
        defaultValue: false
    },
    is_featured: {
        type: DataTypes.BOOLEAN,
        defaultValue: false
    },
    views_count: {
        type: DataTypes.INTEGER,
        defaultValue: 0
    },
    unique_views_count: {
        type: DataTypes.INTEGER,
        defaultValue: 0
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
    celebrates_count: {
        type: DataTypes.INTEGER,
        defaultValue: 0
    },
    comments_count: {
        type: DataTypes.INTEGER,
        defaultValue: 0
    },
    shares_count: {
        type: DataTypes.INTEGER,
        defaultValue: 0
    },
    reposts_count: {
        type: DataTypes.INTEGER,
        defaultValue: 0
    },
    saves_count: {
        type: DataTypes.INTEGER,
        defaultValue: 0
    },
    viral_score: {
        type: DataTypes.DECIMAL(10, 2),
        defaultValue: 0
    },
    engagement_score: {
        type: DataTypes.DECIMAL(10, 2),
        defaultValue: 0
    },
    is_viral: {
        type: DataTypes.BOOLEAN,
        defaultValue: false
    },
    is_trending: {
        type: DataTypes.BOOLEAN,
        defaultValue: false
    },
    viral_at: {
        type: DataTypes.DATE,
        allowNull: true
    },
    trending_at: {
        type: DataTypes.DATE,
        allowNull: true
    },
    status: {
        type: DataTypes.STRING(20),
        defaultValue: 'active',
        validate: {
            isIn: [['active', 'deleted', 'reported', 'moderated']]
        }
    },
    is_deleted: {
        type: DataTypes.BOOLEAN,
        defaultValue: false
    },
    deleted_at: {
        type: DataTypes.DATE,
        allowNull: true
    },
    reported_count: {
        type: DataTypes.INTEGER,
        defaultValue: 0
    },
    moderated_by: {
        type: DataTypes.UUID,
        allowNull: true,
        references: {
            model: 'users',
            key: 'id'
        }
    },
    moderation_reason: {
        type: DataTypes.TEXT,
        allowNull: true
    }
}, {
    tableName: 'posts',
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: 'updated_at'
});

// Associations
Post.associate = (models) => {
    Post.belongsTo(models.User, { foreignKey: 'author_id', as: 'author' });
    Post.hasMany(models.Comment, { foreignKey: 'post_id', as: 'comments' });
    Post.hasMany(models.PostReaction, { foreignKey: 'post_id', as: 'reactions' });
    Post.hasMany(models.Repost, { foreignKey: 'original_post_id', as: 'reposts' });
    Post.hasMany(models.PostShare, { foreignKey: 'post_id', as: 'shares' });
    Post.hasMany(models.PostView, { foreignKey: 'post_id', as: 'views' });
    Post.hasMany(models.SavedPost, { foreignKey: 'post_id', as: 'saved_by' });
};

module.exports = Post;