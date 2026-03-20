/**
 * MatchingEngine - Autonomous match decision system
 *
 * RULES:
 * - NO manual input creates a match (no swipe, like, click)
 * - Match created ONLY when A->B AND B->A valid reactions exist
 * - cardiac_score derived from z_scores (0-100 scale)
 * - Full auditability: every match includes the why
 */

const { Reaction } = require('../biometrics/Reaction.model');
const { Match } = require('./Match.model');
const logger = require('../utils/logger');

const CONFIDENCE_THRESHOLD = 0.4; // minimum confidence for a reaction to count
const REACTION_WINDOW_MS = 10 * 60 * 1000; // 10 minutes window for mutual reactions
const MAX_Z_FOR_SCORE = 3.0; // z-score that maps to score 100

/**
 * Convert average z-score to cardiac_score 0-100
 * z=0 -> 0, z=MAX_Z_FOR_SCORE -> 100, clamped
 */
function zToCardiacScore(avgZ) {
  const score = (avgZ / MAX_Z_FOR_SCORE) * 100;
  return Math.min(100, Math.max(0, Math.round(score)));
}

/**
 * Check if a valid reaction from viewer_id -> target_id exists within window
 * Returns the best reaction doc or null
 */
async function getValidReaction(viewer_id, target_id) {
  const since = new Date(Date.now() - REACTION_WINDOW_MS);
  const reaction = await Reaction.findOne({
    viewer_id,
    target_id,
    confidence: { $gte: CONFIDENCE_THRESHOLD },
    created_at: { $gte: since }
  }).sort({ confidence: -1 }); // best confidence first
  return reaction;
}

/**
 * Core matching function - called after every valid reaction is saved
 * Checks if mutual reaction exists -> creates match
 *
 * viewerId: the user who just had a reaction
 * targetId: the user they were viewing
 *
 * Returns: { matched: bool, match: doc | null, reason: string }
 */
async function checkAndCreateMatch(viewerId, targetId) {
  logger.info({ msg: 'Checking match', viewerId, targetId });

  // Get A->B reaction (just saved)
  const aToBReaction = await getValidReaction(viewerId, targetId);
  if (!aToBReaction) {
    return { matched: false, match: null, reason: 'NO_VALID_A_TO_B_REACTION' };
  }

  // Get B->A reaction (reverse)
  const bToAReaction = await getValidReaction(targetId, viewerId);
  if (!bToAReaction) {
    logger.info({ msg: 'No reverse reaction yet', viewerId, targetId });
    return { matched: false, match: null, reason: 'WAITING_FOR_REVERSE_REACTION' };
  }

  // Both reactions valid - create match
  const avgZ = (aToBReaction.avg_z + bToAReaction.avg_z) / 2;
  const cardiac_score = zToCardiacScore(avgZ);

  const matchData = {
    user1_id: viewerId,
    user2_id: targetId,
    cardiac_score,
    a_to_b_z: aToBReaction.avg_z,
    b_to_a_z: bToAReaction.avg_z,
    a_to_b_confidence: aToBReaction.confidence,
    b_to_a_confidence: bToAReaction.confidence
  };

  // findOrCreateMatch handles dedup (A,B) == (B,A)
  const match = await Match.findOrCreateMatch(matchData);

  logger.info({
    msg: 'MATCH_CREATED',
    matchId: match._id,
    cardiac_score,
    a_to_b_z: aToBReaction.avg_z,
    b_to_a_z: bToAReaction.avg_z,
    reason: 'MUTUAL_VALID_REACTION'
  });

  return { matched: true, match, reason: 'MUTUAL_VALID_REACTION' };
}

/**
 * Get all matches for a user (for mobile app display)
 */
async function getUserMatches(userId) {
  return Match.find({
    $or: [{ user1_id: userId }, { user2_id: userId }]
  }).sort({ created_at: -1 });
}

module.exports = { checkAndCreateMatch, getUserMatches, zToCardiacScore, getValidReaction };
