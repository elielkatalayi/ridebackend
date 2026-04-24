const SocketService = require('../../services/notification/SocketService');

class SocialHandler {
  constructor(io, socket) {
    this.io = io;
    this.socket = socket;
    this.userId = socket.userId;
  }

  register() {
    this.socket.on('social:post:like', this.handlePostLike.bind(this));
    this.socket.on('social:post:comment', this.handlePostComment.bind(this));
    this.socket.on('social:post:share', this.handlePostShare.bind(this));
    this.socket.on('social:comment:like', this.handleCommentLike.bind(this));
    this.socket.on('social:comment:reply', this.handleCommentReply.bind(this));
    this.socket.on('social:follow', this.handleFollow.bind(this));
    this.socket.on('social:unfollow', this.handleUnfollow.bind(this));
  }

  handlePostLike(data) {
    const { postId, postOwnerId, liked } = data;
    
    if (postOwnerId !== this.userId) {
      SocketService.sendToUser(postOwnerId, 'social:post:like:update', {
        postId,
        userId: this.userId,
        liked,
        timestamp: new Date()
      });
    }
  }

  handlePostComment(data) {
    const { postId, postOwnerId, commentId, comment, media } = data;
    
    if (postOwnerId !== this.userId) {
      SocketService.sendToUser(postOwnerId, 'social:post:comment:new', {
        postId,
        commentId,
        userId: this.userId,
        comment: comment?.substring(0, 100),
        media,
        timestamp: new Date()
      });
    }
    
    // Notifier les mentions dans le commentaire
    if (data.mentions && data.mentions.length > 0) {
      data.mentions.forEach(mentionId => {
        if (mentionId !== this.userId && mentionId !== postOwnerId) {
          SocketService.sendToUser(mentionId, 'social:mention', {
            postId,
            commentId,
            mentionedBy: this.userId,
            comment: comment?.substring(0, 100),
            timestamp: new Date()
          });
        }
      });
    }
  }

  handlePostShare(data) {
    const { postId, postOwnerId } = data;
    
    if (postOwnerId !== this.userId) {
      SocketService.sendToUser(postOwnerId, 'social:post:share', {
        postId,
        userId: this.userId,
        timestamp: new Date()
      });
    }
  }

  handleCommentLike(data) {
    const { commentId, commentOwnerId, liked } = data;
    
    if (commentOwnerId !== this.userId) {
      SocketService.sendToUser(commentOwnerId, 'social:comment:like:update', {
        commentId,
        userId: this.userId,
        liked,
        timestamp: new Date()
      });
    }
  }

  handleCommentReply(data) {
    const { commentId, commentOwnerId, replyId, reply, media } = data;
    
    if (commentOwnerId !== this.userId) {
      SocketService.sendToUser(commentOwnerId, 'social:comment:reply:new', {
        commentId,
        replyId,
        userId: this.userId,
        reply: reply?.substring(0, 100),
        media,
        timestamp: new Date()
      });
    }
  }

  handleFollow(data) {
    const { targetUserId, follow } = data;
    
    SocketService.sendToUser(targetUserId, 'social:follow:update', {
      userId: this.userId,
      follow,
      timestamp: new Date()
    });
  }

  handleUnfollow(data) {
    const { targetUserId } = data;
    
    SocketService.sendToUser(targetUserId, 'social:follow:update', {
      userId: this.userId,
      follow: false,
      timestamp: new Date()
    });
  }
}

module.exports = SocialHandler;