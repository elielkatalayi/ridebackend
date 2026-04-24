// services/auth/jwtService.js - Version simplifiée
const jwt = require('jsonwebtoken');
const env = require('../../config/env');

class JwtService {
  constructor() {
    this.secret = env.JWT_SECRET;
    this.expiresIn = env.JWT_EXPIRES_IN || '7d';
  }

  // Token normal
  generateToken(payload) {
    return jwt.sign(payload, this.secret, { expiresIn: this.expiresIn });
  }

  // Refresh token
  generateRefreshToken(payload) {
    return jwt.sign(payload, this.secret, { expiresIn: '30d' });
  }

  // ✅ Token temporaire (AJOUTÉ)
  generateTempToken(payload) {
    return jwt.sign(payload, this.secret, { expiresIn: '15m' });
  }

  // Vérifier token normal
  verifyToken(token) {
    try {
      return jwt.verify(token, this.secret);
    } catch (error) {
      if (error.name === 'TokenExpiredError') {
        throw new Error('Token expiré');
      }
      if (error.name === 'JsonWebTokenError') {
        throw new Error('Token invalide');
      }
      throw error;
    }
  }

  // ✅ Vérifier token temporaire (AJOUTÉ)
  verifyTempToken(token) {
    try {
      return jwt.verify(token, this.secret);
    } catch (error) {
      if (error.name === 'TokenExpiredError') {
        throw new Error('Token temporaire expiré');
      }
      if (error.name === 'JsonWebTokenError') {
        throw new Error('Token temporaire invalide');
      }
      throw error;
    }
  }

  decodeToken(token) {
    return jwt.decode(token);
  }

  generatePasswordResetToken(userId) {
    return jwt.sign({ userId, purpose: 'password_reset' }, this.secret, {
      expiresIn: '1h'
    });
  }

  verifyPasswordResetToken(token) {
    const payload = this.verifyToken(token);
    if (payload.purpose !== 'password_reset') {
      throw new Error('Token invalide pour cette opération');
    }
    return payload;
  }
}

module.exports = new JwtService();
