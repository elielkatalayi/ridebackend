const { DataTypes } = require('sequelize');
const { sequelize } = require('../../config/database');

const ContractPayment = sequelize.define('ContractPayment', {
    id: {
        type: DataTypes.UUID,
        defaultValue: DataTypes.UUIDV4,
        primaryKey: true
    },
    contract_id: {
        type: DataTypes.UUID,
        allowNull: false,
        references: { model: 'contracts', key: 'id' }
    },
    driver_id: {
        type: DataTypes.UUID,
        allowNull: false,
        references: { model: 'users', key: 'id' }
    },
    passenger_id: {
        type: DataTypes.UUID,
        allowNull: false,
        references: { model: 'users', key: 'id' }
    },
    month: {
        type: DataTypes.DATEONLY,
        allowNull: false
    },
    total_days_completed: {
        type: DataTypes.INTEGER,
        allowNull: false,
        defaultValue: 0
    },
    total_amount: {
        type: DataTypes.DECIMAL(10, 2),
        allowNull: false
    },
    commission_amount: {
        type: DataTypes.DECIMAL(10, 2),
        allowNull: false
    },
    driver_payout: {
        type: DataTypes.DECIMAL(10, 2),
        allowNull: false
    },
    transaction_id: {
        type: DataTypes.UUID,
        allowNull: true,
        references: { model: 'transactions', key: 'id' }
    },
    status: {
        type: DataTypes.STRING(20),
        defaultValue: 'pending',
        validate: {
            isIn: [['pending', 'processed', 'failed']]
        }
    },
    processed_at: {
        type: DataTypes.DATE,
        allowNull: true
    }
}, {
    tableName: 'contract_payments',
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: false
});

ContractPayment.associate = (models) => {
    ContractPayment.belongsTo(models.Contract, { as: 'contract', foreignKey: 'contract_id' });
    ContractPayment.belongsTo(models.User, { as: 'driver', foreignKey: 'driver_id' });
    ContractPayment.belongsTo(models.User, { as: 'passenger', foreignKey: 'passenger_id' });
    ContractPayment.belongsTo(models.Transaction, { as: 'transaction', foreignKey: 'transaction_id' });
};

module.exports = ContractPayment;