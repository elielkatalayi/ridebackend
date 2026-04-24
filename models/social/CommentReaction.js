const { DataTypes } = require('sequelize');
const { sequelize } = require('../../config/database');

const CommentReaction = sequelize.define('CommentReaction', {
    id: {
        type: DataTypes.UUID,
        defaultValue: DataTypes.UUIDV4,
        primaryKey: true
    },
    comment_id: {
        type: DataTypes.UUID,
        allowNull: false,
        references: {
            model: 'comments',
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
    tableName: 'comment_reactions',
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: 'updated_at'
});

// Associations
CommentReaction.associate = (models) => {
    CommentReaction.belongsTo(models.Comment, { foreignKey: 'comment_id', as: 'comment' });
    CommentReaction.belongsTo(models.User, { foreignKey: 'user_id', as: 'user' });
};

module.exports = CommentReaction;