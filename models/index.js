const { Sequelize } = require('sequelize');
const { sequelize } = require('../config/database');

// Importation des modèles
const Country = require('./Country')(sequelize, Sequelize);
const City = require('./City')(sequelize, Sequelize);
const User = require('./User')(sequelize, Sequelize);
const Driver = require('./Driver')(sequelize, Sequelize);
const Category = require('./Category')(sequelize, Sequelize);
const CityCategoryPricing = require('./CityCategoryPricing')(sequelize, Sequelize);
const Ride = require('./Ride')(sequelize, Sequelize);
const RideNegotiation = require('./RideNegotiation')(sequelize, Sequelize);
const RideStop = require('./RideStop')(sequelize, Sequelize);
const RidePause = require('./RidePause')(sequelize, Sequelize);
const RideWaitTime = require('./RideWaitTime')(sequelize, Sequelize);
const Wallet = require('./Wallet')(sequelize, Sequelize);
const WalletTransaction = require('./WalletTransaction')(sequelize, Sequelize);
const Payment = require('./Payment')(sequelize, Sequelize);
const SosAlert = require('./SosAlert')(sequelize, Sequelize);
// const Chat = require('./Chat')(sequelize, Sequelize);
// const ChatMessage = require('./ChatMessage')(sequelize, Sequelize);
const DriverPointsHistory = require('./DriverPointsHistory')(sequelize, Sequelize);
const PlatformSetting = require('./PlatformSetting')(sequelize, Sequelize);
const DispatchSetting = require('./DispatchSetting')(sequelize, Sequelize);
const SanctionRule = require('./SanctionRule')(sequelize, Sequelize);
const CancellationSetting = require('./CancellationSetting')(sequelize, Sequelize);
const Rental = require('./Rental')(sequelize, Sequelize);
const HeavyEquipmentRental = require('./HeavyEquipmentRental')(sequelize, Sequelize);
const AdminLog = require('./AdminLog')(sequelize, Sequelize);
const OtpCode = require('./OtpCode')(sequelize, Sequelize);



// notification
const Notification = require('./notification/Notification');
const NotificationBatch = require('./notification/NotificationBatch');
const UserDevice = require('./notification/UserDevice');
const NotificationPreference = require('./notification/NotificationPreference');
const NotificationTemplate = require('./notification/NotificationTemplate');
const NotificationLog = require('./notification/NotificationLog');
const PendingPush = require('./notification/PendingPush');
const SocketSession = require('./notification/SocketSession');


// Modèles sociaux
const Group = require('./social/Group');
const GroupMember = require('./social/GroupMember');
const Page = require('./social/Page');
const PageAdmin = require('./social/PageAdmin');
const PageFollower = require('./social/PageFollower');
const Post = require('./social/Post');
const Comment = require('./social/Comment');
const PostReaction = require('./social/PostReaction');
const CommentReaction = require('./social/CommentReaction');
const Repost = require('./social/Repost');
const SavedPost = require('./social/SavedPost');
const PostView = require('./social/PostView');
const PostShare = require('./social/PostShare');
const Hashtag = require('./social/Hashtag');
const Report = require('./social/Report');

// CHAT
const Chat = require('./chat/Chat');
const ChatParticipant = require('./chat/ChatParticipant');
const ChatMessage = require('./chat/ChatMessage');
const ChatReaction = require('./chat/ChatReaction');
const ChatPinnedMessage = require('./chat/ChatPinnedMessage');
const ChatNote = require('./chat/ChatNote');
const ChatNoteFolder = require('./chat/ChatNoteFolder');
const ChatTransfer = require('./chat/ChatTransfer');
const ChatUserStats = require('./chat/ChatUserStats');


// Nouveaux modèles Stories
const Story = require('./social/Story');
const StoryView = require('./social/StoryView');
const StoryComment = require('./social/StoryComment');
const StoryHighlight = require('./social/StoryHighlight');


// =====================================================
// MODÈLES PUBLICITAIRES (ADVERTISING)
// =====================================================
const AdCampaign = require('./advertising/AdCampaign');
const AdTargeting = require('./advertising/AdTargeting');
const AdImpression = require('./advertising/AdImpression');
const AdPayment = require('./advertising/AdPayment');

const CommissionHistory = require('./CommissionHistory')(sequelize, Sequelize);

// Ajoutez cette ligne après OtpCode ou avec les autres modèles
const UserLocation = require('./UserLocation')(sequelize, Sequelize);

const Vehicle = require('./rental/Vehicle')(sequelize, Sequelize);
const VehicleAvailability = require('./rental/VehicleAvailability')(sequelize, Sequelize);
const VehicleBooking = require('./rental/VehicleBooking')(sequelize, Sequelize);
const BookingReview = require('./rental/BookingReview')(sequelize, Sequelize);

// models/index.js - Ajoutez ces associations après la définition des modèles

// Association Vehicle ↔ User (owner)
Vehicle.belongsTo(User, { foreignKey: 'owner_id', as: 'owner' });
User.hasMany(Vehicle, { foreignKey: 'owner_id', as: 'vehicles' });

// Association Vehicle ↔ VehicleAvailability
Vehicle.hasMany(VehicleAvailability, { foreignKey: 'vehicle_id', as: 'availabilities' });
VehicleAvailability.belongsTo(Vehicle, { foreignKey: 'vehicle_id', as: 'vehicle' });

// Association Vehicle ↔ VehicleBooking
Vehicle.hasMany(VehicleBooking, { foreignKey: 'vehicle_id', as: 'bookings' });
VehicleBooking.belongsTo(Vehicle, { foreignKey: 'vehicle_id', as: 'vehicle' });

// Association User ↔ VehicleBooking (renter)
User.hasMany(VehicleBooking, { foreignKey: 'renter_id', as: 'renterBookings' });
VehicleBooking.belongsTo(User, { foreignKey: 'renter_id', as: 'renter' });

// =====================================================
// 📍 ASSOCIATIONS POUR USER LOCATION
// =====================================================

// User ↔ UserLocation (One-to-Many)
User.hasMany(UserLocation, { foreignKey: 'user_id', as: 'locations' });
UserLocation.belongsTo(User, { foreignKey: 'user_id', as: 'user' });

// Ride ↔ UserLocation (pendant une course)
UserLocation.belongsTo(Ride, { foreignKey: 'active_ride_id', as: 'activeRide' });
Ride.hasMany(UserLocation, { foreignKey: 'active_ride_id', as: 'locations' });

// CommissionHistory associations
CommissionHistory.belongsTo(Ride, { foreignKey: 'ride_id', as: 'ride' });
CommissionHistory.belongsTo(User, { foreignKey: 'driver_id', as: 'driver' });
Ride.hasMany(CommissionHistory, { foreignKey: 'ride_id', as: 'commissions' });
User.hasMany(CommissionHistory, { foreignKey: 'driver_id', as: 'commissions' });
// =====================================================
// 🔗 DÉFINITION DES ASSOCIATIONS
// =====================================================

// Country ↔ City
Country.hasMany(City, { foreignKey: 'country_id', as: 'cities' });
City.belongsTo(Country, { foreignKey: 'country_id', as: 'country' });

// User ↔ Driver (One-to-One)
User.hasOne(Driver, { foreignKey: 'user_id', as: 'driver' });
Driver.belongsTo(User, { foreignKey: 'user_id', as: 'user' });

// User ↔ Wallet (One-to-One)
User.hasOne(Wallet, { foreignKey: 'user_id', as: 'wallet' });
Wallet.belongsTo(User, { foreignKey: 'user_id', as: 'user' });

// Driver ↔ Wallet (One-to-One)
Driver.hasOne(Wallet, { foreignKey: 'driver_id', as: 'wallet' });
Wallet.belongsTo(Driver, { foreignKey: 'driver_id', as: 'driver' });

// Driver ↔ City
Driver.belongsTo(City, { foreignKey: 'city_id', as: 'city' });
City.hasMany(Driver, { foreignKey: 'city_id', as: 'drivers' });

// Category ↔ CityCategoryPricing
Category.hasMany(CityCategoryPricing, { foreignKey: 'category_id', as: 'cityPricing' });
CityCategoryPricing.belongsTo(Category, { foreignKey: 'category_id', as: 'category' });
City.hasMany(CityCategoryPricing, { foreignKey: 'city_id', as: 'categoryPricing' });
CityCategoryPricing.belongsTo(City, { foreignKey: 'city_id', as: 'city' });

// Ride associations
Ride.belongsTo(User, { foreignKey: 'passenger_id', as: 'passenger' });
Ride.belongsTo(Driver, { foreignKey: 'driver_id', as: 'driver' });
Ride.belongsTo(Category, { foreignKey: 'category_id', as: 'category' });
Ride.belongsTo(City, { foreignKey: 'city_id', as: 'city' });
User.hasMany(Ride, { foreignKey: 'passenger_id', as: 'rides' });
Driver.hasMany(Ride, { foreignKey: 'driver_id', as: 'rides' });

// Ride ↔ RideNegotiation
Ride.hasMany(RideNegotiation, { foreignKey: 'ride_id', as: 'negotiations' });
RideNegotiation.belongsTo(Ride, { foreignKey: 'ride_id', as: 'ride' });

// Ride ↔ RideStop
Ride.hasMany(RideStop, { foreignKey: 'ride_id', as: 'stops' });
RideStop.belongsTo(Ride, { foreignKey: 'ride_id', as: 'ride' });

// Ride ↔ RidePause
Ride.hasMany(RidePause, { foreignKey: 'ride_id', as: 'pauses' });
RidePause.belongsTo(Ride, { foreignKey: 'ride_id', as: 'ride' });

// Ride ↔ RideWaitTime
Ride.hasOne(RideWaitTime, { foreignKey: 'ride_id', as: 'waitTime' });
RideWaitTime.belongsTo(Ride, { foreignKey: 'ride_id', as: 'ride' });

// Ride ↔ Payment
Ride.hasOne(Payment, { foreignKey: 'ride_id', as: 'payment' });
Payment.belongsTo(Ride, { foreignKey: 'ride_id', as: 'ride' });

// Ride ↔ SosAlert
Ride.hasOne(SosAlert, { foreignKey: 'ride_id', as: 'sosAlert' });
SosAlert.belongsTo(Ride, { foreignKey: 'ride_id', as: 'ride' });

// User ↔ SosAlert
User.hasMany(SosAlert, { foreignKey: 'passenger_id', as: 'sosAlerts' });
SosAlert.belongsTo(User, { foreignKey: 'passenger_id', as: 'passenger' });

// Wallet ↔ WalletTransaction
Wallet.hasMany(WalletTransaction, { foreignKey: 'wallet_id', as: 'transactions' });
WalletTransaction.belongsTo(Wallet, { foreignKey: 'wallet_id', as: 'wallet' });

// Driver ↔ DriverPointsHistory
Driver.hasMany(DriverPointsHistory, { foreignKey: 'driver_id', as: 'pointsHistory' });
DriverPointsHistory.belongsTo(Driver, { foreignKey: 'driver_id', as: 'driver' });

// Rental associations
Rental.belongsTo(User, { foreignKey: 'user_id', as: 'user' });
Rental.belongsTo(Driver, { foreignKey: 'driver_id', as: 'driver' });
Rental.belongsTo(Category, { foreignKey: 'category_id', as: 'category' });
Rental.belongsTo(City, { foreignKey: 'city_id', as: 'city' });

// HeavyEquipmentRental associations
HeavyEquipmentRental.belongsTo(User, { foreignKey: 'user_id', as: 'user' });
HeavyEquipmentRental.belongsTo(Category, { foreignKey: 'category_id', as: 'category' });
HeavyEquipmentRental.belongsTo(City, { foreignKey: 'city_id', as: 'city' });
// =====================================================
// CHAT ASSOCIATIONS (Version complète et sans doublons)
// =====================================================

// Chat ↔ User/Driver
Chat.belongsTo(User, { foreignKey: 'user_id', as: 'user' });
Chat.belongsTo(Driver, { foreignKey: 'driver_id', as: 'driver' });

// Chat ↔ ChatParticipant
Chat.hasMany(ChatParticipant, { foreignKey: 'chat_id', as: 'participants' });
ChatParticipant.belongsTo(Chat, { foreignKey: 'chat_id', as: 'chat' });

// ChatParticipant ↔ User
ChatParticipant.belongsTo(User, { foreignKey: 'user_id', as: 'user' });
User.hasMany(ChatParticipant, { foreignKey: 'user_id', as: 'chatParticipants' });

// Chat ↔ ChatMessage
Chat.hasMany(ChatMessage, { foreignKey: 'chat_id', as: 'messages' });
ChatMessage.belongsTo(Chat, { foreignKey: 'chat_id', as: 'chat' });

// ChatMessage ↔ User
ChatMessage.belongsTo(User, { foreignKey: 'sender_id', as: 'sender' });
User.hasMany(ChatMessage, { foreignKey: 'sender_id', as: 'messages' });

// ✅ AUTO-ASSOCIATION pour les replies (réponses aux messages)
// ChatMessage ↔ ChatMessage (self-reference for replies)
ChatMessage.belongsTo(ChatMessage, { 
  foreignKey: 'reply_to_id', 
  as: 'replyTo' 
});

ChatMessage.hasMany(ChatMessage, { 
  foreignKey: 'reply_to_id', 
  as: 'replies' 
});

// ✅ ChatMessage ↔ ChatReaction (One-to-Many) - DÉFINI UNE SEULE FOIS
ChatMessage.hasMany(ChatReaction, { 
  foreignKey: 'message_id', 
  as: 'reactions',
  onDelete: 'CASCADE' 
});

// ✅ ChatReaction ↔ ChatMessage (Many-to-One)
ChatReaction.belongsTo(ChatMessage, { 
  foreignKey: 'message_id', 
  as: 'message' 
});

// ✅ ChatReaction ↔ User
ChatReaction.belongsTo(User, { 
  foreignKey: 'user_id', 
  as: 'user' 
});

User.hasMany(ChatReaction, { 
  foreignKey: 'user_id', 
  as: 'reactions' 
});

// ChatPinnedMessage associations
ChatPinnedMessage.belongsTo(Chat, { foreignKey: 'chat_id', as: 'chat' });
ChatPinnedMessage.belongsTo(ChatMessage, { foreignKey: 'message_id', as: 'message' });
ChatPinnedMessage.belongsTo(User, { foreignKey: 'pinned_by', as: 'pinnedBy' });

Chat.hasMany(ChatPinnedMessage, { foreignKey: 'chat_id', as: 'pinnedMessages' });

// ChatNote associations
ChatNote.belongsTo(Chat, { foreignKey: 'chat_id', as: 'chat' });
ChatNote.belongsTo(User, { foreignKey: 'created_by', as: 'creator' });
ChatNote.belongsTo(ChatNoteFolder, { foreignKey: 'folder_id', as: 'folder' });

Chat.hasMany(ChatNote, { foreignKey: 'chat_id', as: 'notes' });
User.hasMany(ChatNote, { foreignKey: 'created_by', as: 'notes' });

// ChatNoteFolder associations
ChatNoteFolder.belongsTo(User, { foreignKey: 'user_id', as: 'user' });
User.hasMany(ChatNoteFolder, { foreignKey: 'user_id', as: 'noteFolders' });

ChatNoteFolder.hasMany(ChatNote, { foreignKey: 'folder_id', as: 'notes' });

// ChatTransfer associations
ChatTransfer.belongsTo(Chat, { foreignKey: 'chat_id', as: 'chat' });
ChatTransfer.belongsTo(User, { foreignKey: 'transferred_from', as: 'fromUser' });
ChatTransfer.belongsTo(User, { foreignKey: 'transferred_to', as: 'toUser' });
ChatTransfer.belongsTo(User, { foreignKey: 'transferred_by', as: 'transferredBy' });

Chat.hasMany(ChatTransfer, { foreignKey: 'chat_id', as: 'transfers' });

// ChatUserStats
ChatUserStats.belongsTo(Chat, { foreignKey: 'chat_id', as: 'chat' });
ChatUserStats.belongsTo(User, { foreignKey: 'user_id', as: 'user' });
Chat.hasMany(ChatUserStats, { foreignKey: 'chat_id', as: 'userStats' });
User.hasMany(ChatUserStats, { foreignKey: 'user_id', as: 'chatStats' });



// =====================================================
// 📌 ASSOCIATIONS DES MODÈLES SOCIAUX
// =====================================================

// Page associations
Page.belongsTo(User, { foreignKey: 'created_by', as: 'creator' });
Page.hasMany(PageAdmin, { foreignKey: 'page_id', as: 'admins' });
Page.hasMany(PageFollower, { foreignKey: 'page_id', as: 'followers' });
Page.hasMany(Post, { foreignKey: 'container_id', as: 'posts', scope: { container_type: 'page' } });

// PageAdmin associations
PageAdmin.belongsTo(Page, { foreignKey: 'page_id', as: 'page' });
PageAdmin.belongsTo(User, { foreignKey: 'user_id', as: 'user' });

// PageFollower associations
PageFollower.belongsTo(Page, { foreignKey: 'page_id', as: 'page' });
PageFollower.belongsTo(User, { foreignKey: 'user_id', as: 'user' });

// Group associations
Group.belongsTo(User, { foreignKey: 'created_by', as: 'creator' });
Group.hasMany(GroupMember, { foreignKey: 'group_id', as: 'members' });
Group.hasMany(Post, { foreignKey: 'container_id', as: 'posts', scope: { container_type: 'group' } });

// GroupMember associations
GroupMember.belongsTo(Group, { foreignKey: 'group_id', as: 'group' });
GroupMember.belongsTo(User, { foreignKey: 'user_id', as: 'user' });

// Post associations
Post.belongsTo(User, { foreignKey: 'author_id', as: 'author' });
Post.hasMany(Comment, { foreignKey: 'post_id', as: 'comments' });
Post.hasMany(PostReaction, { foreignKey: 'post_id', as: 'reactions' });
Post.hasMany(PostView, { foreignKey: 'post_id', as: 'views' });
Post.hasMany(SavedPost, { foreignKey: 'post_id', as: 'savedBy' });
Post.hasMany(Repost, { foreignKey: 'original_post_id', as: 'reposts' });
Post.hasMany(PostShare, { foreignKey: 'post_id', as: 'shares' });

// Comment associations
Comment.belongsTo(Post, { foreignKey: 'post_id', as: 'post' });
Comment.belongsTo(User, { foreignKey: 'user_id', as: 'user' });
Comment.belongsTo(Comment, { foreignKey: 'parent_comment_id', as: 'parent' });
Comment.hasMany(Comment, { foreignKey: 'parent_comment_id', as: 'replies' });
Comment.hasMany(CommentReaction, { foreignKey: 'comment_id', as: 'reactions' });

// PostReaction associations
PostReaction.belongsTo(Post, { foreignKey: 'post_id', as: 'post' });
PostReaction.belongsTo(User, { foreignKey: 'user_id', as: 'user' });

// CommentReaction associations
CommentReaction.belongsTo(Comment, { foreignKey: 'comment_id', as: 'comment' });
CommentReaction.belongsTo(User, { foreignKey: 'user_id', as: 'user' });

// Repost associations
Repost.belongsTo(Post, { foreignKey: 'original_post_id', as: 'originalPost' });
Repost.belongsTo(User, { foreignKey: 'user_id', as: 'user' });

// SavedPost associations
SavedPost.belongsTo(Post, { foreignKey: 'post_id', as: 'post' });
SavedPost.belongsTo(User, { foreignKey: 'user_id', as: 'user' });

// PostView associations
PostView.belongsTo(Post, { foreignKey: 'post_id', as: 'post' });
PostView.belongsTo(User, { foreignKey: 'user_id', as: 'user' });

// PostShare associations
PostShare.belongsTo(Post, { foreignKey: 'post_id', as: 'post' });
PostShare.belongsTo(User, { foreignKey: 'user_id', as: 'user' });

// Story associations
Story.belongsTo(User, { foreignKey: 'user_id', as: 'user' });
Story.hasMany(StoryView, { foreignKey: 'story_id', as: 'views' });
Story.hasMany(StoryComment, { foreignKey: 'story_id', as: 'comments' });

// StoryView associations
StoryView.belongsTo(Story, { foreignKey: 'story_id', as: 'story' });
StoryView.belongsTo(User, { foreignKey: 'user_id', as: 'user' });

// StoryComment associations
StoryComment.belongsTo(Story, { foreignKey: 'story_id', as: 'story' });
StoryComment.belongsTo(User, { foreignKey: 'user_id', as: 'user' });

// StoryHighlight associations
StoryHighlight.belongsTo(User, { foreignKey: 'user_id', as: 'user' });
StoryHighlight.belongsToMany(Story, { through: 'HighlightStories', as: 'stories' });


// =====================================================
// 📌 ASSOCIATIONS DES MODÈLES PUBLICITAIRES
// =====================================================

// AdCampaign associations
AdCampaign.belongsTo(Page, { foreignKey: 'page_id', as: 'page' });
AdCampaign.belongsTo(User, { foreignKey: 'created_by', as: 'creator' });
AdCampaign.belongsTo(Post, { foreignKey: 'post_id', as: 'post' });
AdCampaign.belongsTo(Story, { foreignKey: 'story_id', as: 'story' });
AdCampaign.belongsTo(User, { foreignKey: 'reviewed_by', as: 'reviewer' });
AdCampaign.hasMany(AdTargeting, { foreignKey: 'campaign_id', as: 'targeting_details' });
AdCampaign.hasMany(AdImpression, { foreignKey: 'campaign_id', as: 'impressions_logs' });
AdCampaign.hasOne(AdPayment, { foreignKey: 'campaign_id', as: 'payment' });

// AdTargeting associations
AdTargeting.belongsTo(AdCampaign, { foreignKey: 'campaign_id', as: 'campaign' });

// AdImpression associations
AdImpression.belongsTo(AdCampaign, { foreignKey: 'campaign_id', as: 'campaign' });
AdImpression.belongsTo(User, { foreignKey: 'user_id', as: 'user' });

// AdPayment associations
AdPayment.belongsTo(AdCampaign, { foreignKey: 'campaign_id', as: 'campaign' });
AdPayment.belongsTo(WalletTransaction, { foreignKey: 'wallet_transaction_id', as: 'wallet_transaction' });


module.exports = {
  sequelize,
  Sequelize,
  Country,
  City,
  User,
  Driver,
  Category,
  CityCategoryPricing,
  Ride,
  RideNegotiation,
  RideStop,
  RidePause,
  RideWaitTime,
  Wallet,
  WalletTransaction,
  Payment,
  SosAlert,
  // Chat,
  // ChatMessage,
  DriverPointsHistory,
  PlatformSetting,
  DispatchSetting,
  SanctionRule,
  CancellationSetting,
  Rental,
  HeavyEquipmentRental,
  AdminLog,
  OtpCode,
  UserLocation,
  // notification
  Notification,
  NotificationBatch,
  UserDevice,
  NotificationPreference,
  NotificationTemplate,
  NotificationLog,
  PendingPush,
  SocketSession,


// SOCIAL
  Group,
  GroupMember,
  Page,
  PageAdmin,
  PageFollower,
  Post,
  Comment,
  PostReaction,
  CommentReaction,
  Repost,
  SavedPost,
  PostView,
  PostShare,
  Hashtag,
  Report,
  
// CHAT
  Chat,
  ChatParticipant,
  ChatMessage,
  ChatReaction,
  ChatPinnedMessage,
  ChatNote,
  ChatNoteFolder,
  ChatTransfer,
  ChatUserStats,

  // Stories
  Story,
  StoryView,
  StoryComment,
  StoryHighlight,

  // =====================================================
  // ADVERTISING (PUBLICITÉ)
  // =====================================================
  AdCampaign,
  AdTargeting,
  AdImpression,
  AdPayment,
  CommissionHistory,
  Vehicle ,
  VehicleAvailability,
  VehicleBooking,
  BookingReview
};