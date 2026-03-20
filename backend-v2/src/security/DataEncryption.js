/**
 * DataEncryption.js
 * AES-256-GCM application-level encryption for sensitive biometric fields.
 * Per spec: encrypts baseline_mean and baseline_std at rest.
 * Uses Node.js built-in crypto module — no external dependencies.
 */
const crypto = require('crypto');

const ALGORITHM = 'aes-256-gcm';
const KEY_LENGTH = 32; // 256 bits
const IV_LENGTH = 16;  // 128 bits
const AUTH_TAG_LENGTH = 16; // 128 bits

// Encryption key from environment variable (must be 32-byte hex or base64)
function getKey() {
  const raw = process.env.ENCRYPTION_KEY;
  if (!raw) {
    if (process.env.NODE_ENV === 'production') {
      throw new Error('ENCRYPTION_KEY environment variable is required in production');
    }
    // Development fallback — NOT safe for production
    return crypto.scryptSync('dev-key-change-in-production', 'heartsync-salt', KEY_LENGTH);
  }
  // Accept hex (64 chars) or base64 (44 chars)
  if (raw.length === 64) return Buffer.from(raw, 'hex');
  if (raw.length === 44) return Buffer.from(raw, 'base64');
  // Accept raw 32-byte string
  const buf = Buffer.from(raw);
  if (buf.length === KEY_LENGTH) return buf;
  throw new Error('ENCRYPTION_KEY must be 32 bytes (as hex, base64, or raw string)');
}

/**
 * Encrypt a value using AES-256-GCM.
 * @param {string|number} value - plaintext value to encrypt
 * @returns {string} encrypted payload as JSON string: {iv, ciphertext, tag}
 */
function encrypt(value) {
  const key = getKey();
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv, { authTagLength: AUTH_TAG_LENGTH });

  const plaintext = String(value);
  const encrypted = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();

  return JSON.stringify({
    iv: iv.toString('base64'),
    ciphertext: encrypted.toString('base64'),
    tag: tag.toString('base64'),
  });
}

/**
 * Decrypt a value encrypted with encrypt().
 * @param {string} encryptedPayload - JSON string from encrypt()
 * @returns {string} decrypted plaintext
 */
function decrypt(encryptedPayload) {
  const key = getKey();
  const { iv, ciphertext, tag } = JSON.parse(encryptedPayload);

  const decipher = crypto.createDecipheriv(
    ALGORITHM,
    key,
    Buffer.from(iv, 'base64'),
    { authTagLength: AUTH_TAG_LENGTH }
  );
  decipher.setAuthTag(Buffer.from(tag, 'base64'));

  const decrypted = Buffer.concat([
    decipher.update(Buffer.from(ciphertext, 'base64')),
    decipher.final(),
  ]);

  return decrypted.toString('utf8');
}

/**
 * Encrypt a numeric value, return encrypted string.
 * Convenience wrapper for baseline_mean / baseline_std.
 */
function encryptNumber(num) {
  if (num === null || num === undefined) return null;
  return encrypt(num);
}

/**
 * Decrypt an encrypted numeric field and return as float.
 */
function decryptNumber(encryptedPayload) {
  if (!encryptedPayload) return null;
  try {
    return parseFloat(decrypt(encryptedPayload));
  } catch (e) {
    // If already a plain number (migration case), return as-is
    const num = parseFloat(encryptedPayload);
    if (!isNaN(num)) return num;
    throw e;
  }
}

/**
 * Encrypt multiple fields in an object.
 * @param {Object} obj - source object
 * @param {string[]} fields - field names to encrypt
 * @returns {Object} new object with encrypted fields
 */
function encryptFields(obj, fields) {
  const result = { ...obj };
  for (const field of fields) {
    if (result[field] !== undefined && result[field] !== null) {
      result[field] = encrypt(String(result[field]));
    }
  }
  return result;
}

/**
 * Decrypt multiple fields in an object.
 * @param {Object} obj - source object with encrypted fields
 * @param {string[]} fields - field names to decrypt
 * @returns {Object} new object with decrypted fields
 */
function decryptFields(obj, fields) {
  const result = { ...obj };
  for (const field of fields) {
    if (result[field] !== undefined && result[field] !== null) {
      try {
        result[field] = decrypt(result[field]);
      } catch {
        // Leave encrypted if decryption fails (key rotation scenario)
      }
    }
  }
  return result;
}

/**
 * Verify the encryption key is properly configured.
 * Call at application startup.
 */
function verifyKeyConfiguration() {
  try {
    const key = getKey();
    if (key.length !== KEY_LENGTH) throw new Error('Invalid key length');
    // Test round-trip
    const testPlain = 'encryption-test-72.5';
    const enc = encrypt(testPlain);
    const dec = decrypt(enc);
    if (dec !== testPlain) throw new Error('Encryption round-trip failed');
    return true;
  } catch (e) {
    console.error('DataEncryption key verification failed:', e.message);
    return false;
  }
}

module.exports = {
  encrypt,
  decrypt,
  encryptNumber,
  decryptNumber,
  encryptFields,
  decryptFields,
  verifyKeyConfiguration,
  // Biometric-specific helpers
  BIOMETRIC_FIELDS: ['baseline_mean', 'baseline_std'],
};
