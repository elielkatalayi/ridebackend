const { VehicleBooking, Vehicle } = require('../../models');
const { Op } = require('sequelize');

class AvailabilityService {
  
  /**
   * Vérifier si un véhicule est disponible sur une période donnée
   */
  async checkAvailability(vehicleId, startDate, endDate) {
    // Chercher une réservation qui chevauche la période demandée
    const conflictingBooking = await VehicleBooking.findOne({
      where: {
        vehicle_id: vehicleId,
        status: {
          [Op.in]: ['pending', 'accepted', 'ongoing'] // Statuts qui bloquent
        },
        [Op.or]: [
          {
            // Nouvelle réservation commence pendant une réservation existante
            start_date: {
              [Op.between]: [startDate, endDate]
            }
          },
          {
            // Nouvelle réservation se termine pendant une réservation existante
            end_date: {
              [Op.between]: [startDate, endDate]
            }
          },
          {
            // Nouvelle réservation englobe une réservation existante
            [Op.and]: [
              { start_date: { [Op.lte]: startDate } },
              { end_date: { [Op.gte]: endDate } }
            ]
          }
        ]
      }
    });
    
    return {
      available: !conflictingBooking,
      conflictingBooking: conflictingBooking || null
    };
  }
  
  /**
   * Rendre un véhicule indisponible (quand réservé)
   */
  async markAsUnavailable(vehicleId) {
    await Vehicle.update(
      { is_available: false },
      { where: { id: vehicleId } }
    );
  }
  
  /**
   * Rendre un véhicule disponible (quand location terminée ou annulée)
   */
  async markAsAvailable(vehicleId) {
    await Vehicle.update(
      { is_available: true },
      { where: { id: vehicleId } }
    );
  }
  
  /**
   * Vérifier si le véhicule est déjà indisponible
   */
  async isVehicleAvailable(vehicleId) {
    const vehicle = await Vehicle.findByPk(vehicleId, {
      attributes: ['is_available']
    });
    
    return vehicle ? vehicle.is_available : false;
  }
}

module.exports = new AvailabilityService();