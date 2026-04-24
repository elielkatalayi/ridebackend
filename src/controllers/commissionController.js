// controllers/commissionController.js

const { CommissionHistory, Ride, Category, User } = require('../models');
const { sequelize } = require('../config/database');
const { Op } = require('sequelize');

class CommissionController {
  
  async getMyCommissionHistory(req, res, next) {
    try {
      const driverId = req.user.id;
      const { limit = 50, offset = 0 } = req.query;
      
      // Récupérer les commissions
      const commissions = await CommissionHistory.findAndCountAll({
        where: { driver_id: driverId },
        order: [['created_at', 'DESC']],
        limit: parseInt(limit),
        offset: parseInt(offset)
      });
      
      // Récupérer les détails des courses séparément
      const rideIds = commissions.rows.map(c => c.ride_id).filter(id => id);
      
      let rides = [];
      if (rideIds.length > 0) {
        rides = await Ride.findAll({
          where: { id: rideIds },
          include: [{ model: Category, as: 'category' }]
        });
      }
      
      // Créer un map ride_id → ride
      const rideMap = {};
      rides.forEach(ride => {
        rideMap[ride.id] = ride;
      });
      
      // Calculer les statistiques
      const statsResult = await CommissionHistory.findAll({
        where: { driver_id: driverId },
        attributes: [
          [sequelize.fn('COUNT', sequelize.col('CommissionHistory.id')), 'total_rides'],
          [sequelize.fn('SUM', sequelize.col('total_amount')), 'total_earned_before_commission'],
          [sequelize.fn('SUM', sequelize.col('commission_amount')), 'total_commission_paid'],
          [sequelize.fn('SUM', sequelize.col('driver_net')), 'total_net_earned']
        ]
      });
      
      const stats = statsResult[0] || {};
      
      res.json({
        success: true,
        stats: {
          total_rides: parseInt(stats.dataValues?.total_rides) || 0,
          total_earned_before_commission: parseInt(stats.dataValues?.total_earned_before_commission) || 0,
          total_commission_paid: parseInt(stats.dataValues?.total_commission_paid) || 0,
          total_net_earned: parseInt(stats.dataValues?.total_net_earned) || 0
        },
        commissions: commissions.rows.map(c => {
          const ride = rideMap[c.ride_id];
          return {
            id: c.id,
            ride_id: c.ride_id,
            total_amount: c.total_amount,
            commission_percentage: c.commission_percentage,
            commission_amount: c.commission_amount,
            driver_net: c.driver_net,
            status: c.status,
            created_at: c.created_at,
            ride: ride ? {
              id: ride.id,
              origin: ride.origin_address,
              destination: ride.destination_address,
              distance_km: ride.distance_meters ? (ride.distance_meters / 1000).toFixed(2) : null,
              duration_min: ride.duration_with_traffic_sec ? Math.ceil(ride.duration_with_traffic_sec / 60) : null,
              category: ride.category ? {
                name: ride.category.name,
                icon: ride.category.icon
              } : null
            } : null
          };
        }),
        pagination: {
          total: commissions.count,
          limit: parseInt(limit),
          offset: parseInt(offset),
          has_more: (parseInt(offset) + parseInt(limit)) < commissions.count
        }
      });
      
    } catch (error) {
      next(error);
    }
  }

  async getMyCommissionStats(req, res, next) {
    try {
      const driverId = req.user.id;
      
      // Récupérer toutes les commissions
      const commissions = await CommissionHistory.findAll({
        where: { driver_id: driverId },
        attributes: [
          'id', 'ride_id', 'total_amount', 'commission_amount', 'driver_net', 'commission_percentage'
        ]
      });
      
      if (commissions.length === 0) {
        return res.json({
          success: true,
          category_stats: []
        });
      }
      
      // Récupérer les courses associées
      const rideIds = [...new Set(commissions.map(c => c.ride_id).filter(id => id))];
      
      let rides = [];
      if (rideIds.length > 0) {
        rides = await Ride.findAll({
          where: { id: rideIds },
          attributes: ['id', 'category_id'],
          include: [{ model: Category, as: 'category', attributes: ['id', 'name'] }]
        });
      }
      
      const rideMap = {};
      rides.forEach(ride => {
        rideMap[ride.id] = ride;
      });
      
      // Statistiques par catégorie
      const categoryStats = {};
      
      for (const c of commissions) {
        const ride = rideMap[c.ride_id];
        let categoryName = 'Inconnue';
        
        if (ride && ride.category) {
          categoryName = ride.category.name;
        }
        
        if (!categoryStats[categoryName]) {
          categoryStats[categoryName] = {
            category_name: categoryName,
            rides_count: 0,
            total_amount: 0,
            commission_amount: 0,
            net_amount: 0
          };
        }
        
        categoryStats[categoryName].rides_count++;
        categoryStats[categoryName].total_amount += c.total_amount;
        categoryStats[categoryName].commission_amount += c.commission_amount;
        categoryStats[categoryName].net_amount += c.driver_net;
      }
      
      res.json({
        success: true,
        category_stats: Object.values(categoryStats)
      });
      
    } catch (error) {
      next(error);
    }
  }

  async getCommissionDetail(req, res, next) {
    try {
      const { commissionId } = req.params;
      const driverId = req.user.id;
      
      const commission = await CommissionHistory.findOne({
        where: { id: commissionId, driver_id: driverId }
      });
      
      if (!commission) {
        return res.status(404).json({ error: 'Commission non trouvée' });
      }
      
      const ride = await Ride.findByPk(commission.ride_id, {
        include: [
          { model: Category, as: 'category' },
          { model: User, as: 'passenger', attributes: ['id', 'first_name', 'last_name', 'phone'] }
        ]
      });
      
      res.json({
        success: true,
        commission: {
          id: commission.id,
          ride_id: commission.ride_id,
          total_amount: commission.total_amount,
          commission_percentage: commission.commission_percentage,
          commission_amount: commission.commission_amount,
          driver_net: commission.driver_net,
          status: commission.status,
          created_at: commission.created_at,
          ride: ride ? {
            id: ride.id,
            origin: ride.origin_address,
            destination: ride.destination_address,
            distance_km: ride.distance_meters ? (ride.distance_meters / 1000).toFixed(2) : null,
            duration_min: ride.duration_with_traffic_sec ? Math.ceil(ride.duration_with_traffic_sec / 60) : null,
            passenger: ride.passenger ? {
              name: `${ride.passenger.first_name || ''} ${ride.passenger.last_name || ''}`.trim(),
              phone: ride.passenger.phone
            } : null,
            category: ride.category ? {
              id: ride.category.id,
              name: ride.category.name,
              icon: ride.category.icon
            } : null
          } : null
        }
      });
      
    } catch (error) {
      next(error);
    }
  }

    /**
   * Exporter les commissions en CSV
   * GET /api/v1/commissions/export
   */
  async exportCommissions(req, res, next) {
    try {
      const driverId = req.user.id;
      
      const commissions = await CommissionHistory.findAll({
        where: { driver_id: driverId },
        include: [
          {
            model: Ride,
            as: 'ride',
            include: [{ model: Category, as: 'category' }]
          }
        ],
        order: [['created_at', 'DESC']]
      });
      
      // Créer le CSV
      const csvRows = [
        ['Date', 'Course ID', 'Origine', 'Destination', 'Catégorie', 'Montant Total', 'Commission %', 'Commission', 'Net Reçu']
      ];
      
      for (const c of commissions) {
        csvRows.push([
          new Date(c.created_at).toLocaleDateString('fr-FR'),
          c.ride_id,
          c.ride?.origin_address?.substring(0, 50) || '-',
          c.ride?.destination_address?.substring(0, 50) || '-',
          c.ride?.category?.name || '-',
          c.total_amount,
          `${c.commission_percentage}%`,
          c.commission_amount,
          c.driver_net
        ]);
      }
      
      const csvContent = csvRows.map(row => row.join(';')).join('\n');
      
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', `attachment; filename=commissions_${new Date().toISOString().split('T')[0]}.csv`);
      res.send(csvContent);
      
    } catch (error) {
      next(error);
    }
  }
}

module.exports = new CommissionController();