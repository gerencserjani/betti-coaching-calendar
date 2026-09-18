import { randomBytes } from 'node:crypto';
import { decrypt, encrypt } from './crypto.util.js';

const KEY = randomBytes(32).toString('base64');

describe('crypto.util (AES-256-GCM encrypt/decrypt)', () => {
  it('round-trips a plaintext string', () => {
    const plainText = 'a google refresh token that must not leak';
    const encrypted = encrypt(plainText, KEY);
    expect(encrypted).not.toContain(plainText);
    expect(decrypt(encrypted, KEY)).toBe(plainText);
  });

  it('produces a different ciphertext each time (random IV), even for the same input', () => {
    const a = encrypt('same plaintext', KEY);
    const b = encrypt('same plaintext', KEY);
    expect(a).not.toBe(b);
  });

  it('fails to decrypt with the wrong key', () => {
    const encrypted = encrypt('secret value', KEY);
    const wrongKey = randomBytes(32).toString('base64');
    expect(() => decrypt(encrypted, wrongKey)).toThrow();
  });

  it('fails to decrypt tampered ciphertext (GCM auth tag catches it)', () => {
    const encrypted = encrypt('secret value', KEY);
    const bytes = Buffer.from(encrypted, 'base64');
    bytes[bytes.length - 1] ^= 0xff; // flip the last byte
    const tampered = bytes.toString('base64');
    expect(() => decrypt(tampered, KEY)).toThrow();
  });
});
