const groupService = require('../../services/social/groupService');
const { Op } = require('sequelize');  // ← AJOUTEZ CETTE LIGNE
const { Group, GroupMember, User, Post } = require('../../models');  // ← AJOUTEZ AUSSI CECI

class GroupController {
    
    // Créer un groupe
    async createGroup(req, res) {
        try {
            const userId = req.user.id;
            const groupData = req.body;
            const coverFile = req.file;
            
            const group = await groupService.createGroup(userId, groupData, coverFile);
            
            res.status(201).json({
                success: true,
                message: 'Groupe créé avec succès',
                data: group
            });
            
        } catch (error) {
            console.error('Erreur createGroup:', error);
            res.status(500).json({
                success: false,
                error: error.message
            });
        }
    }
    
    // Récupérer tous les groupes
    async getAllGroups(req, res) {
        try {
            const { limit = 20, offset = 0, category, sort = 'newest' } = req.query;
            
            const where = { is_deleted: false, privacy_type: { [Op.ne]: 'secret' } };
            if (category) where.category = category;
            
            let order = [];
            switch (sort) {
                case 'newest':
                    order = [['created_at', 'DESC']];
                    break;
                case 'popular':
                    order = [['members_count', 'DESC']];
                    break;
                case 'most_active':
                    order = [['posts_count', 'DESC']];
                    break;
                default:
                    order = [['created_at', 'DESC']];
            }
            
            const groups = await Group.findAndCountAll({
                where,
                order,
                limit: parseInt(limit),
                offset: parseInt(offset)
            });
            
            res.status(200).json({
                success: true,
                data: groups.rows,
                pagination: {
                    total: groups.count,
                    limit: parseInt(limit),
                    offset: parseInt(offset),
                    has_more: parseInt(offset) + groups.rows.length < groups.count
                }
            });
            
        } catch (error) {
            console.error('Erreur getAllGroups:', error);
            res.status(500).json({
                success: false,
                error: error.message
            });
        }
    }
    
    // Récupérer les groupes suggérés
    async getSuggestedGroups(req, res) {
        try {
            const userId = req.user.id;
            const { limit = 10 } = req.query;
            
            const groups = await groupService.getSuggestedGroups(userId, parseInt(limit));
            
            res.status(200).json({
                success: true,
                data: groups,
                count: groups.length
            });
            
        } catch (error) {
            console.error('Erreur getSuggestedGroups:', error);
            res.status(500).json({
                success: false,
                error: error.message
            });
        }
    }
    
    // Récupérer les groupes de l'utilisateur
    async getMyGroups(req, res) {
        try {
            const userId = req.user.id;
            const { limit = 20, offset = 0 } = req.query;
            
            const memberships = await GroupMember.findAndCountAll({
                where: { user_id: userId, status: 'active' },
                include: [
                    { model: Group, as: 'group', where: { is_deleted: false } }
                ],
                limit: parseInt(limit),
                offset: parseInt(offset)
            });
            
            const groups = memberships.rows.map(m => ({
                ...m.group.toJSON(),
                role: m.role,
                joined_at: m.joined_at
            }));
            
            res.status(200).json({
                success: true,
                data: groups,
                pagination: {
                    total: memberships.count,
                    limit: parseInt(limit),
                    offset: parseInt(offset),
                    has_more: parseInt(offset) + groups.length < memberships.count
                }
            });
            
        } catch (error) {
            console.error('Erreur getMyGroups:', error);
            res.status(500).json({
                success: false,
                error: error.message
            });
        }
    }
    
    // Récupérer un groupe par ID
    async getGroupById(req, res) {
        try {
            const { group_id } = req.params;
            const userId = req.user?.id;
            
            const group = await groupService.getGroupById(group_id, userId);
            
            if (!group) {
                return res.status(404).json({
                    success: false,
                    error: 'Groupe non trouvé'
                });
            }
            
            res.status(200).json({
                success: true,
                data: group
            });
            
        } catch (error) {
            console.error('Erreur getGroupById:', error);
            res.status(500).json({
                success: false,
                error: error.message
            });
        }
    }
    
    // Récupérer un groupe par slug
    async getGroupBySlug(req, res) {
        try {
            const { slug } = req.params;
            const userId = req.user?.id;
            
            const group = await groupService.getGroupBySlug(slug, userId);
            
            if (!group) {
                return res.status(404).json({
                    success: false,
                    error: 'Groupe non trouvé'
                });
            }
            
            res.status(200).json({
                success: true,
                data: group
            });
            
        } catch (error) {
            console.error('Erreur getGroupBySlug:', error);
            res.status(500).json({
                success: false,
                error: error.message
            });
        }
    }
    
    // Mettre à jour un groupe
    async updateGroup(req, res) {
        try {
            const { group_id } = req.params;
            const userId = req.user.id;
            const updateData = req.body;
            const coverFile = req.file;
            
            const group = await groupService.updateGroup(group_id, userId, updateData, coverFile);
            
            res.status(200).json({
                success: true,
                message: 'Groupe mis à jour avec succès',
                data: group
            });
            
        } catch (error) {
            console.error('Erreur updateGroup:', error);
            res.status(500).json({
                success: false,
                error: error.message
            });
        }
    }
    
    // Supprimer un groupe
    async deleteGroup(req, res) {
        try {
            const { group_id } = req.params;
            const userId = req.user.id;
            
            await groupService.deleteGroup(group_id, userId);
            
            res.status(200).json({
                success: true,
                message: 'Groupe supprimé avec succès'
            });
            
        } catch (error) {
            console.error('Erreur deleteGroup:', error);
            res.status(500).json({
                success: false,
                error: error.message
            });
        }
    }
    
    // Supprimer définitivement un groupe
    async deleteGroupFinal(req, res) {
        try {
            const { group_id } = req.params;
            
            // Vérifier si super admin
            if (req.user.role !== 'super_admin') {
                return res.status(403).json({
                    success: false,
                    error: 'Seul un super administrateur peut supprimer définitivement un groupe'
                });
            }
            
            await Group.destroy({ where: { id: group_id } });
            
            res.status(200).json({
                success: true,
                message: 'Groupe supprimé définitivement'
            });
            
        } catch (error) {
            console.error('Erreur deleteGroupFinal:', error);
            res.status(500).json({
                success: false,
                error: error.message
            });
        }
    }
    
    // Restaurer un groupe
    async restoreGroup(req, res) {
        try {
            const { group_id } = req.params;
            
            if (req.user.role !== 'super_admin') {
                return res.status(403).json({
                    success: false,
                    error: 'Seul un super administrateur peut restaurer un groupe'
                });
            }
            
            await Group.update(
                { is_deleted: false, deleted_at: null },
                { where: { id: group_id } }
            );
            
            res.status(200).json({
                success: true,
                message: 'Groupe restauré avec succès'
            });
            
        } catch (error) {
            console.error('Erreur restoreGroup:', error);
            res.status(500).json({
                success: false,
                error: error.message
            });
        }
    }
    
    // Rejoindre un groupe
    async joinGroup(req, res) {
        try {
            const { group_id } = req.params;
            const userId = req.user.id;
            
            const result = await groupService.joinGroup(group_id, userId);
            
            res.status(200).json({
                success: true,
                message: result.message,
                data: { status: result.status }
            });
            
        } catch (error) {
            console.error('Erreur joinGroup:', error);
            res.status(500).json({
                success: false,
                error: error.message
            });
        }
    }
    
    // Quitter un groupe
    async leaveGroup(req, res) {
        try {
            const { group_id } = req.params;
            const userId = req.user.id;
            
            await groupService.leaveGroup(group_id, userId);
            
            res.status(200).json({
                success: true,
                message: 'Vous avez quitté le groupe'
            });
            
        } catch (error) {
            console.error('Erreur leaveGroup:', error);
            res.status(500).json({
                success: false,
                error: error.message
            });
        }
    }
    
    // Vérifier si membre
    async checkMembership(req, res) {
        try {
            const { group_id } = req.params;
            const userId = req.user.id;
            
            const membership = await GroupMember.findOne({
                where: { group_id, user_id: userId }
            });
            
            res.status(200).json({
                success: true,
                data: {
                    is_member: !!membership && membership.status === 'active',
                    role: membership?.role || null,
                    status: membership?.status || null
                }
            });
            
        } catch (error) {
            console.error('Erreur checkMembership:', error);
            res.status(500).json({
                success: false,
                error: error.message
            });
        }
    }
    
    // Obtenir les membres
    async getMembers(req, res) {
        try {
            const { group_id } = req.params;
            const { limit = 20, offset = 0, role } = req.query;
            
            const members = await groupService.getMembers(
                group_id,
                parseInt(limit),
                parseInt(offset),
                role
            );
            
            const total = await GroupMember.count({
                where: { group_id, status: 'active', ...(role && { role }) }
            });
            
            res.status(200).json({
                success: true,
                data: members,
                pagination: {
                    total,
                    limit: parseInt(limit),
                    offset: parseInt(offset),
                    has_more: parseInt(offset) + members.length < total
                }
            });
            
        } catch (error) {
            console.error('Erreur getMembers:', error);
            res.status(500).json({
                success: false,
                error: error.message
            });
        }
    }
    
    // Obtenir les membres en attente
    async getPendingMembers(req, res) {
        try {
            const { group_id } = req.params;
            const userId = req.user.id;
            
            // Vérifier si admin
            const isAdmin = await GroupMember.findOne({
                where: { group_id, user_id: userId, role: 'admin' }
            });
            
            if (!isAdmin) {
                return res.status(403).json({
                    success: false,
                    error: 'Seul un administrateur peut voir les demandes en attente'
                });
            }
            
            const members = await GroupMember.findAll({
                where: { group_id, status: 'pending' },
                include: [
                    { model: User, as: 'user', attributes: ['id', 'first_name', 'email', 'avatar_url'] }
                ],
                order: [['joined_at', 'ASC']]
            });
            
            res.status(200).json({
                success: true,
                data: members.map(m => ({
                    ...m.user.toJSON(),
                    requested_at: m.joined_at
                }))
            });
            
        } catch (error) {
            console.error('Erreur getPendingMembers:', error);
            res.status(500).json({
                success: false,
                error: error.message
            });
        }
    }
    
    // Approuver un membre
    async approveMember(req, res) {
        try {
            const { group_id, user_id } = req.params;
            const adminId = req.user.id;
            
            await groupService.approveMember(group_id, adminId, user_id);
            
            res.status(200).json({
                success: true,
                message: 'Membre approuvé avec succès'
            });
            
        } catch (error) {
            console.error('Erreur approveMember:', error);
            res.status(500).json({
                success: false,
                error: error.message
            });
        }
    }
    
    // Rejeter un membre
    async rejectMember(req, res) {
        try {
            const { group_id, user_id } = req.params;
            const adminId = req.user.id;
            
            const isAdmin = await GroupMember.findOne({
                where: { group_id, user_id: adminId, role: 'admin' }
            });
            
            if (!isAdmin) {
                return res.status(403).json({
                    success: false,
                    error: 'Seul un administrateur peut rejeter les demandes'
                });
            }
            
            const membership = await GroupMember.findOne({
                where: { group_id, user_id, status: 'pending' }
            });
            
            if (!membership) {
                return res.status(404).json({
                    success: false,
                    error: 'Demande non trouvée'
                });
            }
            
            await membership.destroy();
            
            const group = await Group.findByPk(group_id);
            await group.decrement('pending_members_count', { by: 1 });
            
            res.status(200).json({
                success: true,
                message: 'Demande rejetée'
            });
            
        } catch (error) {
            console.error('Erreur rejectMember:', error);
            res.status(500).json({
                success: false,
                error: error.message
            });
        }
    }
    
    // Retirer un membre
    async removeMember(req, res) {
        try {
            const { group_id, user_id } = req.params;
            const adminId = req.user.id;
            
            const isAdmin = await GroupMember.findOne({
                where: { group_id, user_id: adminId, role: 'admin' }
            });
            
            if (!isAdmin) {
                return res.status(403).json({
                    success: false,
                    error: 'Seul un administrateur peut retirer des membres'
                });
            }
            
            const membership = await GroupMember.findOne({
                where: { group_id, user_id, status: 'active' }
            });
            
            if (!membership) {
                return res.status(404).json({
                    success: false,
                    error: 'Membre non trouvé'
                });
            }
            
            if (membership.role === 'admin') {
                const adminCount = await GroupMember.count({
                    where: { group_id, role: 'admin', status: 'active' }
                });
                
                if (adminCount <= 1) {
                    return res.status(400).json({
                        success: false,
                        error: 'Impossible de retirer le dernier administrateur'
                    });
                }
            }
            
            await membership.destroy();
            
            const group = await Group.findByPk(group_id);
            await group.decrement('members_count', { by: 1 });
            
            res.status(200).json({
                success: true,
                message: 'Membre retiré avec succès'
            });
            
        } catch (error) {
            console.error('Erreur removeMember:', error);
            res.status(500).json({
                success: false,
                error: error.message
            });
        }
    }
    
    // Modifier le rôle d'un membre
    async updateMemberRole(req, res) {
        try {
            const { group_id, user_id } = req.params;
            const { role } = req.body;
            const adminId = req.user.id;
            
            const isAdmin = await GroupMember.findOne({
                where: { group_id, user_id: adminId, role: 'admin' }
            });
            
            if (!isAdmin) {
                return res.status(403).json({
                    success: false,
                    error: 'Seul un administrateur peut modifier les rôles'
                });
            }
            
            const membership = await GroupMember.findOne({
                where: { group_id, user_id, status: 'active' }
            });
            
            if (!membership) {
                return res.status(404).json({
                    success: false,
                    error: 'Membre non trouvé'
                });
            }
            
            membership.role = role;
            await membership.save();
            
            res.status(200).json({
                success: true,
                message: 'Rôle mis à jour avec succès',
                data: { role: membership.role }
            });
            
        } catch (error) {
            console.error('Erreur updateMemberRole:', error);
            res.status(500).json({
                success: false,
                error: error.message
            });
        }
    }
    
    // Obtenir les administrateurs
    async getAdmins(req, res) {
        try {
            const { group_id } = req.params;
            
            const admins = await groupService.getAdmins(group_id);
            
            res.status(200).json({
                success: true,
                data: admins
            });
            
        } catch (error) {
            console.error('Erreur getAdmins:', error);
            res.status(500).json({
                success: false,
                error: error.message
            });
        }
    }
    
    // Obtenir les statistiques
    async getGroupStats(req, res) {
        try {
            const { group_id } = req.params;
            const userId = req.user.id;
            
            const isAdmin = await GroupMember.findOne({
                where: { group_id, user_id: userId, role: 'admin' }
            });
            
            if (!isAdmin) {
                return res.status(403).json({
                    success: false,
                    error: 'Seul un administrateur peut voir les statistiques'
                });
            }
            
            const group = await Group.findByPk(group_id);
            
            const postsCount = await Post.count({
                where: { container_type: 'group', container_id: group_id, is_deleted: false }
            });
            
            const postsLast7Days = await Post.count({
                where: {
                    container_type: 'group',
                    container_id: group_id,
                    is_deleted: false,
                    created_at: { [Op.gte]: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) }
                }
            });
            
            const stats = {
                members_count: group.members_count,
                posts_count: postsCount,
                pending_members_count: group.pending_members_count,
                total_likes: group.total_likes,
                engagement_score: group.engagement_score,
                posts_last_7_days: postsLast7Days
            };
            
            res.status(200).json({
                success: true,
                data: stats
            });
            
        } catch (error) {
            console.error('Erreur getGroupStats:', error);
            res.status(500).json({
                success: false,
                error: error.message
            });
        }
    }
    
    // Rechercher des groupes
    async searchGroups(req, res) {
        try {
            const { query } = req.params;
            const { limit = 20, offset = 0 } = req.query;
            
            if (query.length < 2) {
                return res.status(400).json({
                    success: false,
                    error: 'La recherche doit contenir au moins 2 caractères'
                });
            }
            
            const groups = await groupService.searchGroups(query, parseInt(limit), parseInt(offset));
            
            res.status(200).json({
                success: true,
                data: groups,
                pagination: {
                    limit: parseInt(limit),
                    offset: parseInt(offset),
                    has_more: groups.length === parseInt(limit)
                }
            });
            
        } catch (error) {
            console.error('Erreur searchGroups:', error);
            res.status(500).json({
                success: false,
                error: error.message
            });
        }
    }

    // Dans GroupController.js, ajoutez cette méthode
async addMember(req, res) {
    try {
        const { group_id } = req.params;
        const { user_id, role } = req.body;
        const adminId = req.user.id;
        
        const result = await groupService.addMemberByAdmin(
            group_id, 
            adminId, 
            user_id, 
            role || 'member'
        );
        
        res.status(200).json({
            success: true,
            message: result.message,
            data: { status: result.status }
        });
        
    } catch (error) {
        console.error('Erreur addMember:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
}
}

module.exports = new GroupController();