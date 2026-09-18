import { PasswordService } from './password.service.js';

describe('PasswordService', () => {
  const service = new PasswordService();

  it('hashes a password so it no longer resembles the plaintext', async () => {
    const hash = await service.hash('correct horse battery staple');
    expect(hash).not.toBe('correct horse battery staple');
    expect(hash.length).toBeGreaterThan(20);
  });

  it('produces different hashes for the same input (random salt)', async () => {
    const [a, b] = await Promise.all([
      service.hash('same-password'),
      service.hash('same-password'),
    ]);
    expect(a).not.toBe(b);
  });

  it('compare() accepts the correct password against its hash', async () => {
    const hash = await service.hash('my-real-password');
    await expect(service.compare('my-real-password', hash)).resolves.toBe(true);
  });

  it('compare() rejects an incorrect password', async () => {
    const hash = await service.hash('my-real-password');
    await expect(service.compare('wrong-password', hash)).resolves.toBe(false);
  });
});
