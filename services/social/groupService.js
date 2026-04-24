const { sequelize } = require('../../config/database');
const { Group, GroupMember, User } = require('../../models');
const { uploadToSupabase, deleteFromSupabase } = require('../../utils/storage');
const NotificationService = require('../notification/NotificationService');
const { v4: uuidv4 } = require('uuid');
const { Op } = require('sequelize');

class GroupService {
    
    // Générer un slug à partir du nom
    generateSlug(name) {
        return name
            .toLowerCase()
            .normalize('NFD')
            .replace(/[\u0300-\u036f]/g, '')
            .replace(/[^a-z0-9]+/g, '-')
            .replace(/^-|-$/g, '');
    }
    
    // Créer un groupe
    async createGroup(userId, groupData, coverFile = null) {
        const transaction = await sequelize.transaction();
        
        try {
            const slug = this.generateSlug(groupData.name);
            
            // Vérifier si le slug existe déjà
            const existingGroup = await Group.findOne({ where: { slug }, transaction });
            if (existingGroup) {
                throw new Error('Un groupe avec ce nom existe déjà');
            }
            
            let cover_image = null;
            
            // Upload de l'image de couverture
            if (coverFile) {
                const fileName = `group_${uuidv4()}_cover.${coverFile.originalname.split('.').pop()}`;
                const { url } = await uploadToSupabase(
                    'social-media',
                    'groups/covers',
                    coverFile.buffer,
                    coverFile.mimetype,
                    fileName
                );
                cover_image = url;
            }
            
            // Créer le groupe
            const group = await Group.create({
                name: groupData.name,
                slug,
                description: groupData.description,
                category: groupData.category,
                privacy_type: groupData.privacy_type || 'public',
                join_type: groupData.join_type || 'free',
                cover_image,
                created_by: userId,
                settings: groupData.settings || {}
            }, { transaction });
            
            // Ajouter le créateur comme admin
            await GroupMember.create({
                group_id: group.id,
                user_id: userId,
                role: 'admin',
                status: 'active'
            }, { transaction });
            
            await transaction.commit();
            
            // Notification
            await NotificationService.sendSystemNotification(
                userId,
                'Groupe créé avec succès',
                `Votre groupe "${group.name}" a été créé. Invitez des membres à rejoindre !`,
                { group_id: group.id, group_name: group.name }
            );
            
            return group;
            
        } catch (error) {
            await transaction.rollback();
            throw error;
        }
    }
    
    // Récupérer un groupe par ID
    async getGroupById(groupId, userId = null) {
        const group = await Group.findByPk(groupId, {
            include: [
                { model: User, as: 'creator', attributes: ['id', 'first_name', 'avatar_url'] }
            ]
        });
        
        if (!group) return null;
        
        const result = group.toJSON();
        
        if (userId) {
            const membership = await GroupMember.findOne({
                where: { group_id: groupId, user_id: userId }
            });
            result.is_member = !!membership;
            result.is_admin = membership?.role === 'admin';
            result.member_role = membership?.role || null;
            result.member_status = membership?.status || null;
        }
        
        return result;
    }
    
    // Récupérer un groupe par slug
    async getGroupBySlug(slug, userId = null) {
        const group = await Group.findOne({
            where: { slug, is_deleted: false },
            include: [
                { model: User, as: 'creator', attributes: ['id', 'first_name', 'avatar_url'] }
            ]
        });
        
        if (!group) return null;
        
        return this.getGroupById(group.id, userId);
    }
    
    // Mettre à jour un groupe
    async updateGroup(groupId, userId, updateData, coverFile = null) {
        const transaction = await sequelize.transaction();
        
        try {
            const group = await Group.findByPk(groupId, { transaction });
            if (!group) throw new Error('Groupe non trouvé');
            
            // Vérifier si l'utilisateur est admin
            const isAdmin = await GroupMember.findOne({
                where: { group_id: groupId, user_id: userId, role: 'admin' },
                transaction
            });
            
            if (!isAdmin) throw new Error('Vous n\'êtes pas autorisé à modifier ce groupe');
            
            // Mise à jour du slug si le nom change
            if (updateData.name && updateData.name !== group.name) {
                updateData.slug = this.generateSlug(updateData.name);
                
                const existingGroup = await Group.findOne({
                    where: { slug: updateData.slug, id: { [Op.ne]: groupId } },
                    transaction
                });
                if (existingGroup) throw new Error('Un groupe avec ce nom existe déjà');
            }
            
            // Upload nouvelle image de couverture
            if (coverFile) {
                if (group.cover_image) {
                    const oldPath = group.cover_image.split('/').pop();
                    await deleteFromSupabase('social-media', `groups/covers/${oldPath}`);
                }
                
                const fileName = `group_${uuidv4()}_cover.${coverFile.originalname.split('.').pop()}`;
                const { url } = await uploadToSupabase(
                    'social-media',
                    'groups/covers',
                    coverFile.buffer,
                    coverFile.mimetype,
                    fileName
                );
                updateData.cover_image = url;
            }
            
            await group.update(updateData, { transaction });
            
            await transaction.commit();
            return group;
            
        } catch (error) {
            await transaction.rollback();
            throw error;
        }
    }
    
    // Supprimer un groupe (soft delete)
    async deleteGroup(groupId, userId) {
        const transaction = await sequelize.transaction();
        
        try {
            const isAdmin = await GroupMember.findOne({
                where: { group_id: groupId, user_id: userId, role: 'admin' },
                transaction
            });
            
            if (!isAdmin) throw new Error('Vous n\'êtes pas autorisé à supprimer ce groupe');
            
            await Group.update(
                { is_deleted: true, deleted_at: new Date() },
                { where: { id: groupId }, transaction }
            );
            
            await transaction.commit();
            return true;
            
        } catch (error) {
            await transaction.rollback();
            throw error;
        }
    }
    
    // Rejoindre un groupe
    async joinGroup(groupId, userId) {
        const transaction = await sequelize.transaction();
        
        try {
            const group = await Group.findByPk(groupId, { transaction });
            if (!group) throw new Error('Groupe non trouvé');
            
            const existing = await GroupMember.findOne({
                where: { group_id: groupId, user_id: userId },
                transaction
            });
            
            if (existing) {
                if (existing.status === 'active') {
                    throw new Error('Vous êtes déjà membre de ce groupe');
                }
                if (existing.status === 'pending') {
                    throw new Error('Votre demande est déjà en attente');
                }
            }
            
            let status = 'active';
            let message = 'Vous avez rejoint le groupe';
            
            if (group.join_type === 'approval') {
                status = 'pending';
                message = 'Demande d\'adhésion envoyée. En attente d\'approbation.';
            }
            
            if (group.privacy_type === 'secret') {
                throw new Error('Ce groupe est secret. Vous devez être invité pour rejoindre.');
            }
            
            await GroupMember.create({
                group_id: groupId,
                user_id: userId,
                role: 'member',
                status
            }, { transaction });
            
            if (status === 'active') {
                await group.increment('members_count', { by: 1, transaction });
            } else {
                await group.increment('pending_members_count', { by: 1, transaction });
            }
            
            await transaction.commit();
            return { status, message };
            
        } catch (error) {
            await transaction.rollback();
            throw error;
        }
    }
    
    // Quitter un groupe
    async leaveGroup(groupId, userId) {
        const transaction = await sequelize.transaction();
        
        try {
            const membership = await GroupMember.findOne({
                where: { group_id: groupId, user_id: userId },
                transaction
            });
            
            if (!membership) throw new Error('Vous n\'êtes pas membre de ce groupe');
            
            if (membership.role === 'admin') {
                const adminCount = await GroupMember.count({
                    where: { group_id: groupId, role: 'admin', status: 'active' },
                    transaction
                });
                
                if (adminCount <= 1) {
                    throw new Error('Vous êtes le dernier administrateur. Nommez un autre admin avant de quitter.');
                }
            }
            
            await membership.destroy({ transaction });
            
            const group = await Group.findByPk(groupId, { transaction });
            await group.decrement('members_count', { by: 1, transaction });
            
            await transaction.commit();
            return true;
            
        } catch (error) {
            await transaction.rollback();
            throw error;
        }
    }
    
    // Approuver un membre
    async approveMember(groupId, adminId, memberId) {
        const transaction = await sequelize.transaction();
        
        try {
            const isAdmin = await GroupMember.findOne({
                where: { group_id: groupId, user_id: adminId, role: 'admin' },
                transaction
            });
            
            if (!isAdmin) throw new Error('Seul un administrateur peut approuver les membres');
            
            const membership = await GroupMember.findOne({
                where: { group_id: groupId, user_id: memberId, status: 'pending' },
                transaction
            });
            
            if (!membership) throw new Error('Demande non trouvée');
            
            membership.status = 'active';
            await membership.save({ transaction });
            
            const group = await Group.findByPk(groupId, { transaction });
            await group.increment('members_count', { by: 1, transaction });
            await group.decrement('pending_members_count', { by: 1, transaction });
            
            await transaction.commit();
            
            // Notifier le membre
            await NotificationService.sendSystemNotification(
                memberId,
                'Demande d\'adhésion approuvée',
                `Votre demande pour rejoindre le groupe "${group.name}" a été approuvée`,
                { group_id: groupId, group_name: group.name }
            );
            
            return membership;
            
        } catch (error) {
            await transaction.rollback();
            throw error;
        }
    }
    
    // Obtenir les membres d'un groupe
    async getMembers(groupId, limit = 20, offset = 0, role = null) {
        const where = { group_id: groupId, status: 'active' };
        if (role) where.role = role;
        
        const members = await GroupMember.findAll({
            where,
            include: [
                { model: User, as: 'user', attributes: ['id', 'first_name', 'email', 'avatar_url'] }
            ],
            order: [
                ['role', 'DESC'],
                ['joined_at', 'ASC']
            ],
            limit,
            offset
        });
        
        return members.map(m => ({
            ...m.user.toJSON(),
            role: m.role,
            joined_at: m.joined_at
        }));
    }
    
    // Obtenir les administrateurs
    async getAdmins(groupId) {
        const admins = await GroupMember.findAll({
            where: { group_id: groupId, role: 'admin', status: 'active' },
            include: [
                { model: User, as: 'user', attributes: ['id', 'first_name', 'email', 'avatar_url'] }
            ],
            order: [['joined_at', 'ASC']]
        });
        
        return admins.map(a => ({
            ...a.user.toJSON(),
            role: a.role,
            joined_at: a.joined_at
        }));
    }
    
    // Obtenir les groupes suggérés
    async getSuggestedGroups(userId, limit = 10) {
        const userGroups = await GroupMember.findAll({
            where: { user_id: userId },
            attributes: ['group_id']
        });
        
        const excludeIds = userGroups.map(g => g.group_id);
        
        const groups = await Group.findAll({
            where: {
                id: { [Op.notIn]: excludeIds },
                is_deleted: false,
                privacy_type: { [Op.ne]: 'secret' }
            },
            order: [
                ['members_count', 'DESC'],
                ['engagement_score', 'DESC']
            ],
            limit
        });
        
        return groups;
    }
    
    // Rechercher des groupes
    async searchGroups(query, limit = 20, offset = 0) {
        const groups = await Group.findAll({
            where: {
                [Op.or]: [
                    { name: { [Op.iLike]: `%${query}%` } },
                    { description: { [Op.iLike]: `%${query}%` } }
                ],
                is_deleted: false,
                privacy_type: { [Op.ne]: 'secret' }
            },
            order: [
                // Correction : utilisez sequelize.literal pour la priorité des noms
                [sequelize.literal(`CASE WHEN name ILIKE '${query}%' THEN 1 WHEN name ILIKE '%${query}%' THEN 2 ELSE 3 END`), 'ASC'],
                ['members_count', 'DESC']
            ],
            limit,
            offset
        });
        
        return groups;
    }

    // Dans GroupService.js, ajoutez cette méthode
async addMemberByAdmin(groupId, adminId, memberId, role = 'member') {
    const transaction = await sequelize.transaction();
    
    try {
        // Vérifier si l'admin est bien admin du groupe
        const isAdmin = await GroupMember.findOne({
            where: { group_id: groupId, user_id: adminId, role: 'admin' },
            transaction
        });
        
        if (!isAdmin) {
            throw new Error('Seul un administrateur peut ajouter des membres');
        }
        
        // Vérifier si le groupe existe
        const group = await Group.findByPk(groupId, { transaction });
        if (!group) {
            throw new Error('Groupe non trouvé');
        }
        
        // Vérifier si l'utilisateur existe
        const user = await User.findByPk(memberId, { transaction });
        if (!user) {
            throw new Error('Utilisateur non trouvé');
        }
        
        // Vérifier si l'utilisateur est déjà membre
        const existing = await GroupMember.findOne({
            where: { group_id: groupId, user_id: memberId },
            transaction
        });
        
        if (existing) {
            if (existing.status === 'active') {
                throw new Error('Cet utilisateur est déjà membre du groupe');
            }
            if (existing.status === 'pending') {
                // Si en attente, on peut l'approuver directement
                existing.status = 'active';
                existing.role = role;
                await existing.save({ transaction });
                
                await group.increment('members_count', { by: 1, transaction });
                await group.decrement('pending_members_count', { by: 1, transaction });
                
                await transaction.commit();
                
                return { 
                    message: 'Membre approuvé et ajouté avec succès',
                    status: 'approved'
                };
            }
        }
        
        // Ajouter le membre directement (sans passer par la file d'attente)
        await GroupMember.create({
            group_id: groupId,
            user_id: memberId,
            role: role,
            status: 'active'
        }, { transaction });
        
        // Incrémenter le compteur de membres
        await group.increment('members_count', { by: 1, transaction });
        
        await transaction.commit();
        
        // Envoyer une notification au nouveau membre
        await NotificationService.sendSystemNotification(
            memberId,
            'Ajouté à un groupe',
            `Vous avez été ajouté au groupe "${group.name}" par un administrateur`,
            { group_id: groupId, group_name: group.name }
        );
        
        return { 
            message: 'Membre ajouté avec succès',
            status: 'added'
        };
        
    } catch (error) {
        await transaction.rollback();
        throw error;
    }
}
}

module.exports = new GroupService();