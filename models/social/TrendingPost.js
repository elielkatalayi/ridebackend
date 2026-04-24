const { DataTypes } = require('sequelize');
const { sequelize } = require('../../config/database');

const TrendingPost = sequelize.define('TrendingPost', {
    id: {
        type: DataTypes.UUID,
        defaultValue: DataTypes.UUIDV4,
        primaryKey: true
    },
    post_id: {
        type: DataTypes.UUID,
        allowNull: false,
        references: {
            model: 'posts',
            key: 'id'
        },
        unique: true
    },
    score: {
        type: DataTypes.INTEGER,
        defaultValue: 0
    },
    rank: {
        type: DataTypes.INTEGER,
        defaultValue: 0
    },
    category: {
        type: DataTypes.STRING(50),
        allowNull: true
    },
    started_at: {
        type: DataTypes.DATE,
        defaultValue: DataTypes.NOW
    },
    ended_at: {
        type: DataTypes.DATE,
        allowNull: true
    }
}, {
    tableName: 'trending_posts',
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: 'updated_at',
    indexes: [
        { fields: ['score', 'rank'] },
        { fields: ['category'] },
        { fields: ['started_at'] }
    ]
});

// Associations
TrendingPost.associate = (models) => {
    TrendingPost.belongsTo(models.Post, { foreignKey: 'post_id', as: 'post' });
};

module.exports = TrendingPost;