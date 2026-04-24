const { DataTypes } = require('sequelize');
const { sequelize } = require('../../config/database');

const AdTargeting = sequelize.define('AdTargeting', {
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
    target_type: {
        type: DataTypes.STRING(30),
        allowNull: false,
        validate: {
            isIn: [['hashtag', 'page', 'user', 'interest']]
        }
    },
    target_id: {
        type: DataTypes.UUID,
        allowNull: true
    },
    target_value: {
        type: DataTypes.TEXT,
        allowNull: true
    }
}, {
    tableName: 'ad_targeting',
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: false,
    indexes: [
        { fields: ['campaign_id'] },
        { fields: ['target_type', 'target_value'] }
    ]
});

// Associations
AdTargeting.associate = (models) => {
    AdTargeting.belongsTo(models.AdCampaign, { foreignKey: 'campaign_id', as: 'campaign' });
};

module.exports = AdTargeting;