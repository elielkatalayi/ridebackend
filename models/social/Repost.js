const { DataTypes } = require('sequelize');
const { sequelize } = require('../../config/database');

const Repost = sequelize.define('Repost', {
    id: {
        type: DataTypes.UUID,
        defaultValue: DataTypes.UUIDV4,
        primaryKey: true
    },
    original_post_id: {
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
    repost_type: {
        type: DataTypes.STRING(20),
        defaultValue: 'simple',
        validate: {
            isIn: [['simple', 'quote', 'story']]
        }
    },
    quote_content: {
        type: DataTypes.TEXT,
        allowNull: true
    },
    quote_media: {
        type: DataTypes.JSONB,
        defaultValue: null
    },
    likes_count: {
        type: DataTypes.INTEGER,
        defaultValue: 0
    },
    comments_count: {
        type: DataTypes.INTEGER,
        defaultValue: 0
    },
    reposts_count: {
        type: DataTypes.INTEGER,
        defaultValue: 0
    }
}, {
    tableName: 'reposts',
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: 'updated_at'
});

// Associations
Repost.associate = (models) => {
    Repost.belongsTo(models.Post, { foreignKey: 'original_post_id', as: 'original_post' });
    Repost.belongsTo(models.User, { foreignKey: 'user_id', as: 'user' });
};

module.exports = Repost;