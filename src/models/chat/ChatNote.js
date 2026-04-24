const { DataTypes } = require('sequelize');
const { sequelize } = require('../../config/database');

const ChatNote = sequelize.define('ChatNote', {
    id: {
        type: DataTypes.UUID,
        defaultValue: DataTypes.UUIDV4,
        primaryKey: true,
        allowNull: false
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
    folder_id: {
        type: DataTypes.UUID,
        allowNull: true,
        references: {
            model: 'chat_note_folders',
            key: 'id'
        },
        onDelete: 'SET NULL'
    },
    title: {
        type: DataTypes.STRING(255),
        allowNull: true,
        defaultValue: 'Sans titre'
    },
    content: {
        type: DataTypes.TEXT,
        allowNull: true
    },
    content_json: {
        type: DataTypes.JSONB,
        allowNull: true
    },
    media: {
        type: DataTypes.JSONB,
        defaultValue: []
    },
    source_type: {
        type: DataTypes.STRING(20),
        allowNull: true,
        validate: {
            isIn: [['private', 'group', 'note']]
        }
    },
    source_id: {
        type: DataTypes.UUID,
        allowNull: true
    },
    original_message_id: {
        type: DataTypes.UUID,
        allowNull: true
    },
    is_pinned: {
        type: DataTypes.BOOLEAN,
        defaultValue: false
    },
    is_archived: {
        type: DataTypes.BOOLEAN,
        defaultValue: false
    },
    color: {
        type: DataTypes.STRING(7),
        allowNull: true,
        defaultValue: '#FFFFFF',
        validate: {
            is: /^#[0-9A-F]{6}$/i
        }
    },
    view_count: {
        type: DataTypes.INTEGER,
        defaultValue: 0,
        validate: {
            min: 0
        }
    },
    deleted_at: {
        type: DataTypes.DATE,
        allowNull: true
    },
    tags: {
        type: DataTypes.ARRAY(DataTypes.STRING),
        defaultValue: []
    }
}, {
    tableName: 'chat_notes',
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: 'updated_at',
    paranoid: false,
    indexes: [
        {
            fields: ['user_id']
        },
        {
            fields: ['folder_id']
        },
        {
            fields: ['user_id', 'is_pinned']
        },
        {
            fields: ['user_id', 'is_archived']
        },
        {
            fields: ['user_id', 'deleted_at']
        }
    ]
});

// ✅ Associations
ChatNote.associate = (models) => {
    // Association avec l'utilisateur
    ChatNote.belongsTo(models.User, {
        foreignKey: 'user_id',
        as: 'user'
    });
    
    // ✅ Association avec le dossier (IMPORTANTE)
    ChatNote.belongsTo(models.ChatNoteFolder, {
        foreignKey: 'folder_id',
        as: 'folder'
    });
};

// ✅ Méthode d'instance pour incrémenter les vues
ChatNote.prototype.incrementViewCount = async function() {
    this.view_count = (this.view_count || 0) + 1;
    await this.save();
    return this.view_count;
};

// ✅ Méthode d'instance pour épingler/désépingler
ChatNote.prototype.togglePin = async function() {
    this.is_pinned = !this.is_pinned;
    await this.save();
    return this.is_pinned;
};

// ✅ Méthode d'instance pour archiver/désarchiver
ChatNote.prototype.toggleArchive = async function() {
    this.is_archived = !this.is_archived;
    await this.save();
    return this.is_archived;
};

// ✅ Méthode statique pour obtenir les notes épinglées
ChatNote.getPinnedNotes = async function(userId) {
    return await this.findAll({
        where: {
            user_id: userId,
            is_pinned: true,
            deleted_at: null
        },
        order: [['updated_at', 'DESC']]
    });
};

// ✅ Méthode statique pour obtenir les notes récentes
ChatNote.getRecentNotes = async function(userId, limit = 10) {
    return await this.findAll({
        where: {
            user_id: userId,
            deleted_at: null
        },
        order: [['updated_at', 'DESC']],
        limit: limit
    });
};

module.exports = ChatNote;