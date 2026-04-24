const { DataTypes } = require('sequelize');
const { sequelize } = require('../../config/database');

const Chat = sequelize.define('Chat', {
    id: {
        type: DataTypes.UUID,
        defaultValue: DataTypes.UUIDV4,
        primaryKey: true
    },
    chat_type: {
        type: DataTypes.STRING(20),
        allowNull: false,
        validate: {
            isIn: [['private', 'group']]
        }
    },
    user1_id: {
        type: DataTypes.UUID,
        allowNull: true,
        references: { model: 'users', key: 'id' }
    },
    user2_id: {
        type: DataTypes.UUID,
        allowNull: true,
        references: { model: 'users', key: 'id' }
    },
    group_id: {
        type: DataTypes.UUID,
        allowNull: true,
        references: { model: 'groups', key: 'id' }
    },
    name: {
        type: DataTypes.STRING(255),
        allowNull: true
    },
    avatar_url: {
        type: DataTypes.TEXT,
        allowNull: true
    },
    description: {
        type: DataTypes.TEXT,
        allowNull: true
    },
    created_by: {
        type: DataTypes.UUID,
        allowNull: true,
        references: { model: 'users', key: 'id' }
    },
    is_public: {
        type: DataTypes.BOOLEAN,
        defaultValue: true
    },
    join_type: {
        type: DataTypes.STRING(20),
        defaultValue: 'invite',
        validate: {
            isIn: [['free', 'approval', 'invite']]
        }
    },
    member_count: {
        type: DataTypes.INTEGER,
        defaultValue: 0
    },
    message_count: {
        type: DataTypes.INTEGER,
        defaultValue: 0
    },
    last_message: {
        type: DataTypes.TEXT,
        allowNull: true
    },
    last_message_at: {
        type: DataTypes.DATE,
        allowNull: true
    },
    last_message_sender_id: {
        type: DataTypes.UUID,
        allowNull: true,
        references: { model: 'users', key: 'id' }
    },
    settings: {
        type: DataTypes.JSONB,
        defaultValue: {
            allow_media: true,
            allow_voice_messages: true,
            allow_reactions: true,
            allow_replies: true,
            allow_forward: true,
            allow_mentions: true,
            auto_delete_days: null,
            slow_mode_seconds: 0,
            edit_timeout_minutes: 120
        }
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
    }
}, {
    tableName: 'chats',
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: 'updated_at'
});

Chat.associate = (models) => {
    Chat.belongsTo(models.User, { foreignKey: 'user1_id', as: 'user1' });
    Chat.belongsTo(models.User, { foreignKey: 'user2_id', as: 'user2' });
    Chat.belongsTo(models.Group, { foreignKey: 'group_id', as: 'group' });
    Chat.belongsTo(models.User, { foreignKey: 'created_by', as: 'creator' });
    Chat.hasMany(models.ChatParticipant, { foreignKey: 'chat_id', as: 'participants' });
    Chat.hasMany(models.ChatMessage, { foreignKey: 'chat_id', as: 'messages' });
    Chat.hasMany(models.ChatPinnedMessage, { foreignKey: 'chat_id', as: 'pinned_messages' });
};

module.exports = Chat;