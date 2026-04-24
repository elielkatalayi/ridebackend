const { createClient } = require('@supabase/supabase-js');
const env = require('./env');

// =====================================================
// ☁️ CLIENT SUPABASE (Storage uniquement)
// =====================================================
const supabase = createClient(
  env.SUPABASE_URL,
  env.SUPABASE_SERVICE_KEY,
  {
    auth: {
      persistSession: false,
      autoRefreshToken: false
    },
    db: {
      schema: 'public'
    },
    storage: {
      bucketUrl: `${env.SUPABASE_URL}/storage/v1`
    }
  }
);

// =====================================================
// 📁 FONCTIONS STORAGE
// =====================================================
const supabaseStorage = {
  /**
   * Upload d'un fichier vers Supabase Storage
   * @param {string} bucket - Nom du bucket (ex: 'driver-documents')
   * @param {string} path - Chemin du fichier (ex: 'users/user123/permis.jpg')
   * @param {Buffer|File} file - Fichier à uploader
   * @returns {Promise<string>} - URL publique du fichier
   */
  uploadFile: async (bucket, path, file) => {
    const { data, error } = await supabase.storage
      .from(bucket)
      .upload(path, file, {
        cacheControl: '3600',
        upsert: true
      });
    
    if (error) throw error;
    
    // Récupérer l'URL publique
    const { data: publicUrl } = supabase.storage
      .from(bucket)
      .getPublicUrl(path);
    
    return publicUrl.publicUrl;
  },

  /**
   * Supprimer un fichier
   * @param {string} bucket - Nom du bucket
   * @param {string} path - Chemin du fichier
   */
  deleteFile: async (bucket, path) => {
    const { error } = await supabase.storage
      .from(bucket)
      .remove([path]);
    
    if (error) throw error;
    return true;
  },

  /**
   * Lister les fichiers d'un dossier
   * @param {string} bucket - Nom du bucket
   * @param {string} prefix - Préfixe du chemin
   */
  listFiles: async (bucket, prefix) => {
    const { data, error } = await supabase.storage
      .from(bucket)
      .list(prefix);
    
    if (error) throw error;
    return data;
  }
};

// =====================================================
// 📦 BUCKETS DISPONIBLES
// =====================================================
const STORAGE_BUCKETS = {
  DRIVER_DOCUMENTS: 'driver-documents',
  DRIVER_VEHICLES: 'driver-vehicles',
  USER_AVATARS: 'user-avatars',
  SOS_EVIDENCE: 'sos-evidence',
  RENTAL_DOCUMENTS: 'rental-documents'
};

module.exports = {
  supabase,
  supabaseStorage,
  STORAGE_BUCKETS
};