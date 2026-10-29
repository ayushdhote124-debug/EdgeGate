// API key helpers.
// Format: eg_live_ + 32 random base62 characters. The raw key is shown once;
// MongoDB stores only its SHA-256 hash plus a short display prefix.
import { createHash, randomInt } from 'node:crypto';

const ALPHABET = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz';
export const KEY_PREFIX = 'eg_live_';
const RANDOM_LENGTH = 32;
const DISPLAY_PREFIX_LENGTH = 12;

export function generateApiKey() {
  let random = '';
  // randomInt uses the cryptographically secure RNG and avoids modulo bias
  for (let i = 0; i < RANDOM_LENGTH; i++) random += ALPHABET[randomInt(ALPHABET.length)];
  const rawKey = KEY_PREFIX + random;
  return { rawKey, keyHash: hashApiKey(rawKey), prefix: rawKey.slice(0, DISPLAY_PREFIX_LENGTH) };
}

export function hashApiKey(rawKey) {
  return createHash('sha256').update(rawKey, 'utf8').digest('hex');
}

export function looksLikeApiKey(value) {
  return (
    typeof value === 'string' &&
    value.startsWith(KEY_PREFIX) &&
    value.length === KEY_PREFIX.length + RANDOM_LENGTH &&
    /^[0-9A-Za-z]+$/.test(value.slice(KEY_PREFIX.length))
  );
}