const { DataTypes } = require('sequelize');
const { sequelize } = require('../../config/database');

const StoryView = sequelize.define('StoryView', {
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
        allowNull: false,
        references: {
            model: 'users',
            key: 'id'
        },
        onDelete: 'CASCADE'
    },
    viewed_at: {
        type: DataTypes.DATE,
        defaultValue: DataTypes.NOW
    },
    reaction_type: {
        type: DataTypes.STRING(20),
        allowNull: true,
        validate: {
            isIn: [['like', 'heart', 'laugh', 'wow', 'sad', 'angry']]
        }
    }
}, {
    tableName: 'story_views',
    timestamps: false,
    indexes: [
        { fields: ['story_id'] },
        { fields: ['user_id', 'story_id'], unique: true }
    ]
});

// Associations
StoryView.associate = (models) => {
    StoryView.belongsTo(models.Story, { foreignKey: 'story_id', as: 'story' });
    StoryView.belongsTo(models.User, { foreignKey: 'user_id', as: 'user' });
};

module.exports = StoryView;