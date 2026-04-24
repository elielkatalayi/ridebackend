const { DataTypes } = require('sequelize');
const { sequelize } = require('../../config/database');

const Report = sequelize.define('Report', {
    id: {
        type: DataTypes.UUID,
        defaultValue: DataTypes.UUIDV4,
        primaryKey: true
    },
    target_type: {
        type: DataTypes.STRING(20),
        allowNull: false,
        validate: {
            isIn: [['post', 'comment', 'reply', 'page', 'group', 'user']]
        }
    },
    target_id: {
        type: DataTypes.UUID,
        allowNull: false
    },
    reporter_id: {
        type: DataTypes.UUID,
        allowNull: false,
        references: {
            model: 'users',
            key: 'id'
        }
    },
    reason: {
        type: DataTypes.STRING(100),
        allowNull: false
    },
    description: {
        type: DataTypes.TEXT,
        allowNull: true
    },
    status: {
        type: DataTypes.STRING(20),
        defaultValue: 'pending',
        validate: {
            isIn: [['pending', 'reviewed', 'resolved', 'rejected']]
        }
    },
    moderated_by: {
        type: DataTypes.UUID,
        allowNull: true,
        references: {
            model: 'users',
            key: 'id'
        }
    },
    moderation_note: {
        type: DataTypes.TEXT,
        allowNull: true
    },
    resolved_at: {
        type: DataTypes.DATE,
        allowNull: true
    }
}, {
    tableName: 'reports',
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: 'updated_at'
});

// Associations
Report.associate = (models) => {
    Report.belongsTo(models.User, { foreignKey: 'reporter_id', as: 'reporter' });
    Report.belongsTo(models.User, { foreignKey: 'moderated_by', as: 'moderator' });
};

module.exports = Report;