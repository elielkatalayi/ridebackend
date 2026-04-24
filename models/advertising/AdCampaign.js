const { DataTypes } = require('sequelize');
const { sequelize } = require('../../config/database');

const AdCampaign = sequelize.define('AdCampaign', {
    id: {
        type: DataTypes.UUID,
        defaultValue: DataTypes.UUIDV4,
        primaryKey: true
    },
    page_id: {
        type: DataTypes.UUID,
        allowNull: false,
        references: {
            model: 'pages',
            key: 'id'
        },
        onDelete: 'CASCADE'
    },
    created_by: {
        type: DataTypes.UUID,
        allowNull: false,
        references: {
            model: 'users',
            key: 'id'
        },
        onDelete: 'CASCADE'
    },
    ad_type: {
        type: DataTypes.STRING(20),
        allowNull: false,
        validate: {
            isIn: [['post', 'story', 'external_link', 'page_promotion']]
        }
    },
    post_id: {
        type: DataTypes.UUID,
        allowNull: true,
        references: {
            model: 'posts',
            key: 'id'
        },
        onDelete: 'SET NULL'
    },
    story_id: {
        type: DataTypes.UUID,
        allowNull: true,
        references: {
            model: 'stories',
            key: 'id'
        },
        onDelete: 'SET NULL'
    },
    external_url: {
        type: DataTypes.TEXT,
        allowNull: true,
        validate: {
            isUrl: true
        }
    },
    external_title: {
        type: DataTypes.STRING(255),
        allowNull: true
    },
    external_description: {
        type: DataTypes.TEXT,
        allowNull: true
    },
    external_image: {
        type: DataTypes.TEXT,
        allowNull: true
    },
    media_url: {
        type: DataTypes.TEXT,
        allowNull: true
    },
    media_type: {
        type: DataTypes.STRING(20),
        allowNull: true,
        validate: {
            isIn: [['image', 'video', 'gif']]
        }
    },
    thumbnail_url: {
        type: DataTypes.TEXT,
        allowNull: true
    },
    title: {
        type: DataTypes.STRING(255),
        allowNull: false
    },
    description: {
        type: DataTypes.TEXT,
        allowNull: true
    },
    call_to_action: {
        type: DataTypes.STRING(50),
        allowNull: true,
        validate: {
            isIn: [['learn_more', 'shop_now', 'subscribe', 'contact', 'download', 'visit_page']]
        }
    },
    total_budget: {
        type: DataTypes.INTEGER,
        allowNull: false,
        validate: {
            min: 1000
        }
    },
    daily_budget: {
        type: DataTypes.INTEGER,
        allowNull: true,
        validate: {
            min: 500
        }
    },
    spent_amount: {
        type: DataTypes.INTEGER,
        defaultValue: 0
    },
    start_date: {
        type: DataTypes.DATE,
        allowNull: false
    },
    end_date: {
        type: DataTypes.DATE,
        allowNull: false
    },
    targeting: {
        type: DataTypes.JSONB,
        defaultValue: {
            countries: [],
            cities: [],
            age_range: { min: 18, max: 65 },
            genders: ['male', 'female'],
            interests: [],
            languages: ['fr'],
            radius_km: null,
            latitude: null,
            longitude: null
        }
    },
    objective: {
        type: DataTypes.STRING(30),
        defaultValue: 'reach',
        validate: {
            isIn: [['reach', 'engagement', 'clicks', 'conversions']]
        }
    },
    status: {
        type: DataTypes.STRING(20),
        defaultValue: 'pending',
        validate: {
            isIn: [['pending', 'active', 'paused', 'completed', 'cancelled', 'rejected']]
        }
    },
    reviewed_by: {
        type: DataTypes.UUID,
        allowNull: true,
        references: {
            model: 'users',
            key: 'id'
        },
        onDelete: 'SET NULL'
    },
    reviewed_at: {
        type: DataTypes.DATE,
        allowNull: true
    },
    review_note: {
        type: DataTypes.TEXT,
        allowNull: true
    },
    impressions: {
        type: DataTypes.INTEGER,
        defaultValue: 0
    },
    clicks: {
        type: DataTypes.INTEGER,
        defaultValue: 0
    },
    likes: {
        type: DataTypes.INTEGER,
        defaultValue: 0
    },
    comments: {
        type: DataTypes.INTEGER,
        defaultValue: 0
    },
    shares: {
        type: DataTypes.INTEGER,
        defaultValue: 0
    },
    cost_per_click: {
        type: DataTypes.INTEGER,
        defaultValue: 0
    },
    cost_per_impression: {
        type: DataTypes.INTEGER,
        defaultValue: 0
    }
}, {
    tableName: 'ad_campaigns',
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: 'updated_at',
    indexes: [
        { fields: ['page_id'] },
        { fields: ['status'] },
        { fields: ['start_date', 'end_date'] },
        { fields: ['post_id'] },
        { fields: ['story_id'] },
        { fields: ['created_by'] }
    ]
});

// Associations
AdCampaign.associate = (models) => {
    AdCampaign.belongsTo(models.Page, { foreignKey: 'page_id', as: 'page' });
    AdCampaign.belongsTo(models.User, { foreignKey: 'created_by', as: 'creator' });
    AdCampaign.belongsTo(models.Post, { foreignKey: 'post_id', as: 'post' });
    AdCampaign.belongsTo(models.Story, { foreignKey: 'story_id', as: 'story' });
    AdCampaign.belongsTo(models.User, { foreignKey: 'reviewed_by', as: 'reviewer' });
    AdCampaign.hasMany(models.AdTargeting, { foreignKey: 'campaign_id', as: 'targeting_details' });
    AdCampaign.hasMany(models.AdImpression, { foreignKey: 'campaign_id', as: 'impressions_logs' });
    AdCampaign.hasOne(models.AdPayment, { foreignKey: 'campaign_id', as: 'payment' });
};

module.exports = AdCampaign;