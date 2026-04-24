const { DataTypes } = require('sequelize');
const { sequelize } = require('../../config/database');

const PageAdmin = sequelize.define('PageAdmin', {
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
    role: {
        type: DataTypes.STRING(20),
        defaultValue: 'admin',
        validate: {
            isIn: [['admin', 'editor', 'moderator']]
        }
    }
}, {
    tableName: 'page_admins',
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: 'updated_at'
});

// Associations
PageAdmin.associate = (models) => {
    PageAdmin.belongsTo(models.Page, { foreignKey: 'page_id', as: 'page' });
    PageAdmin.belongsTo(models.User, { foreignKey: 'user_id', as: 'user' });
};

module.exports = PageAdmin;