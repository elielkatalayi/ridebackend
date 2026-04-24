const { DataTypes } = require('sequelize');
const { sequelize } = require('../../config/database');

const AdPayment = sequelize.define('AdPayment', {
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
    wallet_transaction_id: {
        type: DataTypes.UUID,
        allowNull: true,
        references: {
            model: 'wallet_transactions',
            key: 'id'
        },
        onDelete: 'SET NULL'
    },
    amount: {
        type: DataTypes.INTEGER,
        allowNull: false,
        validate: {
            min: 0
        }
    },
    payment_method: {
        type: DataTypes.STRING(30),
        allowNull: false,
        validate: {
            isIn: [['wallet', 'card', 'mobile_money']]
        }
    },
    status: {
        type: DataTypes.STRING(20),
        defaultValue: 'pending',
        validate: {
            isIn: [['pending', 'completed', 'failed', 'refunded']]
        }
    },
    completed_at: {
        type: DataTypes.DATE,
        allowNull: true
    }
}, {
    tableName: 'ad_payments',
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: false,
    indexes: [
        { fields: ['campaign_id'] },
        { fields: ['wallet_transaction_id'] },
        { fields: ['status'] }
    ]
});

// Associations
AdPayment.associate = (models) => {
    AdPayment.belongsTo(models.AdCampaign, { foreignKey: 'campaign_id', as: 'campaign' });
    AdPayment.belongsTo(models.WalletTransaction, { foreignKey: 'wallet_transaction_id', as: 'wallet_transaction' });
};

module.exports = AdPayment;