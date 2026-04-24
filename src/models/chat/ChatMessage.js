const { DataTypes } = require('sequelize');
const { sequelize } = require('../../config/database');

const ChatMessage = sequelize.define('ChatMessage', {
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
    sender_id: {
        type: DataTypes.UUID,
        allowNull: false,
        references: { model: 'users', key: 'id' }
    },
    message_type: {
        type: DataTypes.STRING(20),
        defaultValue: 'text',
        validate: {
            isIn: [['text', 'image', 'video', 'audio', 'document', 'voice', 'location', 'poll', 'sticker', 'gif', 'note']]
        }
    },
    content: {
        type: DataTypes.TEXT,
        allowNull: true
    },
    media_url: {
        type: DataTypes.TEXT,
        allowNull: true
    },
    media_type: {
        type: DataTypes.STRING(50),
        allowNull: true
    },
    media_size: {
        type: DataTypes.INTEGER,
        allowNull: true
    },
    media_duration: {
        type: DataTypes.INTEGER,
        allowNull: true
    },
    thumbnail_url: {
        type: DataTypes.TEXT,
        allowNull: true
    },
    file_name: {
        type: DataTypes.STRING(255),
        allowNull: true
    },
    reply_to_id: {
        type: DataTypes.UUID,
        allowNull: true,
        references: { model: 'chat_messages', key: 'id' }
    },
    reply_preview: {
        type: DataTypes.TEXT,
        allowNull: true
    },
    mentions: {
        type: DataTypes.JSONB,
        defaultValue: []
    },
    poll_data: {
        type: DataTypes.JSONB,
        allowNull: true
    },
    location_lat: {
        type: DataTypes.DECIMAL(10, 8),
        allowNull: true
    },
    location_lng: {
        type: DataTypes.DECIMAL(11, 8),
        allowNull: true
    },
    location_address: {
        type: DataTypes.TEXT,
        allowNull: true
    },
    is_edited: {
        type: DataTypes.BOOLEAN,
        defaultValue: false
    },
    edited_at: {
        type: DataTypes.DATE,
        allowNull: true
    },
    edit_history: {
        type: DataTypes.JSONB,
        defaultValue: []
    },
    is_forwarded: {
        type: DataTypes.BOOLEAN,
        defaultValue: false
    },
    forwarded_from_id: {
        type: DataTypes.UUID,
        allowNull: true,
        references: { model: 'users', key: 'id' }
    },
    original_message_id: {
        type: DataTypes.UUID,
        allowNull: true
    },
    original_chat_id: {
        type: DataTypes.UUID,
        allowNull: true,
        references: { model: 'chats', key: 'id' }
    },
    forward_note: {
        type: DataTypes.TEXT,
        allowNull: true
    },
    status: {
        type: DataTypes.STRING(20),
        defaultValue: 'sent',
        validate: {
            isIn: [['sending', 'sent', 'delivered', 'read', 'failed']]
        }
    },
    is_deleted: {
        type: DataTypes.BOOLEAN,
        defaultValue: false
    },
    deleted_by: {
        type: DataTypes.UUID,
        allowNull: true,
        references: { model: 'users', key: 'id' }
    },
    deleted_for_all: {
        type: DataTypes.BOOLEAN,
        defaultValue: false
    },
    deleted_at: {
        type: DataTypes.DATE,
        allowNull: true
    },
    is_ephemeral: {
        type: DataTypes.BOOLEAN,
        defaultValue: false
    },
    expires_at: {
        type: DataTypes.DATE,
        allowNull: true
    },
    was_read: {
        type: DataTypes.BOOLEAN,
        defaultValue: false
    }
}, {
    tableName: 'chat_messages',
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: 'updated_at'
});

ChatMessage.associate = (models) => {
    ChatMessage.belongsTo(models.Chat, { foreignKey: 'chat_id', as: 'chat' });
    ChatMessage.belongsTo(models.User, { foreignKey: 'sender_id', as: 'sender' });
    ChatMessage.belongsTo(models.ChatMessage, { foreignKey: 'reply_to_id', as: 'reply_to' });
    ChatMessage.belongsTo(models.User, { foreignKey: 'forwarded_from_id', as: 'forwarded_from' });
    ChatMessage.hasMany(models.ChatReaction, { foreignKey: 'message_id', as: 'reactions' });
};

module.exports = ChatMessage;