const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const { getUserMatches } = require('./MatchingEngine');
const { Match } = require('./Match.model');
const logger = require('../utils/logger');

const JWT_SECRET = process.env.JWT_SECRET || 'change-this-in-production';

function requireAuth(req, res, next) {
  const auth = req.headers.authorization;
  if (!auth || !auth.startsWith('Bearer ')) return res.status(401).json({ error: 'Unauthorized' });
  try {
    const payload = jwt.verify(auth.split(' ')[1], JWT_SECRET);
    if (payload.type !== 'access') return res.status(401).json({ error: 'Invalid token' });
    req.userId = payload.sub;
    next();
  } catch {
    res.status(401).json({ error: 'Invalid or expired token' });
  }
}

// GET /api/matching/my-matches
// Returns all matches for the authenticated user
// NOTE: The system created these - no user input
router.get('/my-matches', requireAuth, async (req, res) => {
  try {
    const matches = await getUserMatches(req.userId);
    logger.info({ msg: 'Matches fetched', userId: req.userId, count: matches.length });

    // Return only what client needs - no raw biometric details
    res.json({
      matches: matches.map(m => ({
        id: m._id,
        other_user: m.user1_id.toString() === req.userId ? m.user2_id : m.user1_id,
        cardiac_score: m.cardiac_score,
        created_at: m.created_at
      }))
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
