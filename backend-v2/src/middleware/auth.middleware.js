/**
 * auth.middleware.js
 * JWT authentication middleware for HeartsSync v2 backend.
 * Validates Bearer tokens, attaches req.user, enforces RBAC.
 */
const jwt = require('jsonwebtoken');
const logger = require('../utils/logger');

const JWT_SECRET = process.env.JWT_SECRET || 'change-this-in-production';

/**
 * requireAuth middleware
 * Extracts and verifies the JWT from Authorization: Bearer <token>.
 * Sets req.user = { id, email, role } on success.
 */
function requireAuth(req, res, next) {
  const authHeader = req.headers['authorization'];
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Authorization header missing or malformed' });
  }

  const token = authHeader.slice(7);
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    if (decoded.type !== 'access') {
      return res.status(401).json({ error: 'Invalid token type' });
    }
    req.user = {
      id: decoded.sub,
      role: decoded.role || 'user',
    };
    next();
  } catch (err) {
    if (err.name === 'TokenExpiredError') {
      return res.status(401).json({ error: 'Token expired' });
    }
    if (err.name === 'JsonWebTokenError') {
      return res.status(401).json({ error: 'Invalid token' });
    }
    logger.error({ message: 'JWT verification error', err: err.message });
    return res.status(500).json({ error: 'Authentication error' });
  }
}

/**
 * requireRole middleware factory.
 * Usage: requireRole('admin') to restrict to admins only.
 * Must be used after requireAuth.
 */
function requireRole(...roles) {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ error: 'Not authenticated' });
    }
    if (!roles.includes(req.user.role)) {
      return res.status(403).json({ error: 'Insufficient permissions' });
    }
    next();
  };
}

/**
 * optionalAuth middleware
 * Like requireAuth but does NOT reject if no token is present.
 * Sets req.user if valid token present, otherwise req.user = null.
 */
function optionalAuth(req, res, next) {
  const authHeader = req.headers['authorization'];
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    req.user = null;
    return next();
  }
  const token = authHeader.slice(7);
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.user = {
      id: decoded.sub,
      role: decoded.role || 'user',
    };
  } catch {
    req.user = null;
  }
  next();
}

module.exports = { requireAuth, requireRole, optionalAuth };
