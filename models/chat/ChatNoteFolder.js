const { DataTypes } = require('sequelize');
const { sequelize } = require('../../config/database');

const ChatNoteFolder = sequelize.define('ChatNoteFolder', {
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
    name: {
        type: DataTypes.STRING(100),
        allowNull: false,
        validate: {
            len: [1, 100]
        }
    },
    description: {
        type: DataTypes.STRING(255),
        allowNull: true
    },
    color: {
        type: DataTypes.STRING(7),
        allowNull: true,
        defaultValue: '#6C63FF',
        validate: {
            is: /^#[0-9A-F]{6}$/i
        }
    },
    icon: {
        type: DataTypes.STRING(50),
        allowNull: true,
        defaultValue: 'folder'
    },
    note_count: {
        type: DataTypes.INTEGER,
        defaultValue: 0,
        validate: {
            min: 0
        }
    },
    parent_id: {
        type: DataTypes.UUID,
        allowNull: true,
        references: {
            model: 'chat_note_folders',
            key: 'id'
        },
        onDelete: 'CASCADE'
    },
    is_default: {
        type: DataTypes.BOOLEAN,
        defaultValue: false
    },
    is_deleted: {
        type: DataTypes.BOOLEAN,
        defaultValue: false
    },
    sort_order: {
        type: DataTypes.INTEGER,
        defaultValue: 0
    }
}, {
    tableName: 'chat_note_folders',
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: 'updated_at',
    paranoid: false,
    indexes: [
        {
            fields: ['user_id']
        },
        {
            fields: ['parent_id']
        },
        {
            fields: ['user_id', 'is_deleted']
        }
    ]
});

// ✅ Associations
ChatNoteFolder.associate = (models) => {
    // Association avec l'utilisateur
    ChatNoteFolder.belongsTo(models.User, { 
        foreignKey: 'user_id', 
        as: 'user' 
    });
    
    // Association avec le dossier parent (auto-référence)
    ChatNoteFolder.belongsTo(models.ChatNoteFolder, { 
        foreignKey: 'parent_id', 
        as: 'parent' 
    });
    
    // Association avec les sous-dossiers
    ChatNoteFolder.hasMany(models.ChatNoteFolder, { 
        foreignKey: 'parent_id', 
        as: 'subfolders' 
    });
    
    // ✅ Association avec les notes (IMPORTANTE)
    ChatNoteFolder.hasMany(models.ChatNote, { 
        foreignKey: 'folder_id', 
        as: 'notes',
        constraints: false
    });
};

// ✅ Méthode d'instance pour incrémenter le compteur
ChatNoteFolder.prototype.incrementNoteCount = async function(by = 1) {
    this.note_count = (this.note_count || 0) + by;
    await this.save();
    return this.note_count;
};

// ✅ Méthode d'instance pour décrémenter le compteur
ChatNoteFolder.prototype.decrementNoteCount = async function(by = 1) {
    this.note_count = Math.max(0, (this.note_count || 0) - by);
    await this.save();
    return this.note_count;
};

// ✅ Méthode statique pour obtenir les dossiers racine d'un utilisateur
ChatNoteFolder.getRootFolders = async function(userId) {
    return await this.findAll({
        where: {
            user_id: userId,
            parent_id: null,
            is_deleted: false
        },
        order: [['sort_order', 'ASC'], ['created_at', 'ASC']]
    });
};

// ✅ Méthode statique pour obtenir l'arborescence complète
ChatNoteFolder.getFolderTree = async function(userId) {
    const folders = await this.findAll({
        where: {
            user_id: userId,
            is_deleted: false
        },
        order: [['sort_order', 'ASC']]
    });
    
    // Construire l'arborescence
    const folderMap = {};
    const roots = [];
    
    folders.forEach(folder => {
        folderMap[folder.id] = { ...folder.toJSON(), children: [] };
    });
    
    folders.forEach(folder => {
        if (folder.parent_id && folderMap[folder.parent_id]) {
            folderMap[folder.parent_id].children.push(folderMap[folder.id]);
        } else {
            roots.push(folderMap[folder.id]);
        }
    });
    
    return roots;
};

module.exports = ChatNoteFolder;