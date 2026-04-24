const { DataTypes } = require('sequelize');
const { sequelize } = require('../../config/database');

const ChatTransfer = sequelize.define('ChatTransfer', {
    id: {
        type: DataTypes.UUID,
        defaultValue: DataTypes.UUIDV4,
        primaryKey: true
    },
    original_message_id: {
        type: DataTypes.UUID,
        allowNull: false
    },
    original_chat_id: {
        type: DataTypes.UUID,
        allowNull: false
    },
    original_sender_id: {
        type: DataTypes.UUID,
        allowNull: false
    },
    target_type: {
        type: DataTypes.STRING(20),
        allowNull: false,
        validate: {
            isIn: [['private', 'group', 'note']]
        }
    },
    target_id: {
        type: DataTypes.UUID,
        allowNull: false
    },
    new_message_id: {
        type: DataTypes.UUID,
        allowNull: true
    },
    new_note_id: {
        type: DataTypes.UUID,
        allowNull: true
    },
    transferred_by: {
        type: DataTypes.UUID,
        allowNull: false
    },
    transferred_at: {
        type: DataTypes.DATE,
        defaultValue: DataTypes.NOW
    },
    note: {
        type: DataTypes.TEXT,
        allowNull: true
    }
}, {
    tableName: 'chat_transfers',
    timestamps: false,
    defaultScope: {
        attributes: {
            exclude: ['chat_id', 'transferred_from', 'transferred_to']
        }
    }
});

ChatTransfer.associate = (models) => {
    ChatTransfer.belongsTo(models.ChatMessage, { foreignKey: 'original_message_id', as: 'original_message' });
    ChatTransfer.belongsTo(models.Chat, { foreignKey: 'original_chat_id', as: 'original_chat' });
    ChatTransfer.belongsTo(models.User, { foreignKey: 'original_sender_id', as: 'original_sender' });
    ChatTransfer.belongsTo(models.ChatMessage, { foreignKey: 'new_message_id', as: 'new_message' });
    ChatTransfer.belongsTo(models.ChatNote, { foreignKey: 'new_note_id', as: 'new_note' });
    ChatTransfer.belongsTo(models.User, { foreignKey: 'transferred_by', as: 'transferrer' });
};

module.exports = ChatTransfer;