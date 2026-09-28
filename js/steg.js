import { decodePacket, encodePacket, validateTrajectory } from './trajectory.js';
import { fail } from './errors.js';

export const FORMAT = 'steg2048-web-v1';
export const MAX_MESSAGE_BYTES = 96;
export const MIN_PASSWORD_CHARS = 8;
export const PBKDF2_ITERATIONS = 250000;

const MAGIC = new TextEncoder().encode('S8W1');
const SALT_BYTES = 16;
const NONCE_BYTES = 12;
const LENGTH_BYTES = 2;
const HEADER_BYTES = MAGIC.length + SALT_BYTES + NONCE_BYTES + LENGTH_BYTES;
const LENGTH_OFFSET = MAGIC.length + SALT_BYTES + NONCE_BYTES;

function concatBytes(...arrays) {
  const total = arrays.reduce((sum, array) => sum + array.length, 0);
  const out = new Uint8Array(total);
  let offset = 0;
  for (const array of arrays) { out.set(array, offset); offset += array.length; }
  return out;
}

function uint16be(value) {
  return new Uint8Array([(value >>> 8) & 0xff, value & 0xff]);
}

function readUint16be(bytes, offset) {
  return (bytes[offset] << 8) | bytes[offset + 1];
}

function validatePassword(password) {
  if (typeof password !== 'string') fail('PASSWORD_NOT_TEXT');
  if (password.length < MIN_PASSWORD_CHARS) fail('PASSWORD_TOO_SHORT', { min: MIN_PASSWORD_CHARS });
}

async function deriveAesKey(password, salt) {
  const baseKey = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(password),
    'PBKDF2',
    false,
    ['deriveKey'],
  );
  return crypto.subtle.deriveKey(
    { name: 'PBKDF2', hash: 'SHA-256', salt, iterations: PBKDF2_ITERATIONS },
    baseKey,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt'],
  );
}

export async function encodeMessage(message, password) {
  if (typeof message !== 'string') fail('MESSAGE_NOT_TEXT');
  const payload = new TextEncoder().encode(message);
  if (payload.length > MAX_MESSAGE_BYTES) fail('MESSAGE_TOO_LONG', { max: MAX_MESSAGE_BYTES });
  validatePassword(password);

  const salt = crypto.getRandomValues(new Uint8Array(SALT_BYTES));
  const nonce = crypto.getRandomValues(new Uint8Array(NONCE_BYTES));
  const key = await deriveAesKey(password, salt);
  const ciphertextLength = payload.length + 16;
  const lengthBytes = uint16be(ciphertextLength);
  const aad = concatBytes(MAGIC, lengthBytes);
  const ciphertext = new Uint8Array(await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv: nonce, additionalData: aad, tagLength: 128 },
    key,
    payload,
  ));

  const packet = concatBytes(MAGIC, salt, nonce, lengthBytes, ciphertext);
  const encoded = encodePacket(packet);
  return { boards: encoded.boards, trajectory: validateTrajectory(encoded.boards) };
}

export async function decodeBoards(boards, password) {
  validatePassword(password);
  const decoded = decodePacket(boards, {
    headerBytes: HEADER_BYTES,
    expectedMagic: MAGIC,
    lengthOffset: LENGTH_OFFSET,
    lengthBytes: LENGTH_BYTES,
  });
  const raw = decoded.raw;
  const saltStart = MAGIC.length;
  const saltEnd = saltStart + SALT_BYTES;
  const nonceEnd = saltEnd + NONCE_BYTES;
  const lengthEnd = nonceEnd + LENGTH_BYTES;
  const salt = raw.slice(saltStart, saltEnd);
  const nonce = raw.slice(saltEnd, nonceEnd);
  const lengthBytes = raw.slice(nonceEnd, lengthEnd);
  const ciphertextLength = readUint16be(raw, nonceEnd);
  if (ciphertextLength < 16 || ciphertextLength > MAX_MESSAGE_BYTES + 16) fail('CIPHERTEXT_LENGTH_INVALID');
  const ciphertext = raw.slice(lengthEnd, lengthEnd + ciphertextLength);
  const key = await deriveAesKey(password, salt);

  let plaintext;
  try {
    plaintext = await crypto.subtle.decrypt(
      { name: 'AES-GCM', iv: nonce, additionalData: concatBytes(MAGIC, lengthBytes), tagLength: 128 },
      key,
      ciphertext,
    );
  } catch {
    fail('AUTH_FAILED');
  }

  try {
    const message = new TextDecoder('utf-8', { fatal: true }).decode(plaintext);
    return { message, trajectory: validateTrajectory(boards) };
  } catch {
    fail('PLAINTEXT_UTF8_INVALID');
  }
}
