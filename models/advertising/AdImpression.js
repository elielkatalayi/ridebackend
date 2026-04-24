const { DataTypes } = require('sequelize');
const { sequelize } = require('../../config/database');

const AdImpression = sequelize.define('AdImpression', {
    id: {
        type: DataTypes.UUID,
        defaultValue: DataTypes.UUIDV4,
        primaryKey: true
    },
    campaign_id: {
        type: DataTypes.UUID,
        allowNull: false,
        references: {
            model: 'ad_campaigns',
            key: 'id'
        },
        onDelete: 'CASCADE'
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
    position: {
        type: DataTypes.STRING(20),
        allowNull: true,
        validate: {
            isIn: [['feed', 'story', 'banner', 'notification']]
        }
    },
    clicked: {
        type: DataTypes.BOOLEAN,
        defaultValue: false
    },
    clicked_at: {
        type: DataTypes.DATE,
        allowNull: true
    },
    liked: {
        type: DataTypes.BOOLEAN,
        defaultValue: false
    }
}, {
    tableName: 'ad_impressions',
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: false,
    indexes: [
        { fields: ['campaign_id'] },
        { fields: ['user_id'] },
        { fields: ['campaign_id', 'user_id'], unique: true }
    ]
});

// Associations
AdImpression.associate = (models) => {
    AdImpression.belongsTo(models.AdCampaign, { foreignKey: 'campaign_id', as: 'campaign' });
    AdImpression.belongsTo(models.User, { foreignKey: 'user_id', as: 'user' });
};

module.exports = AdImpression;