const { supabaseStorage, STORAGE_BUCKETS } = require('../../config/supabase');

class SupabaseStorageService {
  /**
   * Uploader la photo d'un document de chauffeur
   * @param {string} driverId - ID du chauffeur
   * @param {string} documentType - Type de document (license, insurance, etc.)
   * @param {Buffer} file - Fichier à uploader
   * @returns {Promise<string>} URL publique
   */
  async uploadDriverDocument(driverId, documentType, file) {
    const fileExtension = this.getFileExtension(file);
    const path = `drivers/${driverId}/${documentType}_${Date.now()}.${fileExtension}`;
    
    const url = await supabaseStorage.uploadFile(
      STORAGE_BUCKETS.DRIVER_DOCUMENTS,
      path,
      file
    );
    
    return url;
  }

  /**
   * Uploader la photo d'un véhicule
   * @param {string} driverId - ID du chauffeur
   * @param {string} photoType - Type de photo (front, back, interior)
   * @param {Buffer} file - Fichier à uploader
   * @returns {Promise<string>} URL publique
   */
  async uploadVehiclePhoto(driverId, photoType, file) {
    const fileExtension = this.getFileExtension(file);
    const path = `drivers/${driverId}/vehicle/${photoType}_${Date.now()}.${fileExtension}`;
    
    const url = await supabaseStorage.uploadFile(
      STORAGE_BUCKETS.DRIVER_VEHICLES,
      path,
      file
    );
    
    return url;
  }

  /**
   * Uploader l'avatar d'un utilisateur
   * @param {string} userId - ID de l'utilisateur
   * @param {Buffer} file - Fichier à uploader
   * @returns {Promise<string>} URL publique
   */
  async uploadUserAvatar(userId, file) {
    const fileExtension = this.getFileExtension(file);
    const path = `users/${userId}/avatar_${Date.now()}.${fileExtension}`;
    
    const url = await supabaseStorage.uploadFile(
      STORAGE_BUCKETS.USER_AVATARS,
      path,
      file
    );
    
    return url;
  }

  /**
   * Uploader une preuve pour une alerte SOS
   * @param {string} sosAlertId - ID de l'alerte SOS
   * @param {Buffer} file - Fichier à uploader
   * @returns {Promise<string>} URL publique
   */
  async uploadSosEvidence(sosAlertId, file) {
    const fileExtension = this.getFileExtension(file);
    const path = `sos/${sosAlertId}/evidence_${Date.now()}.${fileExtension}`;
    
    const url = await supabaseStorage.uploadFile(
      STORAGE_BUCKETS.SOS_EVIDENCE,
      path,
      file
    );
    
    return url;
  }

  /**
   * Uploader un document de location
   * @param {string} rentalId - ID de la location
   * @param {string} documentType - Type de document
   * @param {Buffer} file - Fichier à uploader
   * @returns {Promise<string>} URL publique
   */
  async uploadRentalDocument(rentalId, documentType, file) {
    const fileExtension = this.getFileExtension(file);
    const path = `rentals/${rentalId}/${documentType}_${Date.now()}.${fileExtension}`;
    
    const url = await supabaseStorage.uploadFile(
      STORAGE_BUCKETS.RENTAL_DOCUMENTS,
      path,
      file
    );
    
    return url;
  }

  /**
   * Supprimer un fichier
   * @param {string} bucket - Bucket Supabase
   * @param {string} path - Chemin du fichier
   * @returns {Promise<boolean>}
   */
  async deleteFile(bucket, path) {
    return supabaseStorage.deleteFile(bucket, path);
  }

  /**
   * Obtenir l'extension d'un fichier
   * @param {Buffer} file - Fichier
   * @returns {string} Extension
   */
  getFileExtension(file) {
    // Cette fonction devrait détecter le type MIME
    // Pour simplifier, on retourne 'jpg'
    return 'jpg';
  }

  /**
   * Redimensionner et optimiser une image
   * @param {Buffer} file - Fichier original
   * @param {number} width - Largeur cible
   * @param {number} height - Hauteur cible
   * @returns {Promise<Buffer>} Image redimensionnée
   */
  async resizeImage(file, width = 800, height = 600) {
    // TODO: Implémenter avec sharp
    // const sharp = require('sharp');
    // return sharp(file).resize(width, height).jpeg({ quality: 80 }).toBuffer();
    return file; // Temporaire
  }

  /**
   * Générer un nom de fichier unique
   * @param {string} originalName - Nom original
   * @returns {string} Nom unique
   */
  generateUniqueFilename(originalName) {
    const extension = originalName.split('.').pop();
    const timestamp = Date.now();
    const random = Math.random().toString(36).substring(2, 8);
    return `${timestamp}_${random}.${extension}`;
  }
}

module.exports = new SupabaseStorageService();