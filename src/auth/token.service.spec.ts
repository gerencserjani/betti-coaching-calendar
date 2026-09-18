import { UnauthorizedException } from '@nestjs/common';
import type { ConfigService } from '@nestjs/config';
import { CoachRole } from '@prisma/client';
import { TokenService } from './token.service.js';

function fakeConfigService(jwtSecret: string): ConfigService {
  return { get: () => ({ jwtSecret }) } as unknown as ConfigService;
}

describe('TokenService', () => {
  const service = new TokenService(
    fakeConfigService('unit-test-secret-at-least-32-chars-long'),
  );

  describe('access tokens', () => {
    it('signs a token that verify() can decode back to the same payload', () => {
      const token = service.sign({
        sub: 'coach-1',
        email: 'coach@example.com',
        role: CoachRole.COACH,
      });
      const decoded = service.verify(token);
      expect(decoded.sub).toBe('coach-1');
      expect(decoded.email).toBe('coach@example.com');
      expect(decoded.role).toBe(CoachRole.COACH);
      expect(decoded.iat).toEqual(expect.any(Number));
    });

    it('rejects a garbage token', () => {
      expect(() => service.verify('not-a-real-jwt')).toThrow(
        UnauthorizedException,
      );
    });

    it('rejects a token signed with a different secret', () => {
      const otherService = new TokenService(
        fakeConfigService('a-totally-different-secret-32-chars'),
      );
      const token = otherService.sign({
        sub: 'coach-1',
        email: 'coach@example.com',
        role: CoachRole.COACH,
      });
      expect(() => service.verify(token)).toThrow(UnauthorizedException);
    });
  });

  describe('Google connect state tokens', () => {
    it('accepts a freshly signed state token', () => {
      const token = service.signGoogleConnectState('admin-coach-id');
      expect(() => service.verifyGoogleConnectState(token)).not.toThrow();
    });

    it('rejects a garbage state token', () => {
      expect(() => service.verifyGoogleConnectState('nope')).toThrow(
        UnauthorizedException,
      );
    });

    it("rejects a regular access token presented as a connect-state token (wrong 'purpose')", () => {
      const accessToken = service.sign({
        sub: 'coach-1',
        email: 'coach@example.com',
        role: CoachRole.ADMIN,
      });
      expect(() => service.verifyGoogleConnectState(accessToken)).toThrow(
        UnauthorizedException,
      );
    });
  });
});
