const { DataTypes } = require('sequelize');
const { sequelize } = require('../../config/database');

const PageFollower = sequelize.define('PageFollower', {
    id: {
        type: DataTypes.UUID,
        defaultValue: DataTypes.UUIDV4,
        primaryKey: true
    },
    page_id: {
        type: DataTypes.UUID,
        allowNull: false,
        references: {
            model: 'pages',
            key: 'id'
        }
    },
    user_id: {
        type: DataTypes.UUID,
        allowNull: false,
        references: {
            model: 'users',
            key: 'id'
        }
    },
    is_notified: {
        type: DataTypes.BOOLEAN,
        defaultValue: true
    }
}, {
    tableName: 'page_followers',
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: false
});

// Associations
PageFollower.associate = (models) => {
    PageFollower.belongsTo(models.Page, { foreignKey: 'page_id', as: 'page' });
    PageFollower.belongsTo(models.User, { foreignKey: 'user_id', as: 'user' });
};

module.exports = PageFollower;