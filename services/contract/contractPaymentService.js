const { sequelize } = require('../../config/database');
const { Contract, ContractPayment, Wallet, Transaction } = require('../../models');
const walletService = require('../payment/walletService');
const { Op } = require('sequelize');

class ContractPaymentService {
    
    // =====================================================
    // 1. TRAITER LES PAIEMENTS MENSUELS
    // =====================================================
    
    async processMonthlyPayments() {
        const transaction = await sequelize.transaction();
        
        try {
            const firstDayOfMonth = new Date();
            firstDayOfMonth.setDate(1);
            firstDayOfMonth.setHours(0, 0, 0, 0);
            
            const payments = await ContractPayment.findAll({
                where: {
                    status: 'pending',
                    month: firstDayOfMonth
                },
                include: [{ model: Contract, as: 'contract' }],
                transaction
            });
            
            for (const payment of payments) {
                try {
                    // Créditer le chauffeur
                    const depositResult = await walletService.deposit(
                        payment.driver_id,
                        payment.driver_payout,
                        'contract_payment',
                        `Paiement contrat ${payment.contract_id} - ${payment.month}`
                    );
                    
                    // Débiter la commission si applicable
                    if (payment.commission_amount > 0) {
                        await walletService.withdraw(
                            payment.driver_id,
                            payment.commission_amount,
                            'commission',
                            `Commission contrat ${payment.contract_id}`
                        );
                    }
                    
                    await payment.update({
                        status: 'processed',
                        processed_at: new Date(),
                        transaction_id: depositResult.transaction_id
                    }, { transaction });
                    
                } catch (error) {
                    console.error(`Erreur paiement ${payment.id}:`, error);
                    await payment.update({ status: 'failed' }, { transaction });
                }
            }
            
            await transaction.commit();
            return { processed: payments.length };
            
        } catch (error) {
            await transaction.rollback();
            throw error;
        }
    }
    
    // =====================================================
    // 2. CALCULER LES STATISTIQUES DE PAIEMENT
    // =====================================================
    
    async getPaymentStats(driverId, year, month) {
        const startDate = new Date(year, month - 1, 1);
        const endDate = new Date(year, month, 0);
        
        const payments = await ContractPayment.findAll({
            where: {
                driver_id: driverId,
                month: { [Op.between]: [startDate, endDate] },
                status: 'processed'
            }
        });
        
        const totalEarnings = payments.reduce((sum, p) => sum + parseFloat(p.driver_payout), 0);
        const totalCommission = payments.reduce((sum, p) => sum + parseFloat(p.commission_amount), 0);
        
        return {
            total_earnings: totalEarnings,
            total_commission: totalCommission,
            monthly_breakdown: payments.map(p => ({
                month: p.month,
                days: p.total_days_completed,
                amount: p.driver_payout,
                commission: p.commission_amount
            }))
        };
    }
}

module.exports = new ContractPaymentService();