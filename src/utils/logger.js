const winston = require('winston');
const path = require('path');

// Définir les formats
const formats = {
  console: winston.format.combine(
    winston.format.colorize(),
    winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
    winston.format.printf(({ timestamp, level, message, ...meta }) => {
      let log = `${timestamp} [${level}]: ${message}`;
      if (Object.keys(meta).length > 0) {
        log += ` ${JSON.stringify(meta)}`;
      }
      return log;
    })
  ),
  file: winston.format.combine(
    winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
    winston.format.json()
  )
};

// Créer le logger
const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  transports: [
    // Console (toujours active)
    new winston.transports.Console({
      format: formats.console,
      silent: process.env.NODE_ENV === 'test'
    })
  ]
});

// Ajouter les transports fichier en production
if (process.env.NODE_ENV === 'production') {
  logger.add(new winston.transports.File({
    filename: path.join('logs', 'error.log'),
    level: 'error',
    format: formats.file,
    maxsize: 10485760, // 10MB
    maxFiles: 5
  }));
  
  logger.add(new winston.transports.File({
    filename: path.join('logs', 'combined.log'),
    format: formats.file,
    maxsize: 10485760,
    maxFiles: 5
  }));
}

/**
 * Logger avec contexte
 */
class Logger {
  static info(message, meta = {}) {
    logger.info(message, meta);
  }

  static error(message, meta = {}) {
    logger.error(message, meta);
  }

  static warn(message, meta = {}) {
    logger.warn(message, meta);
  }

  static debug(message, meta = {}) {
    logger.debug(message, meta);
  }

  static http(req, res, duration) {
    const message = `${req.method} ${req.originalUrl} - ${res.statusCode} - ${duration}ms`;
    logger.info(message, {
      method: req.method,
      url: req.originalUrl,
      status: res.statusCode,
      duration,
      ip: req.ip,
      userAgent: req.get('user-agent')
    });
  }

  static auth(userId, action, success = true, meta = {}) {
    logger.info(`Auth: ${action} - ${success ? 'SUCCESS' : 'FAILED'}`, {
      userId,
      action,
      success,
      ...meta
    });
  }

  static payment(userId, amount, method, reference, status, meta = {}) {
    logger.info(`Payment: ${status} - ${amount} FC via ${method}`, {
      userId,
      amount,
      method,
      reference,
      status,
      ...meta
    });
  }

  static ride(rideId, action, meta = {}) {
    logger.info(`Ride ${rideId}: ${action}`, {
      rideId,
      action,
      ...meta
    });
  }

  static sos(rideId, passengerId, meta = {}) {
    logger.warn(`SOS ALERT - Ride ${rideId} - Passenger ${passengerId}`, {
      rideId,
      passengerId,
      ...meta
    });
  }

  static apiCall(service, endpoint, duration, success = true, meta = {}) {
    logger.info(`API Call ${service}: ${endpoint} - ${duration}ms`, {
      service,
      endpoint,
      duration,
      success,
      ...meta
    });
  }
}

module.exports = Logger;