const express = require('express');
const router = express.Router();
const { auth } = require('../../middleware/auth');
const upload = require('../../middleware/upload');
const contractController = require('../../controllers/contract/contractController');

// =====================================================
// CONTRATS
// =====================================================

// Créer une demande de contrat
router.post('/requests', auth, upload.single('voice_note'), contractController.createRequest);

// Récupérer les demandes disponibles (chauffeurs)
router.get('/requests/pending', auth, contractController.getPendingRequests);

// Accepter une demande (chauffeur)
router.post('/requests/:requestId/accept', auth, contractController.acceptRequest);

// =====================================================
// GESTION DES CONTRATS ACTIFS
// =====================================================

// Récupérer mes contrats (passager ou chauffeur)
router.get('/my', auth, contractController.getMyContracts);

// Détails d'un contrat
router.get('/:contractId', auth, contractController.getContractDetails);

// Réponse du chauffeur (disponible/indisponible)
router.post('/:contractId/driver-response', auth, contractController.driverResponse);

// Confirmation du passager
router.post('/:contractId/passenger-confirm', auth, contractController.passengerConfirm);

// Compléter une course (chauffeur)
router.post('/:contractId/complete-ride', auth, contractController.completeRide);

// Résilier un contrat
router.post('/:contractId/terminate', auth, contractController.terminateContract);

// =====================================================
// STATISTIQUES ET PAIEMENTS
// =====================================================

// Statistiques de paiement (chauffeur)
router.get('/payments/stats', auth, contractController.getPaymentStats);

module.exports = router;