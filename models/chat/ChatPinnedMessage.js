const { DataTypes } = require('sequelize');
const { sequelize } = require('../../config/database');

const ChatPinnedMessage = sequelize.define('ChatPinnedMessage', {
    id: {
        type: DataTypes.UUID,
        defaultValue: DataTypes.UUIDV4,
        primaryKey: true
    },
    chat_id: {
        type: DataTypes.UUID,
        allowNull: false,
        references: { model: 'chats', key: 'id' }
    },
    message_id: {
        type: DataTypes.UUID,
        allowNull: false,
        references: { model: 'chat_messages', key: 'id' }
    },
    pinned_by: {
        type: DataTypes.UUID,
        allowNull: false,
        references: { model: 'users', key: 'id' }
    },
    pinned_at: {
        type: DataTypes.DATE,
        defaultValue: DataTypes.NOW
    }
}, {
    tableName: 'chat_pinned_messages',
    timestamps: false
});

ChatPinnedMessage.associate = (models) => {
    ChatPinnedMessage.belongsTo(models.Chat, { foreignKey: 'chat_id', as: 'chat' });
    ChatPinnedMessage.belongsTo(models.ChatMessage, { foreignKey: 'message_id', as: 'message' });
    ChatPinnedMessage.belongsTo(models.User, { foreignKey: 'pinned_by', as: 'pinner' });
};

module.exports = ChatPinnedMessage;