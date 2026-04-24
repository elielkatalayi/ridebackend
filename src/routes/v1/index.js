const express = require('express');
const router = express.Router();

// Importation des routes
let authRoutes, userRoutes, rideRoutes, driverRoutes, categoryRoutes, pricingRoutes, paymentRoutes, walletRoutes, sosRoutes, rentalRoutes, adminRoutes, webhookRoutes, notificationRoutes, pageRoutes, groupRoutes, postRoutes, interactionRoutes, viralRoutes, chatRoutes, storyRoutes;

try {
  authRoutes = require('./authRoutes');
  console.log('✅ authRoutes chargé');
} catch (error) {
  console.error('❌ Erreur chargement authRoutes:', error.message);
}

try {
  userRoutes = require('./userRoutes');
  console.log('✅ userRoutes chargé');
} catch (error) {
  console.error('❌ Erreur chargement userRoutes:', error.message);
}

try {
  rideRoutes = require('./ride/rideRoutes');
  console.log('✅ rideRoutes chargé');
} catch (error) {
  console.error('❌ Erreur chargement rideRoutes:', error.message);
}

try {
  driverRoutes = require('./ride/driverRoutes');
  console.log('✅ driverRoutes chargé');
} catch (error) {
  console.error('❌ Erreur chargement driverRoutes:', error.message);
}

try {
  categoryRoutes = require('./ride//categoryRoutes');
  console.log('✅ categoryRoutes chargé');
} catch (error) {
  console.error('❌ Erreur chargement categoryRoutes:', error.message);
}

try {
  pricingRoutes = require('./ride//pricingRoutes');
  console.log('✅ pricingRoutes chargé');
} catch (error) {
  console.error('❌ Erreur chargement pricingRoutes:', error.message);
}

try {
  paymentRoutes = require('./paymentRoutes');
  console.log('✅ paymentRoutes chargé');
} catch (error) {
  console.error('❌ Erreur chargement paymentRoutes:', error.message);
}

try {
  walletRoutes = require('./walletRoutes');
  console.log('✅ walletRoutes chargé');
} catch (error) {
  console.error('❌ Erreur chargement walletRoutes:', error.message);
}

try {
  sosRoutes = require('./ride/sosRoutes');
  console.log('✅ sosRoutes chargé');
} catch (error) {
  console.error('❌ Erreur chargement sosRoutes:', error.message);
}

// try {
//   rentalRoutes = require('./ride/rentalRoutes');
//   console.log('✅ rentalRoutes chargé');
// } catch (error) {
//   console.error('❌ Erreur chargement rentalRoutes:', error.message);
// }

try {
  adminRoutes = require('./adminRoutes');
  console.log('✅ adminRoutes chargé');
} catch (error) {
  console.error('❌ Erreur chargement adminRoutes:', error.message);
}

try {
  webhookRoutes = require('./webhookRoutes');
  console.log('✅ webhookRoutes chargé');
} catch (error) {
  console.error('❌ Erreur chargement webhookRoutes:', error.message);
}

try {
  notificationRoutes = require('./notificationRoutes');
  console.log('✅ notificationRoutes chargé');
} catch (error) {
  console.error('❌ Erreur chargement notificationRoutes:', error.message);
}

// NOUVELLES ROUTES SOCIALES
try {
  pageRoutes = require('./socialroute/pageRoutes');
  console.log('✅ pageRoutes chargé');
} catch (error) {
  console.error('❌ Erreur chargement pageRoutes:', error.message);
}

try {
  groupRoutes = require('./socialroute/groupRoutes');
  console.log('✅ groupRoutes chargé');
} catch (error) {
  console.error('❌ Erreur chargement groupRoutes:', error.message);
}

try {
  postRoutes = require('./socialroute/postRoutes');
  console.log('✅ postRoutes chargé');
} catch (error) {
  console.error('❌ Erreur chargement postRoutes:', error.message);
}

try {
  interactionRoutes = require('./socialroute/interactionRoutes');
  console.log('✅ interactionRoutes chargé');
} catch (error) {
  console.error('❌ Erreur chargement interactionRoutes:', error.message);
}

try {
  viralRoutes = require('./socialroute/viralRoutes');
  console.log('✅ viralRoutes chargé');
} catch (error) {
  console.error('❌ Erreur chargement viralRoutes:', error.message);
}

// Route chat (NOUVELLE)
try {
  chatRoutes = require('./chatRoute/chatRoutes');
  console.log('✅ chatRoutes chargé');
} catch (error) {
  console.error('❌ Erreur chargement chatRoutes:', error.message);
}

// STORIES
try {
  storyRoutes = require('./socialroute/storyRoutes');
  console.log('✅ storyRoutes chargé');
} catch (error) {
  console.error('❌ Erreur chargement storyRoutes:', error.message);
}


//noteRoutes
try {
  noteRoutes = require('./chatRoute/noteRoutes');
  console.log('✅ noteRoutes chargé');
} catch (error) {
  console.error('❌ Erreur chargement noteRoutes:', error.message);
}
//adRoutes
try {
  adRoutes = require('./socialroute/adRoutes');
  console.log('✅ adRoutes chargé');
} catch (error) {
  console.error('❌ Erreur chargement adRoutes:', error.message);
}
try {
  locationRoutes = require('./locationRoutes');
  console.log('✅ locationRoutes chargé');
} catch (error) {
  console.error('❌ Erreur chargement locationRoutes:', error.message);
}

// commissionRoutes
try {
  commissionRoutes = require('./commissionRoutes');
  console.log('✅ commissionRoutes chargé');
} catch (error) {
  console.error('❌ Erreur chargement commissionRoutes:', error.message);
}

// vehicleRentalRoutes
try {
  vehicleRentalRoutes = require('./rental/vehicleRentalRoutes');
  console.log('✅ vehicleRentalRoutes chargé');
} catch (error) {
  console.error('❌ Erreur chargement vehicleRentalRoutes:', error.message);
}


// Documentation API
router.get('/docs', (req, res) => {
  res.json({
    name: 'MediBE API',
    version: '1.0.0',
    description: 'API de la plateforme de mobilité MediBE',
    endpoints: {
      auth: '/api/v1/auth',
      users: '/api/v1/users',
      rides: '/api/v1/rides',
      drivers: '/api/v1/drivers',
      categories: '/api/v1/categories',
      pricing: '/api/v1/pricing',
      payments: '/api/v1/payments',
      wallet: '/api/v1/wallet',
      sos: '/api/v1/sos',
      rentals: '/api/v1/rentals',
      admin: '/api/v1/admin',
      webhooks: '/api/v1/webhooks'
    }
  });
});

// Montage des routes (avec vérification que les modules existent)
try {
  if (authRoutes) router.use('/auth', authRoutes);
  if (userRoutes) router.use('/users', userRoutes);
  if (rideRoutes) router.use('/rides', rideRoutes);
  if (driverRoutes) router.use('/drivers', driverRoutes);
  if (categoryRoutes) router.use('/categories', categoryRoutes);
  if (pricingRoutes) router.use('/pricing', pricingRoutes);
  if (paymentRoutes) router.use('/payments', paymentRoutes);
  if (walletRoutes) router.use('/wallet', walletRoutes);
  if (sosRoutes) router.use('/sos', sosRoutes);
  // if (rentalRoutes) router.use('/rentals', rentalRoutes);
  if (adminRoutes) router.use('/admin', adminRoutes);
  if (webhookRoutes) router.use('/webhooks', webhookRoutes);
  if (notificationRoutes) router.use('/notification', notificationRoutes);
  if (pageRoutes) router.use('/pages', pageRoutes);
  if (groupRoutes) router.use('/groups', groupRoutes);
  if (postRoutes) router.use('/posts', postRoutes);
  if (interactionRoutes) router.use('/interactions', interactionRoutes);
  if (viralRoutes) router.use('/viral', viralRoutes);
  if (chatRoutes) router.use('/chat', chatRoutes);   
  if (storyRoutes) router.use('/stories', storyRoutes);
  if (noteRoutes) router.use('/note', noteRoutes);
  if (adRoutes) router.use('/advertising', adRoutes);
  if (locationRoutes ) router.use('/location', locationRoutes );
  if (commissionRoutes) router.use('/commissions', commissionRoutes);
  if (vehicleRentalRoutes) router.use('/rentals', vehicleRentalRoutes);   
  console.log('✅ Toutes les routes ont été montées avec succès');
} catch (error) {
  console.error('❌ Erreur lors du montage des routes:', error.message);
}

module.exports = router; 