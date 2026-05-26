const { sequelize } = require('../../config/database');
const { 
    ContractRequest, 
    Contract, 
    ContractDailySlot, 
    ContractPayment,
    User,
    Ride,
    Wallet,
    Transaction
} = require('../../models');
const { Op } = require('sequelize');
const contractNotificationService = require('./contractNotificationService');
const contractPaymentService = require('./contractPaymentService');

class ContractService {
    
    // =====================================================
    // 1. CRÉATION D'UNE DEMANDE DE CONTRAT
    // =====================================================
        
    async createRequest(userId, data, voiceNoteFile = null) {
        const transaction = await sequelize.transaction();
        
        try {
            // Validation des dates
            const startDate = new Date(data.start_date);
            const today = new Date();
            today.setHours(0, 0, 0, 0);
            
            if (startDate < today) {
                throw new Error('La date de début ne peut pas être dans le passé');
            }
            
            if (data.contract_type === 'cdd' && data.end_date) {
                const endDate = new Date(data.end_date);
                if (endDate <= startDate) {
                    throw new Error('La date de fin doit être postérieure à la date de début');
                }
            }
            
            // Créer la demande
            const request = await ContractRequest.create({
                passenger_id: userId,
                pickup_address: data.pickup_address,
                pickup_lat: data.pickup_lat,
                pickup_lng: data.pickup_lng,
                dropoff_address: data.dropoff_address,
                dropoff_lat: data.dropoff_lat,
                dropoff_lng: data.dropoff_lng,
                morning_pickup_time: data.morning_pickup_time,
                evening_pickup_time: data.evening_pickup_time,
                start_date: data.start_date,
                end_date: data.end_date || null,
                contract_type: data.contract_type,
                amount_per_day: data.amount_per_day,
                voice_note_url: voiceNoteFile ? voiceNoteFile.url : null,
                voice_note_duration: voiceNoteFile ? voiceNoteFile.duration : null,
                status: 'pending'
            }, { transaction });
            
            // ✅ COMMIT À LA FIN - Après toutes les opérations BDD
            await transaction.commit();
            
            // Notifier les chauffeurs à proximité (en dehors de la transaction)
            await contractNotificationService.notifyNearbyDrivers(request);
            
            return request;
            
        } catch (error) {
            // ✅ Vérifier si la transaction est encore active avant rollback
            if (transaction && transaction.finished !== 'commit' && transaction.finished !== 'rollback') {
                await transaction.rollback();
            }
            throw error;
        }
    }
    
    // =====================================================
    // 2. RÉCUPÉRER LES DEMANDES DISPONIBLES
    // =====================================================
    
    async getPendingRequests(filters = {}) {
        const { limit = 50, offset = 0, city_id } = filters;
        
        const where = { status: 'pending' };
        
        const requests = await ContractRequest.findAndCountAll({
            where,
            include: [
                {
                    model: User,
                    as: 'passenger',
                    attributes: ['id', 'first_name', 'last_name', 'avatar_url', 'rating']
                }
            ],
            order: [['created_at', 'DESC']],
            limit: parseInt(limit),
            offset: parseInt(offset)
        });
        
        return requests;
    }
    
    // =====================================================
    // 3. ACCEPTER UNE DEMANDE (CHAUFFEUR)
    // =====================================================
    
    async acceptRequest(requestId, driverId) {
        const transaction = await sequelize.transaction();
        
        try {
            // Vérifier que la demande existe et est en attente
            const request = await ContractRequest.findByPk(requestId, { transaction });
            if (!request) throw new Error('Demande non trouvée');
            if (request.status !== 'pending') throw new Error('Cette demande n\'est plus disponible');
            
            // Vérifier que le chauffeur est actif
            const driver = await User.findByPk(driverId, { transaction });
            if (!driver || driver.role !== 'driver') {
                throw new Error('Vous devez être chauffeur pour accepter un contrat');
            }
            
            // Créer le contrat
            const contract = await Contract.create({
                request_id: requestId,
                passenger_id: request.passenger_id,
                driver_id: driverId,
                pickup_address: request.pickup_address,
                pickup_lat: request.pickup_lat,
                pickup_lng: request.pickup_lng,
                dropoff_address: request.dropoff_address,
                dropoff_lat: request.dropoff_lat,
                dropoff_lng: request.dropoff_lng,
                morning_pickup_time: request.morning_pickup_time,
                evening_pickup_time: request.evening_pickup_time,
                amount_per_day: request.amount_per_day,
                start_date: request.start_date,
                end_date: request.end_date,
                contract_type: request.contract_type,
                status: 'active'
            }, { transaction });
            
            // Mettre à jour le statut de la demande
            await request.update({ status: 'accepted' }, { transaction });
            
            // Générer les créneaux journaliers
            await this._generateDailySlots(contract.id, request.start_date, request.end_date, transaction);
            
            await transaction.commit();
            
            // Notifier le passager
            await contractNotificationService.notifyPassengerContractAccepted(contract);
            
            return contract;
            
        } catch (error) {
            await transaction.rollback();
            throw error;
        }
    }
    
    // =====================================================
    // 4. GÉNÉRER LES CRÉNEAUX JOURNALIERS
    // =====================================================
    
    async _generateDailySlots(contractId, startDate, endDate, transaction) {
        const slots = [];
        const currentDate = new Date(startDate);
        const lastDate = endDate ? new Date(endDate) : new Date();
        lastDate.setFullYear(lastDate.getFullYear() + 1); // +1 an pour CDI
        
        while (currentDate <= lastDate) {
            slots.push({
                contract_id: contractId,
                ride_date: new Date(currentDate),
                morning_status: 'pending',
                evening_status: 'pending'
            });
            currentDate.setDate(currentDate.getDate() + 1);
        }
        
        await ContractDailySlot.bulkCreate(slots, { transaction });
    }
    
    // =====================================================
    // 5. RÉPONSE DU CHAUFFEUR POUR UN CRÉNEAU
    // =====================================================
        
    async driverResponse(contractId, driverId, slotDate, period, isAvailable) {
        const transaction = await sequelize.transaction();
        let contract, slot; // Déclarer en dehors pour les utiliser après
        
        try {
            contract = await Contract.findOne({
                where: { id: contractId, driver_id: driverId, status: 'active' },
                transaction
            });
            if (!contract) throw new Error('Contrat non trouvé ou non actif');
            
            slot = await ContractDailySlot.findOne({
                where: { contract_id: contractId, ride_date: slotDate },
                transaction
            });
            if (!slot) throw new Error('Créneau non trouvé');
            
            const field = period === 'morning' ? 'morning_' : 'evening_';
            
            if (isAvailable) {
                await slot.update({
                    [`${field}status`]: 'driver_available',
                    [`${field}driver_available`]: true,
                    [`${field}driver_responded_at`]: new Date()
                }, { transaction });
            } else {
                await slot.update({
                    [`${field}status`]: 'cancelled_driver',
                    [`${field}driver_available`]: false,
                    [`${field}driver_responded_at`]: new Date()
                }, { transaction });
            }
            
            await transaction.commit(); // ✅ Commit d'abord
            
            // ✅ Notifications APRÈS le commit
            if (isAvailable) {
                await contractNotificationService.notifyPassengerDriverAvailable(contract, slot, period);
            } else {
                await contractNotificationService.notifyPassengerDriverUnavailable(contract, slot, period);
            }
            
            return slot;
            
        } catch (error) {
            if (transaction && transaction.finished !== 'commit' && transaction.finished !== 'rollback') {
                await transaction.rollback();
            }
            throw error;
        }
    }
    
    // =====================================================
    // 6. CONFIRMATION DU PASSAGER
    // =====================================================
    
    async passengerConfirm(contractId, passengerId, slotDate, period, isConfirmed) {
        const transaction = await sequelize.transaction();
        
        try {
            const contract = await Contract.findOne({
                where: { id: contractId, passenger_id: passengerId, status: 'active' },
                transaction
            });
            if (!contract) throw new Error('Contrat non trouvé');
            
            const slot = await ContractDailySlot.findOne({
                where: { contract_id: contractId, ride_date: slotDate },
                transaction
            });
            if (!slot) throw new Error('Créneau non trouvé');
            
            const field = period === 'morning' ? 'morning_' : 'evening_';
            
            if (isConfirmed) {
                await slot.update({
                    [`${field}status`]: 'passenger_confirmed',
                    [`${field}passenger_confirmed`]: true
                }, { transaction });
            } else {
                await slot.update({
                    [`${field}status`]: 'cancelled_passenger',
                    [`${field}passenger_confirmed`]: false
                }, { transaction });
            }
            
            await transaction.commit();
            return slot;
            
        } catch (error) {
            await transaction.rollback();
            throw error;
        }
    }
    
    // =====================================================
    // 7. COMPLÉTER UNE COURSE
    // =====================================================
    
    async completeRide(contractId, driverId, slotDate, period, rideData) {
        const transaction = await sequelize.transaction();
        
        try {
            const contract = await Contract.findOne({
                where: { id: contractId, driver_id: driverId, status: 'active' },
                transaction
            });
            if (!contract) throw new Error('Contrat non trouvé');
            
            const slot = await ContractDailySlot.findOne({
                where: { contract_id: contractId, ride_date: slotDate },
                transaction
            });
            if (!slot) throw new Error('Créneau non trouvé');
            
            const field = period === 'morning' ? 'morning_' : 'evening_';
            
            // Créer la course
            const ride = await Ride.create({
                passenger_id: contract.passenger_id,
                driver_id: driverId,
                pickup_address: contract.pickup_address,
                dropoff_address: contract.dropoff_address,
                status: 'completed',
                price_final: contract.amount_per_day / 2, // Moitié par course
                ...rideData
            }, { transaction });
            
            await slot.update({
                [`${field}status`]: 'completed',
                [`${field}ride_id`]: ride.id,
                [`${field}completed_at`]: new Date()
            }, { transaction });
            
            // Vérifier si le jour est payable (2 courses complétées)
            await this._checkAndMarkDayPayable(slot, contract, transaction);
            
            await transaction.commit();
            return { slot, ride };
            
        } catch (error) {
            await transaction.rollback();
            throw error;
        }
    }
    
    // =====================================================
    // 8. VÉRIFIER ET MARQUER LE JOUR PAYABLE
    // =====================================================
    
    async _checkAndMarkDayPayable(slot, contract, transaction) {
        const isPayable = slot.morning_status === 'completed' && slot.evening_status === 'completed';
        
        if (isPayable && !slot.is_paid) {
            await slot.update({
                is_paid: true,
                amount_paid: contract.amount_per_day,
                paid_at: new Date()
            }, { transaction });
            
            // Mettre à jour le compteur mensuel
            const monthStart = new Date(slot.ride_date);
            monthStart.setDate(1);
            monthStart.setHours(0, 0, 0, 0);
            
            let payment = await ContractPayment.findOne({
                where: {
                    contract_id: contract.id,
                    month: monthStart
                },
                transaction
            });
            
            if (!payment) {
                payment = await ContractPayment.create({
                    contract_id: contract.id,
                    driver_id: contract.driver_id,
                    passenger_id: contract.passenger_id,
                    month: monthStart,
                    total_days_completed: 0,
                    total_amount: 0,
                    commission_amount: 0,
                    driver_payout: 0,
                    status: 'pending'
                }, { transaction });
            }
            
            await payment.update({
                total_days_completed: payment.total_days_completed + 1,
                total_amount: payment.total_amount + contract.amount_per_day,
                commission_amount: (payment.total_amount + contract.amount_per_day) * (contract.commission_rate / 100),
                driver_payout: (payment.total_amount + contract.amount_per_day) * (1 - contract.commission_rate / 100)
            }, { transaction });
        }
    }
    
    // =====================================================
    // 9. RÉSILIER UN CONTRAT
    // =====================================================
    
    async terminateContract(contractId, userId, reason, userRole) {
        const transaction = await sequelize.transaction();
        
        try {
            const contract = await Contract.findOne({
                where: { id: contractId, status: 'active' },
                transaction
            });
            if (!contract) throw new Error('Contrat non trouvé ou déjà terminé');
            
            // Vérifier l'autorisation
            if (userRole === 'passenger' && contract.passenger_id !== userId) {
                throw new Error('Vous n\'êtes pas autorisé à résilier ce contrat');
            }
            if (userRole === 'driver' && contract.driver_id !== userId) {
                throw new Error('Vous n\'êtes pas autorisé à résilier ce contrat');
            }
            
            await contract.update({
                status: 'cancelled',
                cancelled_at: new Date()
            }, { transaction });
            
            // Annuler les créneaux futurs
            await ContractDailySlot.update({
                morning_status: 'cancelled_passenger',
                evening_status: 'cancelled_passenger'
            }, {
                where: {
                    contract_id: contractId,
                    ride_date: { [Op.gte]: new Date() }
                },
                transaction
            });
            
            await transaction.commit();
            
            // Notifier l'autre partie
            if (userRole === 'passenger') {
                await contractNotificationService.notifyDriverContractTerminated(contract, reason);
            } else {
                await contractNotificationService.notifyPassengerContractTerminated(contract, reason);
            }
            
            return contract;
            
        } catch (error) {
            await transaction.rollback();
            throw error;
        }
    }
    
    // =====================================================
    // 10. RÉCUPÉRER LES CONTRATS D'UN UTILISATEUR
    // =====================================================
    
    async getUserContracts(userId, role, filters = {}) {
        const { limit = 50, offset = 0, status } = filters;
        
        const where = { status: { [Op.ne]: 'cancelled' } };
        if (status) where.status = status;
        
        if (role === 'passenger') {
            where.passenger_id = userId;
        } else if (role === 'driver') {
            where.driver_id = userId;
        }
        
        const contracts = await Contract.findAndCountAll({
            where,
            include: [
                {
                    model: User,
                    as: role === 'passenger' ? 'driver' : 'passenger',
                    attributes: ['id', 'first_name', 'last_name', 'avatar_url', 'phone']
                }
            ],
            order: [['created_at', 'DESC']],
            limit: parseInt(limit),
            offset: parseInt(offset)
        });
        
        return contracts;
    }
    
    // =====================================================
    // 11. RÉCUPÉRER LES DÉTAILS D'UN CONTRAT
    // =====================================================
    
    async getContractDetails(contractId, userId) {
        const contract = await Contract.findOne({
            where: { id: contractId },
            include: [
                {
                    model: User,
                    as: 'passenger',
                    attributes: ['id', 'first_name', 'last_name', 'avatar_url', 'phone', 'rating']
                },
                {
                    model: User,
                    as: 'driver',
                    attributes: ['id', 'first_name', 'last_name', 'avatar_url', 'phone', 'rating']
                },
                {
                    model: ContractDailySlot,
                    as: 'daily_slots',
                    limit: 30,
                    order: [['ride_date', 'DESC']]
                },
                {
                    model: ContractPayment,
                    as: 'payments',
                    order: [['month', 'DESC']],
                    limit: 12
                }
            ]
        });
        
        if (!contract) throw new Error('Contrat non trouvé');
        
        // Vérifier l'accès
        if (contract.passenger_id !== userId && contract.driver_id !== userId) {
            throw new Error('Accès non autorisé');
        }
        
        // Statistiques
        const totalDays = contract.daily_slots.length;
        const completedDays = contract.daily_slots.filter(s => s.is_paid).length;
        const pendingDays = totalDays - completedDays;
        
        return {
            ...contract.toJSON(),
            stats: {
                total_days: totalDays,
                completed_days: completedDays,
                pending_days: pendingDays,
                completion_rate: totalDays > 0 ? (completedDays / totalDays * 100).toFixed(1) : 0
            }
        };
    }
}

module.exports = new ContractService();