const SocketService = require('../../services/notification/SocketService');

class StoryHandler {
  constructor(io, socket) {
    this.io = io;
    this.socket = socket;
    this.userId = socket.userId;
  }

  register() {
    this.socket.on('story:view', this.handleStoryView.bind(this));
    this.socket.on('story:reaction', this.handleStoryReaction.bind(this));
    this.socket.on('story:comment', this.handleStoryComment.bind(this));
    this.socket.on('story:reply', this.handleStoryReply.bind(this));
  }

  handleStoryView(data) {
    const { storyId, storyOwnerId } = data;
    
    if (storyOwnerId !== this.userId) {
      SocketService.sendToUser(storyOwnerId, 'story:viewed', {
        storyId,
        viewerId: this.userId,
        timestamp: new Date()
      });
    }
  }

  handleStoryReaction(data) {
    const { storyId, storyOwnerId, reaction } = data;
    
    if (storyOwnerId !== this.userId) {
      SocketService.sendToUser(storyOwnerId, 'story:reaction', {
        storyId,
        userId: this.userId,
        reaction,
        timestamp: new Date()
      });
    }
  }

  handleStoryComment(data) {
    const { storyId, storyOwnerId, commentId, comment, media } = data;
    
    if (storyOwnerId !== this.userId) {
      SocketService.sendToUser(storyOwnerId, 'story:comment:new', {
        storyId,
        commentId,
        userId: this.userId,
        comment: comment?.substring(0, 100),
        media,
        timestamp: new Date()
      });
    }
    
    // Notifier les mentions
    if (data.mentions && data.mentions.length > 0) {
      data.mentions.forEach(mentionId => {
        if (mentionId !== this.userId && mentionId !== storyOwnerId) {
          SocketService.sendToUser(mentionId, 'story:mention', {
            storyId,
            commentId,
            mentionedBy: this.userId,
            comment: comment?.substring(0, 100),
            timestamp: new Date()
          });
        }
      });
    }
  }

  handleStoryReply(data) {
    const { storyId, storyOwnerId, commentId, commentOwnerId, replyId, reply, media } = data;
    
    if (commentOwnerId !== this.userId) {
      SocketService.sendToUser(commentOwnerId, 'story:reply:new', {
        storyId,
        commentId,
        replyId,
        userId: this.userId,
        reply: reply?.substring(0, 100),
        media,
        timestamp: new Date()
      });
    }
  }
}

module.exports = StoryHandler;