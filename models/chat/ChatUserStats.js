const { DataTypes } = require('sequelize');
const { sequelize } = require('../../config/database');

const ChatUserStats = sequelize.define('ChatUserStats', {
    user_id: {
        type: DataTypes.UUID,
        primaryKey: true,
        references: { model: 'users', key: 'id' }
    },
    total_messages: {
        type: DataTypes.INTEGER,
        defaultValue: 0
    },
    total_chats: {
        type: DataTypes.INTEGER,
        defaultValue: 0
    },
    total_reactions_given: {
        type: DataTypes.INTEGER,
        defaultValue: 0
    },
    total_reactions_received: {
        type: DataTypes.INTEGER,
        defaultValue: 0
    },
    total_notes: {
        type: DataTypes.INTEGER,
        defaultValue: 0
    },
    avg_response_time_seconds: {
        type: DataTypes.INTEGER,
        defaultValue: 0
    },
    last_active_at: {
        type: DataTypes.DATE,
        allowNull: true
    }
}, {
    tableName: 'chat_user_stats',
    timestamps: true,
    createdAt: false,
    updatedAt: 'updated_at'
});

ChatUserStats.associate = (models) => {
    ChatUserStats.belongsTo(models.User, { foreignKey: 'user_id', as: 'user' });
};

module.exports = ChatUserStats;