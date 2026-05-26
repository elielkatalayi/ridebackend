const contractService = require('../../services/contract/contractService');
const contractPaymentService = require('../../services/contract/contractPaymentService');

class ContractController {
    
    // =====================================================
    // 1. CRÉER UNE DEMANDE DE CONTRAT
    // =====================================================
    
    async createRequest(req, res, next) {
        try {
            const userId = req.user.id;
            const data = req.body;
            const voiceNoteFile = req.file;
            
            const request = await contractService.createRequest(userId, data, voiceNoteFile);
            
            res.status(201).json({
                state: true,
                message: 'Demande de contrat créée avec succès',
                datas: request
            });
            
        } catch (error) {
            next(error);
        }
    }
    
    // =====================================================
    // 2. RÉCUPÉRER LES DEMANDES DISPONIBLES
    // =====================================================
    
    async getPendingRequests(req, res, next) {
        try {
            const { limit, offset } = req.query;
            const requests = await contractService.getPendingRequests({ limit, offset });
            
            res.json({
                state: true,
                message: 'Demandes récupérées avec succès',
                datas: requests.rows,
                meta: {
                    total: requests.count,
                    count: requests.rows.length,
                    per_page: parseInt(req.query.limit) || 50,
                    current_page: Math.floor(parseInt(req.query.offset || 0) / parseInt(req.query.limit || 50)) + 1,
                    total_pages: Math.ceil(requests.count / parseInt(req.query.limit || 50))
                }
            });
            
        } catch (error) {
            next(error);
        }
    }
    
    // =====================================================
    // 3. ACCEPTER UNE DEMANDE
    // =====================================================
    
    async acceptRequest(req, res, next) {
        try {
            const { requestId } = req.params;
            const driverId = req.user.id;
            
            const contract = await contractService.acceptRequest(requestId, driverId);
            
            res.json({
                state: true,
                message: 'Contrat accepté avec succès',
                datas: contract
            });
            
        } catch (error) {
            next(error);
        }
    }
    
    // =====================================================
    // 4. RÉPONSE DU CHAUFFEUR
    // =====================================================
    
    async driverResponse(req, res, next) {
        try {
            const { contractId } = req.params;
            const { slotDate, period, isAvailable } = req.body;
            const driverId = req.user.id;
            
            const slot = await contractService.driverResponse(
                contractId, driverId, slotDate, period, isAvailable
            );
            
            res.json({
                state: true,
                message: isAvailable ? 'Disponibilité confirmée' : 'Indisponibilité enregistrée',
                datas: slot
            });
            
        } catch (error) {
            next(error);
        }
    }
    
    // =====================================================
    // 5. CONFIRMATION DU PASSAGER
    // =====================================================
    
    async passengerConfirm(req, res, next) {
        try {
            const { contractId } = req.params;
            const { slotDate, period, isConfirmed } = req.body;
            const passengerId = req.user.id;
            
            const slot = await contractService.passengerConfirm(
                contractId, passengerId, slotDate, period, isConfirmed
            );
            
            res.json({
                state: true,
                message: isConfirmed ? 'Course confirmée' : 'Course annulée',
                datas: slot
            });
            
        } catch (error) {
            next(error);
        }
    }
    
    // =====================================================
    // 6. COMPLÉTER UNE COURSE
    // =====================================================
    
    async completeRide(req, res, next) {
        try {
            const { contractId } = req.params;
            const { slotDate, period, rideData } = req.body;
            const driverId = req.user.id;
            
            const result = await contractService.completeRide(
                contractId, driverId, slotDate, period, rideData
            );
            
            res.json({
                state: true,
                message: 'Course complétée avec succès',
                datas: result
            });
            
        } catch (error) {
            next(error);
        }
    }
    
    // =====================================================
    // 7. RÉSILIER UN CONTRAT
    // =====================================================
    
    async terminateContract(req, res, next) {
        try {
            const { contractId } = req.params;
            const { reason } = req.body;
            const userId = req.user.id;
            const userRole = req.user.role;
            
            const contract = await contractService.terminateContract(
                contractId, userId, reason, userRole
            );
            
            res.json({
                state: true,
                message: 'Contrat résilié avec succès',
                datas: contract
            });
            
        } catch (error) {
            next(error);
        }
    }
    
    // =====================================================
    // 8. RÉCUPÉRER MES CONTRATS
    // =====================================================
    
    async getMyContracts(req, res, next) {
        try {
            const userId = req.user.id;
            const userRole = req.user.role;
            const { limit, offset, status } = req.query;
            
            const result = await contractService.getUserContracts(userId, userRole, {
                limit, offset, status
            });
            
            res.json({
                state: true,
                message: 'Contrats récupérés avec succès',
                datas: result.rows,
                meta: {
                    total: result.count,
                    count: result.rows.length,
                    per_page: parseInt(limit) || 50,
                    current_page: Math.floor(parseInt(offset || 0) / parseInt(limit || 50)) + 1,
                    total_pages: Math.ceil(result.count / parseInt(limit || 50))
                }
            });
            
        } catch (error) {
            next(error);
        }
    }
    
    // =====================================================
    // 9. DÉTAILS D'UN CONTRAT
    // =====================================================
    
    async getContractDetails(req, res, next) {
        try {
            const { contractId } = req.params;
            const userId = req.user.id;
            
            const contract = await contractService.getContractDetails(contractId, userId);
            
            res.json({
                state: true,
                message: 'Détails du contrat récupérés',
                datas: contract
            });
            
        } catch (error) {
            next(error);
        }
    }
    
    // =====================================================
    // 10. STATISTIQUES DE PAIEMENT
    // =====================================================
    
    async getPaymentStats(req, res, next) {
        try {
            const driverId = req.user.id;
            const { year, month } = req.query;
            
            const stats = await contractPaymentService.getPaymentStats(
                driverId, 
                parseInt(year) || new Date().getFullYear(),
                parseInt(month) || new Date().getMonth() + 1
            );
            
            res.json({
                state: true,
                message: 'Statistiques récupérées',
                datas: stats
            });
            
        } catch (error) {
            next(error);
        }
    }
}

module.exports = new ContractController();