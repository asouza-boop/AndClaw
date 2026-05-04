/**
 * Migration: 20260501_encrypt_oauth_tokens
 *
 * Encrypts any plaintext refresh_token rows in oauth_tokens in-place.
 * Idempotent: rows whose refresh_token already matches the iv:authTag:ciphertext
 * format (contains exactly 2 colons) are skipped.
 *
 * Run once on each environment after deploying the crypto.ts helper.
 */

import { getPool } from '../postgres';
import { encrypt } from '../../lib/crypto';

const ENCRYPTED_FORMAT = /^[A-Za-z0-9+/=]+:[A-Za-z0-9+/=]+:[A-Za-z0-9+/=]+$/;

function isAlreadyEncrypted(token: string): boolean {
  // An AES-256-GCM token encoded as base64:base64:base64 will have exactly 2 colons.
  // Plain Google OAuth refresh tokens never contain colons.
  const colonCount = (token.match(/:/g) || []).length;
  return colonCount === 2 && ENCRYPTED_FORMAT.test(token);
}

async function run() {
  const pool = getPool();
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    const { rows } = await client.query<{ id: string; refresh_token: string }>(
      `SELECT id, refresh_token FROM oauth_tokens`
    );

    let migrated = 0;
    let skipped = 0;

    for (const row of rows) {
      if (isAlreadyEncrypted(row.refresh_token)) {
        skipped++;
        continue;
      }

      const encrypted = encrypt(row.refresh_token);

      await client.query(
        `UPDATE oauth_tokens SET refresh_token = $1 WHERE id = $2`,
        [encrypted, row.id]
      );
      migrated++;
    }

    await client.query('COMMIT');

    console.log(
      `[migration] 20260501_encrypt_oauth_tokens: ${migrated} rows encrypted, ${skipped} rows skipped (already encrypted).`
    );
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('[migration] 20260501_encrypt_oauth_tokens: ROLLBACK due to error:', err);
    throw err;
  } finally {
    client.release();
  }
}

run().catch((err) => {
  console.error('[migration] Fatal:', err);
  process.exit(1);
});
