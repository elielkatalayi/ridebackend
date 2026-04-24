const { DataTypes } = require('sequelize');
const { sequelize } = require('../../config/database');

const StoryHighlight = sequelize.define('StoryHighlight', {
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
    title: {
        type: DataTypes.STRING(100),
        allowNull: false
    },
    cover_image: {
        type: DataTypes.TEXT,
        allowNull: true
    },
    cover_type: {
        type: DataTypes.STRING(20),
        allowNull: true,
        validate: {
            isIn: [['image', 'video']]
        }
    },
    stories_order: {
        type: DataTypes.ARRAY(DataTypes.UUID),
        defaultValue: []
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
    tableName: 'story_highlights',
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: 'updated_at',
    indexes: [
        { fields: ['user_id'] },
        { fields: ['page_id'] }
    ]
});

// Associations
StoryHighlight.associate = (models) => {
    StoryHighlight.belongsTo(models.User, { foreignKey: 'user_id', as: 'user' });
    StoryHighlight.belongsTo(models.Page, { foreignKey: 'page_id', as: 'page' });
    StoryHighlight.hasMany(models.Story, { foreignKey: 'highlight_id', as: 'stories' });
};

module.exports = StoryHighlight;