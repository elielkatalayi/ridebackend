const { DataTypes } = require('sequelize');
const { sequelize } = require('../../config/database');

const Page = sequelize.define('Page', {
    id: {
        type: DataTypes.UUID,
        defaultValue: DataTypes.UUIDV4,
        primaryKey: true
    },
    name: {
        type: DataTypes.STRING(100),
        allowNull: false
    },
    slug: {
        type: DataTypes.STRING(120),
        allowNull: false,
        unique: true
    },
    description: {
        type: DataTypes.TEXT,
        allowNull: true
    },
    category: {
        type: DataTypes.STRING(50),
        allowNull: true
    },
    phone: {
        type: DataTypes.STRING(20),
        allowNull: true
    },
    email: {
        type: DataTypes.STRING(255),
        allowNull: true,
        validate: {
            isEmail: true
        }
    },
    website: {
        type: DataTypes.TEXT,
        allowNull: true
    },
    address: {
        type: DataTypes.TEXT,
        allowNull: true
    },
    city: {
        type: DataTypes.STRING(100),
        allowNull: true
    },
    country: {
        type: DataTypes.STRING(100),
        allowNull: true
    },
    profile_picture: {
        type: DataTypes.TEXT,
        allowNull: true
    },
    cover_photo: {
        type: DataTypes.TEXT,
        allowNull: true
    },
    followers_count: {
        type: DataTypes.INTEGER,
        defaultValue: 0
    },
    posts_count: {
        type: DataTypes.INTEGER,
        defaultValue: 0
    },
    stories_count: {
        type: DataTypes.INTEGER,
        defaultValue: 0
    },
    total_likes: {
        type: DataTypes.INTEGER,
        defaultValue: 0
    },
    total_views: {
        type: DataTypes.INTEGER,
        defaultValue: 0
    },
    engagement_score: {
        type: DataTypes.DECIMAL(10, 2),
        defaultValue: 0
    },
    viral_score: {
        type: DataTypes.DECIMAL(10, 2),
        defaultValue: 0
    },
    is_verified: {
        type: DataTypes.BOOLEAN,
        defaultValue: false
    },
    is_active: {
        type: DataTypes.BOOLEAN,
        defaultValue: true
    },
    is_deleted: {
        type: DataTypes.BOOLEAN,
        defaultValue: false
    },
    deleted_at: {
        type: DataTypes.DATE,
        allowNull: true
    },
    created_by: {
        type: DataTypes.UUID,
        allowNull: true,
        references: {
            model: 'users',
            key: 'id'
        }
    },
    settings: {
        type: DataTypes.JSONB,
        defaultValue: {
            allow_posts: true,
            allow_comments: true,
            allow_reactions: true,
            allow_sharing: true,
            allow_reposts: true,
            allow_stories: true,
            auto_approve_posts: true,
            moderation_enabled: false
        }
    }
}, {
    tableName: 'pages',
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: 'updated_at'
});

// Associations
Page.associate = (models) => {
    Page.belongsTo(models.User, { foreignKey: 'created_by', as: 'creator' });
    Page.hasMany(models.PageAdmin, { foreignKey: 'page_id', as: 'admins' });
    Page.hasMany(models.PageFollower, { foreignKey: 'page_id', as: 'followers' });
    Page.hasMany(models.Post, { foreignKey: 'container_id', as: 'posts', scope: { container_type: 'page' } });
};

module.exports = Page;