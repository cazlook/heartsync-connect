const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const { body, validationResult } = require('express-validator');
const { User, BiometricProfile } = require('../users/User.model');
const logger = require('../utils/logger');

const JWT_SECRET = process.env.JWT_SECRET || 'change-this-in-production';
const JWT_EXPIRES = process.env.JWT_EXPIRES || '15m';
const REFRESH_EXPIRES = process.env.REFRESH_EXPIRES || '7d';

function generateTokens(userId) {
  const access = jwt.sign({ sub: userId, type: 'access' }, JWT_SECRET, { expiresIn: JWT_EXPIRES });
  const refresh = jwt.sign({ sub: userId, type: 'refresh' }, JWT_SECRET, { expiresIn: REFRESH_EXPIRES });
  return { access, refresh };
}

// POST /api/auth/register
router.post('/register', [
  body('email').isEmail().normalizeEmail(),
  body('password').isLength({ min: 8 }),
  body('displayName').trim().isLength({ min: 2, max: 50 })
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

  try {
    const { email, password, displayName } = req.body;
    const existing = await User.findOne({ email });
    if (existing) return res.status(409).json({ error: 'Email already registered' });

    const user = new User({ email, passwordHash: password, displayName });
    await user.save();

    // Create empty biometric profile (separate collection)
    await BiometricProfile.create({ userId: user._id });

    logger.info({ msg: 'User registered', userId: user._id });
    const tokens = generateTokens(user._id);
    res.status(201).json({ tokens, userId: user._id });
  } catch (err) {
    logger.error({ msg: 'Register error', error: err.message });
    res.status(500).json({ error: 'Registration failed' });
  }
});

// POST /api/auth/login
router.post('/login', [
  body('email').isEmail().normalizeEmail(),
  body('password').notEmpty()
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

  try {
    const { email, password } = req.body;
    const user = await User.findOne({ email });
    if (!user) return res.status(401).json({ error: 'Invalid credentials' });

    const valid = await user.comparePassword(password);
    if (!valid) return res.status(401).json({ error: 'Invalid credentials' });

    logger.info({ msg: 'User login', userId: user._id });
    const tokens = generateTokens(user._id);
    res.json({ tokens, userId: user._id });
  } catch (err) {
    logger.error({ msg: 'Login error', error: err.message });
    res.status(500).json({ error: 'Login failed' });
  }
});

// POST /api/auth/refresh
router.post('/refresh', async (req, res) => {
  const { refresh_token } = req.body;
  if (!refresh_token) return res.status(400).json({ error: 'refresh_token required' });

  try {
    const payload = jwt.verify(refresh_token, JWT_SECRET);
    if (payload.type !== 'refresh') return res.status(401).json({ error: 'Invalid token type' });
    const tokens = generateTokens(payload.sub);
    res.json({ tokens });
  } catch (err) {
    res.status(401).json({ error: 'Invalid or expired refresh token' });
  }
});

module.exports = router;
