const { sequelize } = require('../../config/database');
const { Page, PageAdmin, PageFollower, User, Post } = require('../../models');
const { uploadToSupabase, deleteFromSupabase } = require('../../utils/storage');
const NotificationService = require('../../services/notification/NotificationService');
const { v4: uuidv4 } = require('uuid');
const { Op } = require('sequelize');

class PageController {
    
    
    
    // =====================================================
    // CRÉATION
    // =====================================================
    
    async createPage(req, res) {
        const transaction = await sequelize.transaction();
        
        try {
            const generateSlug = (name) => {
                return name
                    .toLowerCase()
                    .normalize('NFD')
                    .replace(/[\u0300-\u036f]/g, '')
                    .replace(/[^a-z0-9]+/g, '-')
                    .replace(/^-|-$/g, '');
            };
            
            const userId = req.user.id;
            const {
                name, description, category, phone, email, website,
                address, city, country, settings
            } = req.body;
            
            // ✅ EMPÊCHER la création d'une deuxième page personnelle
            if (category === 'personal') {
                const existingPersonalPage = await Page.findOne({
                    where: {
                        created_by: userId,
                        'settings.is_personal_page': true
                    }
                });
                
                if (existingPersonalPage) {
                    return res.status(400).json({
                        success: false,
                        error: 'Vous avez déjà une page personnelle. Vous ne pouvez pas en créer une autre.'
                    });
                }
            }
            
            // Validation
            if (!name || !description) {
                return res.status(400).json({
                    success: false,
                    error: 'Le nom et la description sont obligatoires'
                });
            }
            
            // Générer le slug
            const slug = generateSlug(name);
            
            // Vérifier si le slug existe déjà
            const existingPage = await Page.findOne({ 
                where: { slug }, 
                transaction 
            });
            
            if (existingPage) {
                await transaction.rollback();
                return res.status(400).json({
                    success: false,
                    error: 'Une page avec ce nom existe déjà'
                });
            }
            
            // Upload de la photo de profil
            let profile_picture = null;
            if (req.files && req.files.profile_picture && req.files.profile_picture[0]) {
                const file = req.files.profile_picture[0];
                const fileExt = file.originalname.split('.').pop();
                const fileName = `page_${uuidv4()}_profile.${fileExt}`;
                
                const { url } = await uploadToSupabase(
                    'social-media',
                    'pages/profiles',
                    file.buffer,
                    file.mimetype,
                    fileName
                );
                profile_picture = url;
            }
            
            // Upload de la photo de couverture
            let cover_photo = null;
            if (req.files && req.files.cover_photo && req.files.cover_photo[0]) {
                const file = req.files.cover_photo[0];
                const fileExt = file.originalname.split('.').pop();
                const fileName = `page_${uuidv4()}_cover.${fileExt}`;
                
                const { url } = await uploadToSupabase(
                    'social-media',
                    'pages/covers',
                    file.buffer,
                    file.mimetype,
                    fileName
                );
                cover_photo = url;
            }
            
            // Créer la page
            const page = await Page.create({
                name,
                slug,
                description,
                category: category || null,
                phone: phone || null,
                email: email || null,
                website: website || null,
                address: address || null,
                city: city || null,
                country: country || null,
                profile_picture,
                cover_photo,
                created_by: userId,
                settings: {
                    ...(settings || {}),
                    is_personal_page: category === 'personal' ? true : false
                },
                is_active: true,
                is_verified: false,
                is_deleted: false,
                followers_count: 0,
                posts_count: 0,
                stories_count: 0,
                total_likes: 0,
                total_views: 0,
                engagement_score: 0,
                viral_score: 0
            }, { transaction });
            
            // Ajouter le créateur comme admin
            await PageAdmin.create({
                page_id: page.id,
                user_id: userId,
                role: 'admin'
            }, { transaction });
            
            await transaction.commit();
            
            await NotificationService.sendSystemNotification(
                userId,
                'Page créée avec succès 🎉',
                `Votre page "${name}" a été créée avec succès.`,
                { 
                    page_id: page.id, 
                    page_name: name,
                    page_slug: slug 
                }
            );
            
            res.status(201).json({
                success: true,
                message: 'Page créée avec succès',
                data: {
                    id: page.id,
                    name: page.name,
                    slug: page.slug,
                    description: page.description,
                    category: page.category,
                    profile_picture: page.profile_picture,
                    cover_photo: page.cover_photo,
                    created_at: page.created_at,
                    is_admin: true,
                    is_following: true,
                    is_personal_page: category === 'personal'
                }
            });
            
        } catch (error) {
            await transaction.rollback();
            console.error('Erreur createPage:', error);
            
            res.status(500).json({ 
                success: false, 
                error: error.message 
            });
        }
    }
    
    // =====================================================
    // PAGE PERSONNELLE
    // =====================================================

    /**
     * Récupérer la page personnelle de l'utilisateur connecté
     * GET /api/v1/pages/me
     */
    async getPersonalPage(req, res) {
        try {
            const userId = req.user.id;
            
            const personalPage = await Page.findOne({
                where: {
                    created_by: userId,
                    'settings.is_personal_page': true
                },
                include: [
                    { model: User, as: 'creator', attributes: ['id', 'first_name', 'last_name', 'avatar_url'] }
                ]
            });
            
            if (!personalPage) {
                return res.status(404).json({
                    success: false,
                    error: 'Page personnelle non trouvée'
                });
            }
            
            // Vérifier si l'utilisateur suit sa propre page
            const isFollowing = await PageFollower.findOne({
                where: { page_id: personalPage.id, user_id: userId }
            });
            
            const result = personalPage.toJSON();
            result.is_admin = true;
            result.is_following = !!isFollowing;
            result.is_personal_page = true;
            
            res.status(200).json({
                success: true,
                data: result
            });
            
        } catch (error) {
            console.error('Erreur getPersonalPage:', error);
            res.status(500).json({ success: false, error: error.message });
        }
    }

    // =====================================================
    // LECTURE
    // =====================================================
    
    async getAllPages(req, res) {
        try {
            const { limit = 20, offset = 0, category, sort = 'newest' } = req.query;
            
            const where = { is_deleted: false };
            if (category) where.category = category;
            
            let order = [];
            switch (sort) {
                case 'newest': order = [['created_at', 'DESC']]; break;
                case 'popular': order = [['followers_count', 'DESC']]; break;
                case 'most_active': order = [['posts_count', 'DESC']]; break;
                default: order = [['created_at', 'DESC']];
            }
            
            const pages = await Page.findAndCountAll({
                where,
                order,
                limit: parseInt(limit),
                offset: parseInt(offset)
            });
            
            res.status(200).json({
                success: true,
                data: pages.rows,
                pagination: {
                    total: pages.count,
                    limit: parseInt(limit),
                    offset: parseInt(offset),
                    has_more: parseInt(offset) + pages.rows.length < pages.count
                }
            });
            
        } catch (error) {
            console.error('Erreur getAllPages:', error);
            res.status(500).json({ success: false, error: error.message });
        }
    }
    
    async getSuggestedPages(req, res) {
        try {
            const userId = req.user.id;
            const { limit = 10 } = req.query;
            
            const followedPages = await PageFollower.findAll({
                where: { user_id: userId },
                attributes: ['page_id']
            });
            
            const excludeIds = followedPages.map(f => f.page_id);
            
            const pages = await Page.findAll({
                where: {
                    id: { [Op.notIn]: excludeIds },
                    is_deleted: false
                },
                order: [
                    ['followers_count', 'DESC'],
                    ['posts_count', 'DESC']
                ],
                limit: parseInt(limit)
            });
            
            res.status(200).json({
                success: true,
                data: pages,
                count: pages.length
            });
            
        } catch (error) {
            console.error('Erreur getSuggestedPages:', error);
            res.status(500).json({ success: false, error: error.message });
        }
    }
    
    async getFollowedPages(req, res) {
        try {
            const userId = req.user.id;
            const { limit = 20, offset = 0 } = req.query;
            
            const followers = await PageFollower.findAndCountAll({
                where: { user_id: userId },
                include: [{ model: Page, as: 'page', where: { is_deleted: false } }],
                limit: parseInt(limit),
                offset: parseInt(offset),
                order: [['created_at', 'DESC']]
            });
            
            const pages = followers.rows.map(f => f.page);
            
            res.status(200).json({
                success: true,
                data: pages,
                pagination: {
                    total: followers.count,
                    limit: parseInt(limit),
                    offset: parseInt(offset),
                    has_more: parseInt(offset) + pages.length < followers.count
                }
            });
            
        } catch (error) {
            console.error('Erreur getFollowedPages:', error);
            res.status(500).json({ success: false, error: error.message });
        }
    }
    
    async getPageById(req, res) {
        try {
            const { page_id } = req.params;
            const userId = req.user?.id;
            
            const page = await Page.findByPk(page_id, {
                include: [
                    { model: User, as: 'creator', attributes: ['id', 'first_name', 'avatar_url'] }
                ]
            });
            
            if (!page || page.is_deleted) {
                return res.status(404).json({
                    success: false,
                    error: 'Page non trouvée'
                });
            }
            
            const result = page.toJSON();
            
            if (userId) {
                const isFollowing = await PageFollower.findOne({
                    where: { page_id, user_id: userId }
                });
                const isAdmin = await PageAdmin.findOne({
                    where: { page_id, user_id: userId }
                });
                
                result.is_following = !!isFollowing;
                result.is_admin = !!isAdmin;
                result.admin_role = isAdmin?.role || null;
            }
            
            res.status(200).json({
                success: true,
                data: result
            });
            
        } catch (error) {
            console.error('Erreur getPageById:', error);
            res.status(500).json({ success: false, error: error.message });
        }
    }
    
    async getPageBySlug(req, res) {
        try {
            const { slug } = req.params;
            const userId = req.user?.id;
            
            const page = await Page.findOne({
                where: { slug, is_deleted: false },
                include: [
                    { model: User, as: 'creator', attributes: ['id', 'first_name', 'avatar_url'] }
                ]
            });
            
            if (!page) {
                return res.status(404).json({
                    success: false,
                    error: 'Page non trouvée'
                });
            }
            
            const result = page.toJSON();
            
            if (userId) {
                const isFollowing = await PageFollower.findOne({
                    where: { page_id: page.id, user_id: userId }
                });
                result.is_following = !!isFollowing;
            }
            
            res.status(200).json({
                success: true,
                data: result
            });
            
        } catch (error) {
            console.error('Erreur getPageBySlug:', error);
            res.status(500).json({ success: false, error: error.message });
        }
    }
    
    // =====================================================
    // MISE À JOUR
    // =====================================================
    
    async updatePage(req, res) {
        const transaction = await sequelize.transaction();
        
        try {
            const { page_id } = req.params;
            const userId = req.user.id;
            const updates = req.body;
            
            const page = await Page.findByPk(page_id, { transaction });
            if (!page) {
                return res.status(404).json({ success: false, error: 'Page non trouvée' });
            }
            
            const isAdmin = await PageAdmin.findOne({
                where: { page_id, user_id: userId },
                transaction
            });
            
            if (!isAdmin) {
                return res.status(403).json({
                    success: false,
                    error: 'Vous n\'êtes pas autorisé à modifier cette page'
                });
            }
            
            const updateData = {};
            
            if (updates.name) {
                updateData.name = updates.name;
                updateData.slug = this.generateSlug(updates.name);
                
                const existingPage = await Page.findOne({
                    where: { slug: updateData.slug, id: { [Op.ne]: page_id } },
                    transaction
                });
                if (existingPage) {
                    return res.status(400).json({
                        success: false,
                        error: 'Une page avec ce nom existe déjà'
                    });
                }
            }
            
            const textFields = ['description', 'category', 'phone', 'email', 'website', 'address', 'city', 'country', 'settings'];
            textFields.forEach(field => {
                if (updates[field] !== undefined) updateData[field] = updates[field];
            });
            
            // Upload nouvelle photo de profil
            if (req.files && req.files.profile_picture && req.files.profile_picture[0]) {
                if (page.profile_picture) {
                    const oldPath = page.profile_picture.split('/').pop();
                    await deleteFromSupabase('social-media', `pages/profiles/${oldPath}`);
                }
                
                const file = req.files.profile_picture[0];
                const fileName = `page_${uuidv4()}_profile.${file.originalname.split('.').pop()}`;
                const { url } = await uploadToSupabase(
                    'social-media', 'pages/profiles', file.buffer, file.mimetype, fileName
                );
                updateData.profile_picture = url;
            }
            
            // Upload nouvelle photo de couverture
            if (req.files && req.files.cover_photo && req.files.cover_photo[0]) {
                if (page.cover_photo) {
                    const oldPath = page.cover_photo.split('/').pop();
                    await deleteFromSupabase('social-media', `pages/covers/${oldPath}`);
                }
                
                const file = req.files.cover_photo[0];
                const fileName = `page_${uuidv4()}_cover.${file.originalname.split('.').pop()}`;
                const { url } = await uploadToSupabase(
                    'social-media', 'pages/covers', file.buffer, file.mimetype, fileName
                );
                updateData.cover_photo = url;
            }
            
            await page.update(updateData, { transaction });
            await transaction.commit();
            
            res.status(200).json({
                success: true,
                message: 'Page mise à jour avec succès',
                data: page
            });
            
        } catch (error) {
            await transaction.rollback();
            console.error('Erreur updatePage:', error);
            res.status(500).json({ success: false, error: error.message });
        }
    }
    
    // =====================================================
    // SUPPRESSION
    // =====================================================
    
    async deletePage(req, res) {
        try {
            const { page_id } = req.params;
            const userId = req.user.id;
            
            const isAdmin = await PageAdmin.findOne({
                where: { page_id, user_id: userId }
            });
            
            if (!isAdmin) {
                return res.status(403).json({
                    success: false,
                    error: 'Vous n\'êtes pas autorisé à supprimer cette page'
                });
            }
            
            await Page.update(
                { is_deleted: true, deleted_at: new Date() },
                { where: { id: page_id } }
            );
            
            res.status(200).json({
                success: true,
                message: 'Page supprimée avec succès'
            });
            
        } catch (error) {
            console.error('Erreur deletePage:', error);
            res.status(500).json({ success: false, error: error.message });
        }
    }
    
    async deletePageFinal(req, res) {
        try {
            const { page_id } = req.params;
            
            if (req.user.role !== 'super_admin') {
                return res.status(403).json({
                    success: false,
                    error: 'Seul un super administrateur peut supprimer définitivement une page'
                });
            }
            
            const page = await Page.findByPk(page_id);
            if (page) {
                if (page.profile_picture) {
                    const path = page.profile_picture.split('/').pop();
                    await deleteFromSupabase('social-media', `pages/profiles/${path}`);
                }
                if (page.cover_photo) {
                    const path = page.cover_photo.split('/').pop();
                    await deleteFromSupabase('social-media', `pages/covers/${path}`);
                }
            }
            
            await Page.destroy({ where: { id: page_id } });
            
            res.status(200).json({
                success: true,
                message: 'Page supprimée définitivement'
            });
            
        } catch (error) {
            console.error('Erreur deletePageFinal:', error);
            res.status(500).json({ success: false, error: error.message });
        }
    }
    
    async restorePage(req, res) {
        try {
            const { page_id } = req.params;
            
            if (req.user.role !== 'super_admin') {
                return res.status(403).json({
                    success: false,
                    error: 'Seul un super administrateur peut restaurer une page'
                });
            }
            
            await Page.update(
                { is_deleted: false, deleted_at: null },
                { where: { id: page_id } }
            );
            
            res.status(200).json({
                success: true,
                message: 'Page restaurée avec succès'
            });
            
        } catch (error) {
            console.error('Erreur restorePage:', error);
            res.status(500).json({ success: false, error: error.message });
        }
    }
    
    // =====================================================
    // INTERACTIONS
    // =====================================================
    
    async followPage(req, res) {
        try {
            const { page_id } = req.params;
            const userId = req.user.id;
            
            // Vérifier si l'utilisateur suit déjà la page
            const existing = await PageFollower.findOne({
                where: { page_id, user_id: userId }
            });
            
            if (existing) {
                return res.status(400).json({
                    success: false,
                    error: 'Vous suivez déjà cette page'
                });
            }
            
            // Ajouter le follower
            await PageFollower.create({ 
                page_id, 
                user_id: userId,
                is_notified: true
            });
            
            // Incrémenter le compteur de followers
            await Page.increment('followers_count', { by: 1, where: { id: page_id } });
            
            // Récupérer la page et l'utilisateur
            const page = await Page.findByPk(page_id);
            const user = await User.findByPk(userId, {
                attributes: ['id', 'first_name', 'last_name', 'avatar_url']
            });
            
            // Préparer le nom de l'utilisateur
            const userName = user ? `${user.first_name} ${user.last_name}`.trim() : 'Quelqu\'un';
            const userAvatar = user?.avatar_url || null;
            
            // Notifier les admins (avec gestion d'erreur)
            const admins = await PageAdmin.findAll({
                where: { page_id },
                include: [{ model: User, as: 'user' }]
            });
            
            // Envoyer les notifications sans bloquer le processus
            for (const admin of admins) {
                if (admin.user_id !== userId) { // Ne pas notifier l'utilisateur lui-même
                    try {
                        await NotificationService.sendSocialNotification(
                            admin.user_id,
                            page_id,
                            'follow',
                            userId,
                            userName,
                            userAvatar,
                            `suit maintenant votre page "${page.name}"`
                        );
                    } catch (notifError) {
                        // Log l'erreur mais continue
                        console.error(`Erreur d'envoi de notification à l'admin ${admin.user_id}:`, notifError.message);
                    }
                }
            }
            
            res.status(200).json({
                success: true,
                message: 'Page suivie avec succès',
                data: {
                    page_id: page.id,
                    page_name: page.name,
                    followers_count: page.followers_count + 1
                }
            });
            
        } catch (error) {
            console.error('Erreur followPage:', error);
            
            // Gérer les erreurs de validation
            if (error.name === 'SequelizeValidationError') {
                return res.status(400).json({
                    success: false,
                    error: error.errors.map(e => e.message).join(', ')
                });
            }
            
            res.status(500).json({ 
                success: false, 
                error: error.message 
            });
        }
    }
    
    async unfollowPage(req, res) {
        try {
            const { page_id } = req.params;
            const userId = req.user.id;
            
            await PageFollower.destroy({
                where: { page_id, user_id: userId }
            });
            
            await Page.decrement('followers_count', { by: 1, where: { id: page_id } });
            
            res.status(200).json({
                success: true,
                message: 'Page non suivie avec succès'
            });
            
        } catch (error) {
            console.error('Erreur unfollowPage:', error);
            res.status(500).json({ success: false, error: error.message });
        }
    }
    
    async checkFollowing(req, res) {
        try {
            const { page_id } = req.params;
            const userId = req.user.id;
            
            const isFollowing = await PageFollower.findOne({
                where: { page_id, user_id: userId }
            });
            
            res.status(200).json({
                success: true,
                data: { is_following: !!isFollowing }
            });
            
        } catch (error) {
            console.error('Erreur checkFollowing:', error);
            res.status(500).json({ success: false, error: error.message });
        }
    }
    
    async getFollowers(req, res) {
        try {
            const { page_id } = req.params;
            const { limit = 20, offset = 0 } = req.query;
            
            const followers = await PageFollower.findAndCountAll({
                where: { page_id },
                include: [{ model: User, as: 'user', attributes: ['id', 'first_name', 'avatar_url'] }],
                limit: parseInt(limit),
                offset: parseInt(offset),
                order: [['created_at', 'DESC']]
            });
            
            res.status(200).json({
                success: true,
                data: followers.rows.map(f => f.user),
                pagination: {
                    total: followers.count,
                    limit: parseInt(limit),
                    offset: parseInt(offset),
                    has_more: parseInt(offset) + followers.rows.length < followers.count
                }
            });
            
        } catch (error) {
            console.error('Erreur getFollowers:', error);
            res.status(500).json({ success: false, error: error.message });
        }
    }
    
    async getPageStats(req, res) {
        try {
            const { page_id } = req.params;
            const userId = req.user.id;
            
            const isAdmin = await PageAdmin.findOne({
                where: { page_id, user_id: userId }
            });
            
            if (!isAdmin) {
                return res.status(403).json({
                    success: false,
                    error: 'Seul un administrateur peut voir les statistiques'
                });
            }
            
            const page = await Page.findByPk(page_id);
            
            const postsCount = await Post.count({
                where: { container_type: 'page', container_id: page_id, is_deleted: false }
            });
            
            const postsLast7Days = await Post.count({
                where: {
                    container_type: 'page',
                    container_id: page_id,
                    is_deleted: false,
                    created_at: { [Op.gte]: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) }
                }
            });
            
            const stats = {
                followers_count: page.followers_count,
                posts_count: postsCount,
                stories_count: page.stories_count,
                total_likes: page.total_likes,
                total_views: page.total_views,
                engagement_score: page.engagement_score,
                viral_score: page.viral_score,
                posts_last_7_days: postsLast7Days
            };
            
            res.status(200).json({
                success: true,
                data: stats
            });
            
        } catch (error) {
            console.error('Erreur getPageStats:', error);
            res.status(500).json({ success: false, error: error.message });
        }
    }
    
    // =====================================================
    // ADMINISTRATION
    // =====================================================
    
    async addAdmin(req, res) {
        try {
            const { page_id } = req.params;
            const { user_id, role } = req.body;
            const currentUserId = req.user.id;
            
            const isAdmin = await PageAdmin.findOne({
                where: { page_id, user_id: currentUserId }
            });
            
            if (!isAdmin) {
                return res.status(403).json({
                    success: false,
                    error: 'Vous n\'êtes pas administrateur de cette page'
                });
            }
            
            const existing = await PageAdmin.findOne({
                where: { page_id, user_id }
            });
            
            if (existing) {
                return res.status(400).json({
                    success: false,
                    error: 'Cet utilisateur est déjà administrateur'
                });
            }
            
            const admin = await PageAdmin.create({
                page_id, user_id, role: role || 'admin'
            });
            
            await NotificationService.sendSystemNotification(
                user_id,
                'Vous êtes maintenant administrateur',
                `Vous avez été nommé ${role || 'admin'} de la page`,
                { page_id, role: role || 'admin' }
            );
            
            res.status(201).json({
                success: true,
                message: 'Administrateur ajouté avec succès',
                data: admin
            });
            
        } catch (error) {
            console.error('Erreur addAdmin:', error);
            res.status(500).json({ success: false, error: error.message });
        }
    }
    
    async removeAdmin(req, res) {
        try {
            const { page_id, user_id } = req.params;
            const currentUserId = req.user.id;
            
            const isAdmin = await PageAdmin.findOne({
                where: { page_id, user_id: currentUserId }
            });
            
            if (!isAdmin) {
                return res.status(403).json({
                    success: false,
                    error: 'Vous n\'êtes pas administrateur de cette page'
                });
            }
            
            const adminCount = await PageAdmin.count({ where: { page_id } });
            if (adminCount <= 1) {
                return res.status(400).json({
                    success: false,
                    error: 'Impossible de retirer le dernier administrateur'
                });
            }
            
            await PageAdmin.destroy({
                where: { page_id, user_id }
            });
            
            res.status(200).json({
                success: true,
                message: 'Administrateur retiré avec succès'
            });
            
        } catch (error) {
            console.error('Erreur removeAdmin:', error);
            res.status(500).json({ success: false, error: error.message });
        }
    }
    
    async updateAdminRole(req, res) {
        try {
            const { page_id, user_id } = req.params;
            const { role } = req.body;
            const currentUserId = req.user.id;
            
            const isAdmin = await PageAdmin.findOne({
                where: { page_id, user_id: currentUserId }
            });
            
            if (!isAdmin) {
                return res.status(403).json({
                    success: false,
                    error: 'Vous n\'êtes pas administrateur de cette page'
                });
            }
            
            await PageAdmin.update(
                { role },
                { where: { page_id, user_id } }
            );
            
            res.status(200).json({
                success: true,
                message: 'Rôle mis à jour avec succès'
            });
            
        } catch (error) {
            console.error('Erreur updateAdminRole:', error);
            res.status(500).json({ success: false, error: error.message });
        }
    }
    
    async getAdmins(req, res) {
        try {
            const { page_id } = req.params;
            
            const admins = await PageAdmin.findAll({
                where: { page_id },
                include: [{ model: User, as: 'user', attributes: ['id', 'first_name', 'email', 'avatar_url'] }],
                order: [['role', 'DESC'], ['created_at', 'ASC']]
            });
            
            res.status(200).json({
                success: true,
                data: admins.map(a => ({ ...a.user.toJSON(), role: a.role }))
            });
            
        } catch (error) {
            console.error('Erreur getAdmins:', error);
            res.status(500).json({ success: false, error: error.message });
        }
    }
    
    // =====================================================
    // NOTIFICATIONS
    // =====================================================
    
    async toggleNotifications(req, res) {
        try {
            const { page_id } = req.params;
            const userId = req.user.id;
            const { enabled } = req.body;
            
            await PageFollower.update(
                { is_notified: enabled },
                { where: { page_id, user_id: userId } }
            );
            
            res.status(200).json({
                success: true,
                message: enabled ? 'Notifications activées' : 'Notifications désactivées'
            });
            
        } catch (error) {
            console.error('Erreur toggleNotifications:', error);
            res.status(500).json({ success: false, error: error.message });
        }
    }
    
    // =====================================================
    // RECHERCHE
    // =====================================================
    
    async searchPages(req, res) {
        try {
            const { query } = req.params;
            const { limit = 20, offset = 0 } = req.query;
            
            if (query.length < 2) {
                return res.status(400).json({
                    success: false,
                    error: 'La recherche doit contenir au moins 2 caractères'
                });
            }
            
            const pages = await Page.findAndCountAll({
                where: {
                    [Op.or]: [
                        { name: { [Op.iLike]: `%${query}%` } },
                        { description: { [Op.iLike]: `%${query}%` } }
                    ],
                    is_deleted: false
                },
                order: [
                    ['followers_count', 'DESC'],  // Trie simplement par popularité
                    ['name', 'ASC']
                ],
                limit: parseInt(limit),
                offset: parseInt(offset)
            });
            
            res.status(200).json({
                success: true,
                data: pages.rows,
                pagination: {
                    total: pages.count,
                    limit: parseInt(limit),
                    offset: parseInt(offset),
                    has_more: parseInt(offset) + pages.rows.length < pages.count
                }
            });
            
        } catch (error) {
            console.error('Erreur searchPages:', error);
            res.status(500).json({ success: false, error: error.message });
        }
    }

}

module.exports = new PageController();