/**
 * security.middleware.js
 * Security middleware for HeartsSync v2 backend.
 * Implements data minimization, biometric route protection,
 * and prevents raw BPM exposure via API.
 */
const logger = require('../utils/logger');

/**
 * noBiometricLeak middleware
 * Intercepts responses on biometric routes.
 * Strips any raw BPM fields from response bodies to enforce data minimization.
 * Per spec: clients NEVER receive raw BPM or raw reaction data.
 */
function noBiometricLeak(req, res, next) {
  const originalJson = res.json.bind(res);
  res.json = function (data) {
    if (data && typeof data === 'object') {
      const sanitized = stripRawBiometrics(data);
      return originalJson(sanitized);
    }
    return originalJson(data);
  };
  next();
}

/**
 * Recursively removes forbidden biometric fields from response objects.
 * Forbidden fields: bpm, raw_bpm, heart_rate_raw, bpm_value, reactions_raw
 */
const FORBIDDEN_FIELDS = new Set([
  'bpm', 'raw_bpm', 'heart_rate_raw', 'bpm_value',
  'reactions_raw', 'rawBpm', 'heartRateRaw', 'bpmRaw',
]);

function stripRawBiometrics(obj) {
  if (Array.isArray(obj)) {
    return obj.map(stripRawBiometrics);
  }
  if (obj !== null && typeof obj === 'object') {
    const cleaned = {};
    for (const [key, val] of Object.entries(obj)) {
      if (!FORBIDDEN_FIELDS.has(key)) {
        cleaned[key] = stripRawBiometrics(val);
      }
    }
    return cleaned;
  }
  return obj;
}

/**
 * httpsOnly middleware
 * Rejects plaintext HTTP requests in production.
 * In production, all biometric data must be sent over HTTPS.
 */
function httpsOnly(req, res, next) {
  if (process.env.NODE_ENV === 'production') {
    const proto = req.headers['x-forwarded-proto'] || req.protocol;
    if (proto !== 'https') {
      logger.warn({ message: 'HTTP request rejected on biometric route', path: req.path, ip: req.ip });
      return res.status(403).json({ error: 'HTTPS required for biometric endpoints' });
    }
  }
  next();
}

/**
 * requestSizeLimit middleware factory
 * Limits request body size for sensitive endpoints.
 * @param {string} limit - e.g. '5kb'
 */
function requestSizeLimit(limit = '5kb') {
  const express = require('express');
  return express.json({ limit });
}

/**
 * auditLog middleware
 * Logs access to sensitive biometric routes for compliance.
 */
function auditLog(req, res, next) {
  const userId = req.user ? req.user.id : 'anonymous';
  logger.info({
    type: 'AUDIT',
    userId,
    method: req.method,
    path: req.path,
    ip: req.ip,
    timestamp: new Date().toISOString(),
  });
  next();
}

/**
 * biometricAccessControl middleware
 * Ensures only the data owner can access their own biometric data.
 * Compares req.user.id with the userId in req.params.
 */
function biometricAccessControl(req, res, next) {
  if (!req.user) {
    return res.status(401).json({ error: 'Authentication required' });
  }
  // Admin bypass
  if (req.user.role === 'admin') {
    return next();
  }
  // Param-based ownership check (if :userId is in route)
  const targetUserId = req.params.userId || req.params.id;
  if (targetUserId && targetUserId !== req.user.id.toString()) {
    logger.warn({
      type: 'ACCESS_VIOLATION',
      requestingUser: req.user.id,
      targetUser: targetUserId,
      path: req.path,
    });
    return res.status(403).json({ error: 'Access denied to this resource' });
  }
  next();
}

module.exports = {
  noBiometricLeak,
  httpsOnly,
  requestSizeLimit,
  auditLog,
  biometricAccessControl,
};
