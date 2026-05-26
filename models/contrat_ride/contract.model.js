const { DataTypes } = require('sequelize');
const { sequelize } = require('../../config/database');

const Contract = sequelize.define('Contract', {
    id: {
        type: DataTypes.UUID,
        defaultValue: DataTypes.UUIDV4,
        primaryKey: true
    },
    request_id: {
        type: DataTypes.UUID,
        allowNull: false,
        references: { model: 'contract_requests', key: 'id' }
    },
    passenger_id: {
        type: DataTypes.UUID,
        allowNull: false,
        references: { model: 'users', key: 'id' }
    },
    driver_id: {
        type: DataTypes.UUID,
        allowNull: false,
        references: { model: 'users', key: 'id' }
    },
    pickup_address: {
        type: DataTypes.TEXT,
        allowNull: false
    },
    pickup_lat: {
        type: DataTypes.DECIMAL(10, 8),
        allowNull: true
    },
    pickup_lng: {
        type: DataTypes.DECIMAL(11, 8),
        allowNull: true
    },
    dropoff_address: {
        type: DataTypes.TEXT,
        allowNull: false
    },
    dropoff_lat: {
        type: DataTypes.DECIMAL(10, 8),
        allowNull: true
    },
    dropoff_lng: {
        type: DataTypes.DECIMAL(11, 8),
        allowNull: true
    },
    morning_pickup_time: {
        type: DataTypes.TIME,
        allowNull: false
    },
    evening_pickup_time: {
        type: DataTypes.TIME,
        allowNull: false
    },
    amount_per_day: {
        type: DataTypes.DECIMAL(10, 2),
        allowNull: false
    },
    commission_rate: {
        type: DataTypes.DECIMAL(5, 2),
        defaultValue: 10.00
    },
    commission_amount: {
        type: DataTypes.VIRTUAL,
        get() {
            return (this.amount_per_day * this.commission_rate / 100);
        }
    },
    start_date: {
        type: DataTypes.DATEONLY,
        allowNull: false
    },
    end_date: {
        type: DataTypes.DATEONLY,
        allowNull: true
    },
    contract_type: {
        type: DataTypes.STRING(10),
        defaultValue: 'cdd',
        validate: {
            isIn: [['cdd', 'cdi']]
        }
    },
    status: {
        type: DataTypes.STRING(20),
        defaultValue: 'active',
        validate: {
            isIn: [['active', 'paused', 'completed', 'cancelled']]
        }
    },
    accepted_at: {
        type: DataTypes.DATE,
        defaultValue: DataTypes.NOW
    },
    cancelled_at: {
        type: DataTypes.DATE,
        allowNull: true
    },
    completed_at: {
        type: DataTypes.DATE,
        allowNull: true
    }
}, {
    tableName: 'contracts',
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: 'updated_at'
});

Contract.associate = (models) => {
    Contract.belongsTo(models.ContractRequest, { as: 'request', foreignKey: 'request_id' });
    Contract.belongsTo(models.User, { as: 'passenger', foreignKey: 'passenger_id' });
    Contract.belongsTo(models.User, { as: 'driver', foreignKey: 'driver_id' });
    Contract.hasMany(models.ContractDailySlot, { as: 'daily_slots', foreignKey: 'contract_id' });
    Contract.hasMany(models.ContractPayment, { as: 'payments', foreignKey: 'contract_id' });
};

module.exports = Contract;