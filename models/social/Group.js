const { DataTypes } = require('sequelize');
const { sequelize } = require('../../config/database');

const Group = sequelize.define('Group', {
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
    cover_image: {
        type: DataTypes.TEXT,
        allowNull: true
    },
    icon_image: {
        type: DataTypes.TEXT,
        allowNull: true
    },
    privacy_type: {
        type: DataTypes.STRING(20),
        defaultValue: 'public',
        validate: {
            isIn: [['public', 'private', 'secret']]
        }
    },
    join_type: {
        type: DataTypes.STRING(20),
        defaultValue: 'free',
        validate: {
            isIn: [['free', 'approval', 'invite_only']]
        }
    },
    members_count: {
        type: DataTypes.INTEGER,
        defaultValue: 0
    },
    posts_count: {
        type: DataTypes.INTEGER,
        defaultValue: 0
    },
    pending_members_count: {
        type: DataTypes.INTEGER,
        defaultValue: 0
    },
    total_likes: {
        type: DataTypes.INTEGER,
        defaultValue: 0
    },
    engagement_score: {
        type: DataTypes.DECIMAL(10, 2),
        defaultValue: 0
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
            allow_media_upload: true,
            max_media_per_post: 10,
            moderation_enabled: false
        }
    }
}, {
    tableName: 'groups',
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: 'updated_at'
});

// Associations
Group.associate = (models) => {
    Group.belongsTo(models.User, { foreignKey: 'created_by', as: 'creator' });
    Group.hasMany(models.GroupMember, { foreignKey: 'group_id', as: 'members' });
    Group.hasMany(models.Post, { foreignKey: 'container_id', as: 'posts', scope: { container_type: 'group' } });
};

module.exports = Group;