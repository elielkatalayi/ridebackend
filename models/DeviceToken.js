// backend/models/DeviceToken.js
const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const DeviceToken = sequelize.define('DeviceToken', {
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
    onDelete: 'CASCADE',
    validate: {
      notNull: {
        msg: 'L\'ID utilisateur est requis'
      }
    }
  },
  token: {
    type: DataTypes.STRING(500),
    allowNull: false,
    unique: true,
    validate: {
      notEmpty: {
        msg: 'Le token FCM ne peut pas être vide'
      },
      len: {
        args: [10, 500],
        msg: 'Le token doit contenir entre 10 et 500 caractères'
      }
    }
  },
  device_type: {
    type: DataTypes.ENUM('ios', 'android', 'web'),
    allowNull: false,
    validate: {
      isIn: {
        args: [['ios', 'android', 'web']],
        msg: 'Le device_type doit être: ios, android ou web'
      }
    }
  },
  device_name: {
    type: DataTypes.STRING(100),
    allowNull: true,
    validate: {
      len: {
        args: [0, 100],
        msg: 'Le nom du device ne peut pas dépasser 100 caractères'
      }
    }
  },
  app_version: {
    type: DataTypes.STRING(20),
    allowNull: true,
    validate: {
      len: {
        args: [0, 20],
        msg: 'La version de l\'application ne peut pas dépasser 20 caractères'
      }
    }
  },
  is_active: {
    type: DataTypes.BOOLEAN,
    defaultValue: true,
    allowNull: false
  },
  last_used_at: {
    type: DataTypes.DATE,
    defaultValue: DataTypes.NOW,
    allowNull: false
  }
}, {
  // Nom de la table dans la base de données
  tableName: 'device_tokens',
  
  // Ajoute automatiquement createdAt et updatedAt
  timestamps: true,
  
  // Conventions de nommage
  underscored: true,
  
  // Index pour optimiser les requêtes
  indexes: [
    {
      name: 'device_tokens_user_id_idx',
      fields: ['user_id']
    },
    {
      name: 'device_tokens_token_idx',
      unique: true,
      fields: ['token']
    },
    {
      name: 'device_tokens_is_active_idx',
      fields: ['is_active']
    },
    {
      name: 'device_tokens_user_active_idx',
      fields: ['user_id', 'is_active']
    },
    {
      name: 'device_tokens_device_type_idx',
      fields: ['device_type']
    },
    {
      name: 'device_tokens_last_used_at_idx',
      fields: ['last_used_at']
    }
  ],
  
  // Hooks
  hooks: {
    beforeCreate: (deviceToken, options) => {
      // Nettoyer le token (enlever les espaces)
      if (deviceToken.token) {
        deviceToken.token = deviceToken.token.trim();
      }
    },
    beforeUpdate: (deviceToken, options) => {
      if (deviceToken.token) {
        deviceToken.token = deviceToken.token.trim();
      }
    }
  }
});

// =====================================================
// MÉTHODES STATIQUES
// =====================================================

/**
 * Récupère tous les tokens actifs d'un utilisateur
 * @param {string} userId - ID de l'utilisateur
 * @returns {Promise<Array>} Liste des tokens actifs
 */
DeviceToken.getActiveTokensByUser = async function(userId) {
  return await this.findAll({
    where: {
      user_id: userId,
      is_active: true
    },
    attributes: ['id', 'token', 'device_type', 'device_name', 'app_version'],
    order: [['last_used_at', 'DESC']]
  });
};

/**
 * Désactive tous les tokens d'un utilisateur
 * @param {string} userId - ID de l'utilisateur
 * @returns {Promise<number>} Nombre de tokens désactivés
 */
DeviceToken.disableAllUserTokens = async function(userId) {
  const [updatedCount] = await this.update(
    { is_active: false },
    { 
      where: { 
        user_id: userId,
        is_active: true 
      } 
    }
  );
  return updatedCount;
};

/**
 * Vérifie si un token existe et est actif
 * @param {string} token - Token FCM
 * @returns {Promise<boolean>} True si le token est actif
 */
DeviceToken.isTokenActive = async function(token) {
  const deviceToken = await this.findOne({
    where: {
      token: token,
      is_active: true
    }
  });
  return !!deviceToken;
};

/**
 * Met à jour la date de dernière utilisation d'un token
 * @param {string} token - Token FCM
 * @returns {Promise<void>}
 */
DeviceToken.updateLastUsed = async function(token) {
  await this.update(
    { last_used_at: new Date() },
    { where: { token: token } }
  );
};

/**
 * Nettoyer les tokens inactifs de plus de 30 jours
 * @returns {Promise<number>} Nombre de tokens supprimés
 */
DeviceToken.cleanInactiveTokens = async function() {
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
  
  const deleted = await this.destroy({
    where: {
      is_active: false,
      updated_at: { [Op.lt]: thirtyDaysAgo }
    }
  });
  
  return deleted;
};

/**
 * Récupère les statistiques des tokens
 * @returns {Promise<Object>} Statistiques
 */
DeviceToken.getStats = async function() {
  const stats = {
    total: await this.count(),
    active: await this.count({ where: { is_active: true } }),
    inactive: await this.count({ where: { is_active: false } }),
    byDevice: {
      ios: await this.count({ where: { device_type: 'ios', is_active: true } }),
      android: await this.count({ where: { device_type: 'android', is_active: true } }),
      web: await this.count({ where: { device_type: 'web', is_active: true } })
    }
  };
  
  return stats;
};

module.exports = DeviceToken;