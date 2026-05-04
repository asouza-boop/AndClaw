/**
 * Unit tests for src/lib/crypto.ts
 *
 * Tests (all 6 from sprint spec + 1 subprocess test):
 *  1. encrypt → decrypt round-trip returns original plaintext
 *  2. Two encrypt calls on same input produce different outputs (IV randomness)
 *  3. decrypt throws CryptoDecryptionError on malformed input
 *  4. decrypt throws CryptoDecryptionError on tampered ciphertext
 *  5. Persisted token differs from plaintext (simulate DB write)
 *  6. Retrieved token decrypts to original plaintext (simulate DB read)
 *  7. CryptoConfigError thrown if OAUTH_ENCRYPTION_KEY is missing (subprocess)
 *
 * Run:
 *   OAUTH_ENCRYPTION_KEY=<64hex> npx tsx src/lib/crypto.test.ts
 */

import assert from 'node:assert';
import { execSync } from 'node:child_process';
import crypto from 'node:crypto';

// Ensure a valid key is set before importing the module
if (!process.env.OAUTH_ENCRYPTION_KEY) {
  process.env.OAUTH_ENCRYPTION_KEY = crypto.randomBytes(32).toString('hex');
}

// Import synchronously (CJS-compatible)
import { encrypt, decrypt, CryptoDecryptionError } from './crypto';

let passed = 0;
let failed = 0;

function test(name: string, fn: () => void): void {
  try {
    fn();
    console.log(`  ✅ ${name}`);
    passed++;
  } catch (err: any) {
    console.error(`  ❌ ${name}`);
    console.error(`     ${err?.message ?? err}`);
    failed++;
  }
}

console.log('\n=== crypto.ts unit tests ===\n');

// 1. encrypt → decrypt round-trip
test('encrypt → decrypt round-trips correctly', () => {
  const original = 'ya29.super_secret_refresh_token_12345';
  assert.strictEqual(decrypt(encrypt(original)), original);
});

// 2. IV randomness
test('two encrypt calls on same input produce different ciphertext', () => {
  const original = 'same_plaintext_value';
  const enc1 = encrypt(original);
  const enc2 = encrypt(original);
  assert.notStrictEqual(enc1, enc2);
  assert.strictEqual(decrypt(enc1), original);
  assert.strictEqual(decrypt(enc2), original);
});

// 3. CryptoDecryptionError on malformed input (no colons)
test('decrypt throws CryptoDecryptionError on malformed input', () => {
  let threw = false;
  try {
    decrypt('not-an-encrypted-token');
  } catch (err: any) {
    threw = true;
    assert.strictEqual(err.name, 'CryptoDecryptionError');
  }
  assert.ok(threw, 'decrypt must throw CryptoDecryptionError on malformed input');
});

// 4. CryptoDecryptionError on tampered ciphertext
test('decrypt throws CryptoDecryptionError on tampered ciphertext', () => {
  const encrypted = encrypt('tamper me');
  const tampered = encrypted.slice(0, -4) + 'XXXX';
  let threw = false;
  try {
    decrypt(tampered);
  } catch (err: any) {
    threw = true;
    assert.strictEqual(err.name, 'CryptoDecryptionError');
  }
  assert.ok(threw, 'decrypt must throw when ciphertext is tampered (GCM auth tag mismatch)');
});

// 5. Persisted value differs from plaintext (DB write simulation)
test('encrypted value stored in DB differs from plaintext original', () => {
  const plaintext = 'ya29.real_google_oauth_refresh_token';
  const stored = encrypt(plaintext);
  assert.notStrictEqual(stored, plaintext);
  const colonCount = (stored.match(/:/g) ?? []).length;
  assert.strictEqual(colonCount, 2, 'Format must be iv:authTag:ciphertext (exactly 2 colons)');
});

// 6. Retrieved value decrypts to original (DB read simulation)
test('token retrieved from DB decrypts to original plaintext', () => {
  const original = 'ya29.real_google_oauth_refresh_token';
  const stored = encrypt(original);   // simulate INSERT
  const retrieved = decrypt(stored);  // simulate SELECT
  assert.strictEqual(retrieved, original);
});

// 7. CryptoConfigError when key is missing — run in subprocess for module isolation
test('module throws CryptoConfigError if OAUTH_ENCRYPTION_KEY is missing', () => {
  const env: NodeJS.ProcessEnv = { ...process.env };
  delete env.OAUTH_ENCRYPTION_KEY;

  let threw = false;
  let stderrOutput = '';
  try {
    execSync(
      `npx tsx -e "import('./src/lib/crypto.js').catch(e => { process.stderr.write(e.message); process.exit(1); })"`,
      { encoding: 'utf-8', stdio: 'pipe', env, cwd: process.cwd(), timeout: 20_000 }
    );
  } catch (err: any) {
    threw = true;
    stderrOutput = (err.stderr as string) ?? '';
  }

  assert.ok(threw, 'Process must exit with error when OAUTH_ENCRYPTION_KEY is missing');
  assert.ok(
    stderrOutput.includes('OAUTH_ENCRYPTION_KEY'),
    `Expected "OAUTH_ENCRYPTION_KEY" in stderr.\nGot: ${stderrOutput.slice(0, 400)}`
  );
});

// ── Summary ───────────────────────────────────────────────────────────────────
console.log(`\n========================================`);
console.log(`  Results: ${passed + failed} total | ${passed} passed | ${failed} failed`);
console.log(`========================================\n`);

if (failed > 0) process.exit(1);
