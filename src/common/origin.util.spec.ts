import { isLocalhostOrigin } from './origin.util.js';

describe('isLocalhostOrigin', () => {
  it('allows http://localhost with any port', () => {
    expect(isLocalhostOrigin('http://localhost:5173')).toBe(true);
    expect(isLocalhostOrigin('http://localhost:3000')).toBe(true);
    expect(isLocalhostOrigin('http://localhost')).toBe(true);
  });

  it('allows https://localhost', () => {
    expect(isLocalhostOrigin('https://localhost:4000')).toBe(true);
  });

  it('allows 127.0.0.1', () => {
    expect(isLocalhostOrigin('http://127.0.0.1:5173')).toBe(true);
  });

  it('allows the IPv6 loopback address', () => {
    expect(isLocalhostOrigin('http://[::1]:5173')).toBe(true);
  });

  it('rejects a deployed origin', () => {
    expect(isLocalhostOrigin('https://betti-coaching.vercel.app')).toBe(false);
  });

  it('rejects a hostname that merely contains "localhost"', () => {
    expect(isLocalhostOrigin('https://notlocalhost.example.com')).toBe(false);
  });

  it('returns false for a malformed origin instead of throwing', () => {
    expect(isLocalhostOrigin('not-a-url')).toBe(false);
  });
});
