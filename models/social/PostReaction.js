const { DataTypes } = require('sequelize');
const { sequelize } = require('../../config/database');

const PostReaction = sequelize.define('PostReaction', {
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
    reaction_type: {
        type: DataTypes.STRING(20),
        allowNull: false,
        validate: {
            isIn: [['like', 'love', 'fire', 'celebrate', 'haha', 'wow', 'sad', 'angry']]
        }
    }
}, {
    tableName: 'post_reactions',
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: 'updated_at'
});

// Associations
PostReaction.associate = (models) => {
    PostReaction.belongsTo(models.Post, { foreignKey: 'post_id', as: 'post' });
    PostReaction.belongsTo(models.User, { foreignKey: 'user_id', as: 'user' });
};

module.exports = PostReaction;