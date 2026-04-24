const { DataTypes } = require('sequelize');
const { sequelize } = require('../../config/database');

const ChatParticipant = sequelize.define('ChatParticipant', {
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
    user_id: {
        type: DataTypes.UUID,
        allowNull: false,
        references: { model: 'users', key: 'id' }
    },
    role: {
        type: DataTypes.STRING(20),
        defaultValue: 'member',
        validate: {
            isIn: [['admin', 'moderator', 'member']]
        }
    },
    nickname: {
        type: DataTypes.STRING(100),
        allowNull: true
    },
    is_muted: {
        type: DataTypes.BOOLEAN,
        defaultValue: false
    },
    muted_until: {
        type: DataTypes.DATE,
        allowNull: true
    },
    is_pinned: {
        type: DataTypes.BOOLEAN,
        defaultValue: false
    },
    last_read_at: {
        type: DataTypes.DATE,
        defaultValue: DataTypes.NOW
    },
    last_read_message_id: {
        type: DataTypes.UUID,
        allowNull: true,
        references: { model: 'chat_messages', key: 'id' }
    },
    last_delivered_at: {
        type: DataTypes.DATE,
        defaultValue: DataTypes.NOW
    },
    notifications_enabled: {
        type: DataTypes.BOOLEAN,
        defaultValue: true
    },
    left_at: {
        type: DataTypes.DATE,
        allowNull: true
    },
    joined_at: {
        type: DataTypes.DATE,
        defaultValue: DataTypes.NOW
    }
}, {
    tableName: 'chat_participants',
    timestamps: false
});

ChatParticipant.associate = (models) => {
    ChatParticipant.belongsTo(models.Chat, { foreignKey: 'chat_id', as: 'chat' });
    ChatParticipant.belongsTo(models.User, { foreignKey: 'user_id', as: 'user' });
    ChatParticipant.belongsTo(models.ChatMessage, { foreignKey: 'last_read_message_id', as: 'last_read_message' });
};

module.exports = ChatParticipant;