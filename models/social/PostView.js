const { DataTypes } = require('sequelize');
const { sequelize } = require('../../config/database');

const PostView = sequelize.define('PostView', {
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
        }
    },
    user_id: {
        type: DataTypes.UUID,
        allowNull: false,
        references: {
            model: 'users',
            key: 'id'
        }
    },
    watch_duration_seconds: {
        type: DataTypes.INTEGER,
        defaultValue: 0
    },
    watch_percentage: {
        type: DataTypes.DECIMAL(5, 2),
        defaultValue: 0
    },
    completed: {
        type: DataTypes.BOOLEAN,
        defaultValue: false
    },
    viewed_at: {
        type: DataTypes.DATE,
        defaultValue: DataTypes.NOW
    }
}, {
    tableName: 'post_views',
    timestamps: false
});

// Associations
PostView.associate = (models) => {
    PostView.belongsTo(models.Post, { foreignKey: 'post_id', as: 'post' });
    PostView.belongsTo(models.User, { foreignKey: 'user_id', as: 'user' });
};

module.exports = PostView;