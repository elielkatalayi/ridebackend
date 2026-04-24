const { DataTypes } = require('sequelize');
const { sequelize } = require('../../config/database');

const ChatReaction = sequelize.define('ChatReaction', {
    id: {
        type: DataTypes.UUID,
        defaultValue: DataTypes.UUIDV4,
        primaryKey: true
    },
    message_id: {
        type: DataTypes.UUID,
        allowNull: false,
        references: { model: 'chat_messages', key: 'id' }
    },
    user_id: {
        type: DataTypes.UUID,
        allowNull: false,
        references: { model: 'users', key: 'id' }
    },
    reaction_type: {
        type: DataTypes.STRING(20),
        allowNull: false,
        validate: {
            isIn: [['like', 'love', 'haha', 'wow', 'sad', 'angry', 'fire', 'celebrate']]
        }
    }
}, {
    tableName: 'chat_reactions',
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: false
});

ChatReaction.associate = (models) => {
    ChatReaction.belongsTo(models.ChatMessage, { foreignKey: 'message_id', as: 'message' });
    ChatReaction.belongsTo(models.User, { foreignKey: 'user_id', as: 'user' });
};

module.exports = ChatReaction;