const { DataTypes } = require('sequelize');
const { sequelize } = require('../../config/database');

const ContractDailySlot = sequelize.define('ContractDailySlot', {
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
    ride_date: {
        type: DataTypes.DATEONLY,
        allowNull: false
    },
    // Créneau MATIN
    morning_status: {
        type: DataTypes.STRING(20),
        defaultValue: 'pending',
        validate: {
            isIn: [['pending', 'driver_available', 'passenger_confirmed', 'completed', 'cancelled_driver', 'cancelled_passenger', 'missed']]
        }
    },
    morning_driver_available: {
        type: DataTypes.BOOLEAN,
        defaultValue: false
    },
    morning_driver_responded_at: {
        type: DataTypes.DATE,
        allowNull: true
    },
    morning_passenger_confirmed: {
        type: DataTypes.BOOLEAN,
        defaultValue: false
    },
    morning_ride_id: {
        type: DataTypes.UUID,
        allowNull: true,
        references: { model: 'rides', key: 'id' }
    },
    morning_completed_at: {
        type: DataTypes.DATE,
        allowNull: true
    },
    // Créneau SOIR
    evening_status: {
        type: DataTypes.STRING(20),
        defaultValue: 'pending',
        validate: {
            isIn: [['pending', 'driver_available', 'passenger_confirmed', 'completed', 'cancelled_driver', 'cancelled_passenger', 'missed']]
        }
    },
    evening_driver_available: {
        type: DataTypes.BOOLEAN,
        defaultValue: false
    },
    evening_driver_responded_at: {
        type: DataTypes.DATE,
        allowNull: true
    },
    evening_passenger_confirmed: {
        type: DataTypes.BOOLEAN,
        defaultValue: false
    },
    evening_ride_id: {
        type: DataTypes.UUID,
        allowNull: true,
        references: { model: 'rides', key: 'id' }
    },
    evening_completed_at: {
        type: DataTypes.DATE,
        allowNull: true
    },
    // Paiement
    is_paid: {
        type: DataTypes.BOOLEAN,
        defaultValue: false
    },
    amount_paid: {
        type: DataTypes.DECIMAL(10, 2),
        allowNull: true
    },
    paid_at: {
        type: DataTypes.DATE,
        allowNull: true
    }
}, {
    tableName: 'contract_daily_slots',
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: 'updated_at',
    indexes: [
        {
            unique: true,
            fields: ['contract_id', 'ride_date']
        }
    ]
});

ContractDailySlot.associate = (models) => {
    ContractDailySlot.belongsTo(models.Contract, { as: 'contract', foreignKey: 'contract_id' });
    ContractDailySlot.belongsTo(models.Ride, { as: 'morning_ride', foreignKey: 'morning_ride_id' });
    ContractDailySlot.belongsTo(models.Ride, { as: 'evening_ride', foreignKey: 'evening_ride_id' });
};

// Méthode pour vérifier si le jour est payable (les 2 créneaux complétés)
ContractDailySlot.prototype.isDayPayable = function() {
    return this.morning_status === 'completed' && this.evening_status === 'completed';
};

module.exports = ContractDailySlot;