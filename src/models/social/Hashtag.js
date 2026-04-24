const { DataTypes } = require('sequelize');
const { sequelize } = require('../../config/database');

const Hashtag = sequelize.define('Hashtag', {
    id: {
        type: DataTypes.UUID,
        defaultValue: DataTypes.UUIDV4,
        primaryKey: true
    },
    tag: {
        type: DataTypes.STRING(100),
        allowNull: false
    },
    post_id: {
        type: DataTypes.UUID,
        allowNull: false,
        references: {
            model: 'posts',
            key: 'id'
        }
    },
    is_trending: {
        type: DataTypes.BOOLEAN,
        defaultValue: false
    },
    trending_score: {
        type: DataTypes.INTEGER,
        defaultValue: 0
    }
}, {
    tableName: 'hashtags',
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: false,
    indexes: [
        { fields: ['tag'] },
        { fields: ['tag', 'created_at'] },
        { fields: ['is_trending'] }
    ]
});

// Associations
Hashtag.associate = (models) => {
    Hashtag.belongsTo(models.Post, { foreignKey: 'post_id', as: 'post' });
};

module.exports = Hashtag;