const bcrypt = require('bcryptjs');

module.exports = (sequelize, DataTypes) => {
  const User = sequelize.define('User', {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true
    },
    phone: {
      type: DataTypes.STRING(20),
      allowNull: false,
      unique: true,
      validate: {
        len: [10, 20]
      }
    },
    email: {
      type: DataTypes.STRING(255),
      unique: true,
      allowNull: true,
      validate: {
        isEmail: true,
        isEmailValidation(value) {
          if (value && !/^\S+@\S+\.\S+$/.test(value)) {
            throw new Error('Format email invalide');
          }
        }
      }
    },
    password_hash: {
      type: DataTypes.STRING(255),
      allowNull: false
    },
    first_name: {
      type: DataTypes.STRING(100)
    },
    last_name: {
      type: DataTypes.STRING(100)
    },
    avatar_url: {
      type: DataTypes.TEXT
    },
    role: {
      type: DataTypes.ENUM('passenger', 'admin'),
      defaultValue: 'passenger'
    },
    is_active: {
      type: DataTypes.BOOLEAN,
      defaultValue: true
    },
    is_blocked: {
      type: DataTypes.BOOLEAN,
      defaultValue: false
    },
    blocked_reason: {
      type: DataTypes.TEXT
    },
    emergency_contact_name: {
      type: DataTypes.STRING(100)
    },
    emergency_contact_phone: {
      type: DataTypes.STRING(20)
    },
    rating: {
      type: DataTypes.DECIMAL(2, 1),
      defaultValue: 5.0,
      validate: {
        min: 0,
        max: 5
      }
    },
    total_rides: {
      type: DataTypes.INTEGER,
      defaultValue: 0
    },
    total_spent: {
      type: DataTypes.INTEGER,
      defaultValue: 0
    },
    otp_channel: {
      type: DataTypes.ENUM('sms', 'email'),
      defaultValue: 'sms'
    },
    last_login_at: {
      type: DataTypes.DATE
    },
    last_login_ip: {
      type: DataTypes.INET
    },
    is_verified: {
      type: DataTypes.BOOLEAN,
      defaultValue: false
    },
    cover_url: {
      type: DataTypes.TEXT,
      allowNull: true
    },
    // ✅ AJOUTEZ CE CHAMP
    birth_date: {
      type: DataTypes.DATEONLY,  // DATEONLY = YYYY-MM-DD sans heure
      allowNull: true,
      validate: {
        isDate: true,
        isBefore(value) {
          const today = new Date();
          const birthDate = new Date(value);
          let age = today.getFullYear() - birthDate.getFullYear();
          const monthDiff = today.getMonth() - birthDate.getMonth();
          
          if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
            age--;
          }
          
          if (age < 10) {
            throw new Error('Vous devez avoir au moins 10 ans');
          }
          
          if (age > 120) {
            throw new Error('Date de naissance invalide');
          }
        }
      }
    }
  }, {
    tableName: 'users',
    timestamps: true,
    underscored: true,
    hooks: {
      beforeCreate: async (user) => {
        if (user.password_hash) {
          user.password_hash = await bcrypt.hash(user.password_hash, 10);
        }
      },
      beforeUpdate: async (user) => {
        if (user.changed('password_hash')) {
          user.password_hash = await bcrypt.hash(user.password_hash, 10);
        }
      }
    }
  });

  // Instance methods
  User.prototype.comparePassword = async function(password) {
    return bcrypt.compare(password, this.password_hash);
  };

  User.prototype.toJSON = function() {
    const values = { ...this.get() };
    delete values.password_hash;
    return values;
  };

  return User;
};