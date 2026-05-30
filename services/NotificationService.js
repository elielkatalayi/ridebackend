// backend/services/NotificationService.js
const FcmService = require('./FcmService');

class NotificationService {
  
  // =====================================================
  // NOTIFICATIONS DE POST
  // =====================================================
  
  async notifyNewPost(userId, postId, authorName, containerName, containerType) {
    return await FcmService.sendToUser(userId, {
      title: '📱 Nouveau post',
      body: `${authorName} a publié dans ${containerName}`,
    }, {
      type: 'new_post',
      post_id: postId,
      container_type: containerType,
      container_name: containerName,
      author_name: authorName
    });
  }
  
  async notifyPostLike(userId, postId, likerName, postContent) {
    const preview = postContent?.substring(0, 50) || '';
    return await FcmService.sendToUser(userId, {
      title: '❤️ Nouveau like',
      body: `${likerName} a aimé votre post : "${preview}..."`,
    }, {
      type: 'post_like',
      post_id: postId,
      liker_name: likerName
    });
  }
  
  async notifyPostComment(userId, postId, commenterName, commentPreview, postContent) {
    const preview = commentPreview?.substring(0, 50) || '';
    return await FcmService.sendToUser(userId, {
      title: '💬 Nouveau commentaire',
      body: `${commenterName}: "${preview}..."`,
    }, {
      type: 'post_comment',
      post_id: postId,
      commenter_name: commenterName,
      comment_preview: commentPreview
    });
  }
  
  async notifyMention(userId, postId, mentionerName, contentPreview) {
    const preview = contentPreview?.substring(0, 50) || '';
    return await FcmService.sendToUser(userId, {
      title: '@ Mention',
      body: `${mentionerName} vous a mentionné : "${preview}..."`,
    }, {
      type: 'mention',
      post_id: postId,
      mentioner_name: mentionerName
    });
  }
  
  // =====================================================
  // NOTIFICATIONS DE STORY
  // =====================================================
  
  async notifyNewStory(userId, storyId, pageName, pageId) {
    return await FcmService.sendToUser(userId, {
      title: '📖 Nouvelle story',
      body: `${pageName} a publié une nouvelle story`,
    }, {
      type: 'new_story',
      story_id: storyId,
      page_id: pageId,
      page_name: pageName
    });
  }
  
  async notifyStoryReply(userId, storyId, replierName, replyPreview) {
    const preview = replyPreview?.substring(0, 50) || '';
    return await FcmService.sendToUser(userId, {
      title: '💬 Réponse à votre story',
      body: `${replierName}: "${preview}..."`,
    }, {
      type: 'story_reply',
      story_id: storyId,
      replier_name: replierName
    });
  }
  
  // =====================================================
  // NOTIFICATIONS DE GROUPE
  // =====================================================
  
  async notifyNewGroupPost(groupId, postId, authorName, groupName) {
    // Récupérer tous les membres du groupe (sauf l'auteur)
    const { GroupMember } = require('../models');
    const { Op } = require('sequelize');
    
    const members = await GroupMember.findAll({
      where: { 
        group_id: groupId, 
        status: 'active',
        user_id: { [Op.ne]: authorName._id } // À adapter selon ton modèle
      },
      attributes: ['user_id']
    });
    
    const memberIds = members.map(m => m.user_id);
    
    if (memberIds.length > 0) {
      return await FcmService.sendToMultipleUsers(memberIds, {
        title: `👥 ${groupName}`,
        body: `${authorName} a publié dans le groupe`,
      }, {
        type: 'group_post',
        post_id: postId,
        group_id: groupId,
        group_name: groupName,
        author_name: authorName
      });
    }
    
    return { success: false, reason: 'no_members' };
  }
  
  // =====================================================
  // NOTIFICATIONS DE PAGE
  // =====================================================
  
  async notifyNewPagePost(pageId, postId, authorName, pageName) {
    // Récupérer les followers de la page
    const { PageFollower } = require('../models');
    const { Op } = require('sequelize');
    
    const followers = await PageFollower.findAll({
      where: { page_id: pageId },
      attributes: ['user_id']
    });
    
    const followerIds = followers.map(f => f.user_id);
    
    if (followerIds.length > 0) {
      return await FcmService.sendToMultipleUsers(followerIds, {
        title: `📄 ${pageName}`,
        body: `${authorName} a publié sur la page`,
      }, {
        type: 'page_post',
        post_id: postId,
        page_id: pageId,
        page_name: pageName,
        author_name: authorName
      });
    }
    
    return { success: false, reason: 'no_followers' };
  }
  
  // =====================================================
  // NOTIFICATIONS DE CHAT
  // =====================================================
  
  async notifyNewMessage(userId, chatId, senderName, messagePreview, chatType) {
    return await FcmService.sendToUser(userId, {
      title: `💬 Nouveau message`,
      body: `${senderName}: ${messagePreview?.substring(0, 100) || 'Nouveau message'}`,
    }, {
      type: 'new_message',
      chat_id: chatId,
      chat_type: chatType,
      sender_name: senderName
    });
  }
  
  // =====================================================
  // NOTIFICATIONS DE SUIVI
  // =====================================================
  
  async notifyNewFollower(userId, followerName, followerId) {
    return await FcmService.sendToUser(userId, {
      title: '👤 Nouveau follower',
      body: `${followerName} a commencé à vous suivre`,
    }, {
      type: 'new_follower',
      follower_id: followerId,
      follower_name: followerName
    });
  }
  
  // =====================================================
  // NOTIFICATIONS DE GROUPE D'UTILISATEUR
  // =====================================================
  
  async notifyUserJoinedGroup(adminId, userId, groupName, userName) {
    return await FcmService.sendToUser(adminId, {
      title: `👥 Nouveau membre`,
      body: `${userName} a rejoint ${groupName}`,
    }, {
      type: 'user_joined_group',
      user_id: userId,
      user_name: userName,
      group_name: groupName
    });
  }
  
  // =====================================================
  // NOTIFICATIONS DE DEMANDE
  // =====================================================
  
  async notifyGroupJoinRequest(adminId, userId, groupName, userName) {
    return await FcmService.sendToUser(adminId, {
      title: `📥 Demande d'adhésion`,
      body: `${userName} demande à rejoindre ${groupName}`,
    }, {
      type: 'group_join_request',
      user_id: userId,
      user_name: userName,
      group_name: groupName
    });
  }
  
  async notifyGroupRequestApproved(userId, groupName) {
    return await FcmService.sendToUser(userId, {
      title: '✅ Demande approuvée',
      body: `Votre demande pour rejoindre ${groupName} a été acceptée`,
    }, {
      type: 'group_request_approved',
      group_name: groupName
    });
  }
  
  async notifyGroupRequestRejected(userId, groupName, reason) {
    return await FcmService.sendToUser(userId, {
      title: '❌ Demande refusée',
      body: `Votre demande pour rejoindre ${groupName} a été refusée${reason ? ` : ${reason}` : ''}`,
    }, {
      type: 'group_request_rejected',
      group_name: groupName,
      reason: reason || ''
    });
  }
}

module.exports = new NotificationService();