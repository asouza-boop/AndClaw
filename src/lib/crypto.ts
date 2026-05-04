import crypto from 'crypto';

export class CryptoConfigError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'CryptoConfigError';
  }
}

export class CryptoDecryptionError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'CryptoDecryptionError';
  }
}

const ENCRYPTION_KEY_HEX = process.env.OAUTH_ENCRYPTION_KEY;

if (!ENCRYPTION_KEY_HEX) {
  throw new CryptoConfigError('OAUTH_ENCRYPTION_KEY is missing');
}

if (ENCRYPTION_KEY_HEX.length !== 64) {
  throw new CryptoConfigError('OAUTH_ENCRYPTION_KEY must be exactly 64 hex characters (32 bytes)');
}

const ENCRYPTION_KEY = Buffer.from(ENCRYPTION_KEY_HEX, 'hex');

if (ENCRYPTION_KEY.length !== 32) {
  throw new CryptoConfigError('OAUTH_ENCRYPTION_KEY must decode to exactly 32 bytes');
}

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 12; // Standard for GCM

export function encrypt(plaintext: string): string {
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv(ALGORITHM, ENCRYPTION_KEY, iv);
  
  let ciphertext = cipher.update(plaintext, 'utf8', 'base64');
  ciphertext += cipher.final('base64');
  
  const authTag = cipher.getAuthTag().toString('base64');
  
  return `${iv.toString('base64')}:${authTag}:${ciphertext}`;
}

export function decrypt(encoded: string): string {
  const parts = encoded.split(':');
  if (parts.length !== 3) {
    throw new CryptoDecryptionError('Invalid encrypted format');
  }

  const [ivBase64, authTagBase64, ciphertextBase64] = parts;

  try {
    const iv = Buffer.from(ivBase64, 'base64');
    const authTag = Buffer.from(authTagBase64, 'base64');
    const decipher = crypto.createDecipheriv(ALGORITHM, ENCRYPTION_KEY, iv);
    
    decipher.setAuthTag(authTag);
    
    let plaintext = decipher.update(ciphertextBase64, 'base64', 'utf8');
    plaintext += decipher.final('utf8');
    
    return plaintext;
  } catch (err) {
    throw new CryptoDecryptionError('Decryption failed');
  }
}
