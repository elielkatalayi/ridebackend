const { DataTypes } = require('sequelize');
const { sequelize } = require('../../config/database');

const ContractRequest = sequelize.define('ContractRequest', {
    id: {
        type: DataTypes.UUID,
        defaultValue: DataTypes.UUIDV4,
        primaryKey: true
    },
    passenger_id: {
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
    amount_per_day: {
        type: DataTypes.DECIMAL(10, 2),
        allowNull: false
    },
    currency: {
        type: DataTypes.STRING(3),
        defaultValue: 'USD'
    },
    voice_note_url: {
        type: DataTypes.TEXT,
        allowNull: true
    },
    voice_note_duration: {
        type: DataTypes.INTEGER,
        allowNull: true
    },
    status: {
        type: DataTypes.STRING(20),
        defaultValue: 'pending',
        validate: {
            isIn: [['pending', 'accepted', 'rejected', 'active', 'completed', 'cancelled']]
        }
    }
}, {
    tableName: 'contract_requests',
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: 'updated_at'
});

ContractRequest.associate = (models) => {
    ContractRequest.belongsTo(models.User, { as: 'passenger', foreignKey: 'passenger_id' });
    ContractRequest.hasOne(models.Contract, { as: 'contract', foreignKey: 'request_id' });
};

module.exports = ContractRequest;