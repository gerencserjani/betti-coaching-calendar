import { jest } from '@jest/globals';
import type { INestApplication } from '@nestjs/common';
import { ValidationPipe } from '@nestjs/common';
import { SwaggerModule } from '@nestjs/swagger';
import { Test } from '@nestjs/testing';
import { DateTime } from 'luxon';
import request from 'supertest';
import { AppModule } from '../src/app.module.js';
import { PrismaExceptionFilter } from '../src/common/prisma-exception.filter.js';
import { StripPasswordHashInterceptor } from '../src/common/strip-password-hash.interceptor.js';
import { EmailService } from '../src/notifications/email.service.js';
import { buildOpenApiDocument } from '../src/swagger.js';
import {
  createFullWeekAvailability,
  createTestAllowedOrigin,
  createTestCoach,
  createTestEventType,
} from '../src/test/factories.js';
import {
  disconnectTestPrisma,
  resetDatabase,
} from '../src/test/prisma-test.util.js';
import { CoachRole, LocationType } from '@prisma/client';

jest.setTimeout(30_000);

// Comfortably in the future (10 days clears the default 48h
// cancellationNoticeHours with margin), computed at test-run time rather
// than hardcoded -- a fixed calendar date goes stale once real time catches
// up to it, since booking creation rejects any startAt in the past.
const FUTURE_DAY = DateTime.now()
  .setZone('Europe/Budapest')
  .plus({ days: 10 })
  .startOf('day');

describe('App (e2e)', () => {
  let app: INestApplication;
  const fakeEmailService = {
    send: jest.fn<() => Promise<void>>().mockResolvedValue(undefined),
    sendRaw: jest.fn<() => Promise<void>>().mockResolvedValue(undefined),
  };

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(EmailService)
      .useValue(fakeEmailService)
      .compile();

    app = moduleRef.createNestApplication();
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
      }),
    );
    app.useGlobalInterceptors(new StripPasswordHashInterceptor());
    app.useGlobalFilters(new PrismaExceptionFilter());
    SwaggerModule.setup('docs', app, buildOpenApiDocument(app));
    await app.init();
  });

  afterAll(async () => {
    await app.close();
    await resetDatabase();
    await disconnectTestPrisma();
  });

  beforeEach(async () => {
    await resetDatabase();
    fakeEmailService.send.mockClear();
    fakeEmailService.sendRaw.mockClear();
  });

  it('GET /health returns ok', async () => {
    const res = await request(app.getHttpServer()).get('/health');
    expect(res.status).toBe(200);
  });

  it('GET /docs-json serves a valid OpenAPI document', async () => {
    const res = await request(app.getHttpServer()).get('/docs-json');
    expect(res.status).toBe(200);
    expect(res.body.info.title).toBe('Betti Coaching Calendar API');
    expect(res.body.paths['/bookings']).toBeDefined();
  });

  describe('auth', () => {
    it('logs in with valid credentials and rejects a bad password', async () => {
      await createTestCoach({
        email: 'e2e-coach@example.com',
        password: 'correct-password',
      });

      const ok = await request(app.getHttpServer())
        .post('/auth/login')
        .send({ email: 'e2e-coach@example.com', password: 'correct-password' });
      expect(ok.status).toBe(201);
      expect(ok.body.accessToken).toBeTruthy();
      expect(ok.body.coach.passwordHash).toBeUndefined();

      const bad = await request(app.getHttpServer())
        .post('/auth/login')
        .send({ email: 'e2e-coach@example.com', password: 'wrong-password' });
      expect(bad.status).toBe(401);
    });

    it('rejects a protected route with no token and accepts one with a valid token', async () => {
      await createTestCoach({
        email: 'e2e-coach2@example.com',
        password: 'correct-password',
      });

      const unauthorized = await request(app.getHttpServer()).get(
        '/coaches/me',
      );
      expect(unauthorized.status).toBe(401);

      const login = await request(app.getHttpServer())
        .post('/auth/login')
        .send({
          email: 'e2e-coach2@example.com',
          password: 'correct-password',
        });
      const token = login.body.accessToken as string;

      const authorized = await request(app.getHttpServer())
        .get('/coaches/me')
        .set('Authorization', `Bearer ${token}`);
      expect(authorized.status).toBe(200);
      expect(authorized.body.email).toBe('e2e-coach2@example.com');
    });
  });

  describe('public booking flow', () => {
    it('books a slot, fetches it by manage token, then cancels it', async () => {
      const coach = await createTestCoach();
      await createFullWeekAvailability(coach.id);
      const eventType = await createTestEventType(coach.id, {
        durationMinutes: 30,
        locations: [LocationType.PHONE],
      });

      const bookingRes = await request(app.getHttpServer())
        .post('/bookings')
        .send({
          eventTypeId: eventType.id,
          startAt: FUTURE_DAY.set({ hour: 10 }).toISO()!,
          location: LocationType.PHONE,
          clientName: 'E2E Client',
          clientEmail: 'e2e-client@example.com',
          clientPhone: '+36301234567',
          locale: 'en',
        });
      expect(bookingRes.status).toBe(201);
      const { manageToken, id } = bookingRes.body;
      expect(manageToken).toBeTruthy();

      const fetchRes = await request(app.getHttpServer()).get(
        `/bookings/manage/${manageToken}`,
      );
      expect(fetchRes.status).toBe(200);
      expect(fetchRes.body.id).toBe(id);
      expect(fetchRes.body.status).toBe('CONFIRMED');

      const cancelRes = await request(app.getHttpServer())
        .patch(`/bookings/manage/${manageToken}/cancel`)
        .send({ reason: 'e2e cancel' });
      expect(cancelRes.status).toBe(200);
      expect(cancelRes.body.status).toBe('CANCELLED');
    });

    it('rejects a booking request with an invalid payload', async () => {
      const res = await request(app.getHttpServer())
        .post('/bookings')
        .send({ eventTypeId: 'x' });
      expect(res.status).toBe(400);
    });

    it('lists available slots for an event type over a date range', async () => {
      const coach = await createTestCoach();
      await createFullWeekAvailability(coach.id);
      const eventType = await createTestEventType(coach.id, {
        durationMinutes: 30,
        locations: [LocationType.PHONE],
      });

      const res = await request(app.getHttpServer()).get('/slots').query({
        eventTypeId: eventType.id,
        from: FUTURE_DAY.toISODate(),
        to: FUTURE_DAY.toISODate(),
      });

      expect(res.status).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);
      expect(res.body.length).toBeGreaterThan(0);
    });

    it("lists one coach's active event types publicly, without leaking archived or another coach's catalog", async () => {
      const coach = await createTestCoach();
      await createTestEventType(coach.id, {
        title: 'Active One',
        isActive: true,
      });
      await createTestEventType(coach.id, {
        title: 'Archived One',
        isActive: false,
      });
      const otherCoach = await createTestCoach();
      await createTestEventType(otherCoach.id, {
        title: 'Other Coach Active',
        isActive: true,
      });

      const res = await request(app.getHttpServer())
        .get('/event-types')
        .query({ coachId: coach.id });
      expect(res.status).toBe(200);
      const titles = res.body.map((e: { title: string }) => e.title);
      expect(titles).toContain('Active One');
      expect(titles).not.toContain('Archived One');
      expect(titles).not.toContain('Other Coach Active');
    });

    it('rejects GET /event-types with no coachId', async () => {
      const res = await request(app.getHttpServer()).get('/event-types');
      expect(res.status).toBe(400);
    });
  });

  describe('role-gated route', () => {
    it('rejects a non-admin coach inviting a new coach', async () => {
      await createTestCoach({
        email: 'plain-coach@example.com',
        password: 'correct-password',
        role: CoachRole.COACH,
      });
      const login = await request(app.getHttpServer())
        .post('/auth/login')
        .send({
          email: 'plain-coach@example.com',
          password: 'correct-password',
        });

      const origin = await createTestAllowedOrigin();
      const res = await request(app.getHttpServer())
        .post('/coaches')
        .set('Authorization', `Bearer ${login.body.accessToken}`)
        .send({
          email: 'new-coach@example.com',
          name: 'New',
          frontendUrl: origin.origin,
        });

      expect(res.status).toBe(403);
    });

    it('lets an admin coach invite a new coach, without creating a Coach row yet', async () => {
      await createTestCoach({
        email: 'admin@example.com',
        password: 'correct-password',
        role: CoachRole.ADMIN,
      });
      const login = await request(app.getHttpServer())
        .post('/auth/login')
        .send({ email: 'admin@example.com', password: 'correct-password' });

      const origin = await createTestAllowedOrigin();
      const res = await request(app.getHttpServer())
        .post('/coaches')
        .set('Authorization', `Bearer ${login.body.accessToken}`)
        .send({
          email: 'new-coach@example.com',
          name: 'New',
          frontendUrl: origin.origin,
        });

      expect(res.status).toBe(204);
      expect(fakeEmailService.sendRaw).toHaveBeenCalledTimes(1);

      const created = await request(app.getHttpServer())
        .get('/coaches')
        .set('Authorization', `Bearer ${login.body.accessToken}`);
      expect(
        created.body.some(
          (c: { email: string }) => c.email === 'new-coach@example.com',
        ),
      ).toBe(false);
    });

    it('rejects inviting a coach to a site that already has one', async () => {
      await createTestCoach({
        email: 'admin3@example.com',
        password: 'correct-password',
        role: CoachRole.ADMIN,
      });
      const login = await request(app.getHttpServer())
        .post('/auth/login')
        .send({ email: 'admin3@example.com', password: 'correct-password' });
      const origin = await createTestAllowedOrigin();
      await createTestCoach({ frontendUrl: origin.origin });

      const res = await request(app.getHttpServer())
        .post('/coaches')
        .set('Authorization', `Bearer ${login.body.accessToken}`)
        .send({
          email: 'another-new-coach@example.com',
          name: 'Another',
          frontendUrl: origin.origin,
        });

      expect(res.status).toBe(409);
    });

    it('rejects inviting a coach to a site that is not an allowed origin', async () => {
      await createTestCoach({
        email: 'admin4@example.com',
        password: 'correct-password',
        role: CoachRole.ADMIN,
      });
      const login = await request(app.getHttpServer())
        .post('/auth/login')
        .send({ email: 'admin4@example.com', password: 'correct-password' });

      const res = await request(app.getHttpServer())
        .post('/coaches')
        .set('Authorization', `Bearer ${login.body.accessToken}`)
        .send({
          email: 'another-new-coach2@example.com',
          name: 'Another',
          frontendUrl: 'https://not-allow-listed.example.com',
        });

      expect(res.status).toBe(404);
    });
  });

  describe('coach invite -> accept flow', () => {
    it('lets an invited coach set their password and log in, end to end', async () => {
      await createTestCoach({
        email: 'admin2@example.com',
        password: 'correct-password',
        role: CoachRole.ADMIN,
      });
      const login = await request(app.getHttpServer())
        .post('/auth/login')
        .send({ email: 'admin2@example.com', password: 'correct-password' });

      const origin = await createTestAllowedOrigin();
      await request(app.getHttpServer())
        .post('/coaches')
        .set('Authorization', `Bearer ${login.body.accessToken}`)
        .send({
          email: 'invited@example.com',
          name: 'Invited Coach',
          frontendUrl: origin.origin,
        });

      const { html } = fakeEmailService.sendRaw.mock.calls[0][0] as {
        html: string;
      };
      const token = new URL(
        /href="([^"]+)"/.exec(html)![1].replace(/&amp;/g, '&'),
      ).searchParams.get('token')!;

      const accepted = await request(app.getHttpServer())
        .post('/coaches/accept-invite')
        .send({ token, password: 'a-brand-new-password' });

      expect(accepted.status).toBe(201);
      expect(accepted.body.coach.email).toBe('invited@example.com');
      expect(accepted.body.accessToken).toBeDefined();

      expect(accepted.body.coach.frontendUrl).toBe(origin.origin);

      const relogin = await request(app.getHttpServer())
        .post('/auth/login')
        .send({
          email: 'invited@example.com',
          password: 'a-brand-new-password',
        });
      expect(relogin.status).toBe(201);

      const replay = await request(app.getHttpServer())
        .post('/coaches/accept-invite')
        .send({ token, password: 'another-password' });
      expect(replay.status).toBe(409);
    });
  });

  describe('forgot password -> reset flow', () => {
    it('lets a coach reset her password end to end, revoking her old session', async () => {
      const coach = await createTestCoach({
        email: 'forgetful@example.com',
        password: 'the-old-password',
        frontendUrl: 'https://forgetful-coach.example.com',
      });
      const oldLogin = await request(app.getHttpServer())
        .post('/auth/login')
        .send({ email: 'forgetful@example.com', password: 'the-old-password' });
      expect(oldLogin.status).toBe(201);

      const forgot = await request(app.getHttpServer())
        .post('/auth/forgot-password')
        .send({ email: 'forgetful@example.com' });
      expect(forgot.status).toBe(204);

      const { html } = fakeEmailService.sendRaw.mock.calls[0][0] as {
        html: string;
      };
      expect(html).toContain('forgetful-coach.example.com');
      const token = new URL(
        /href="([^"]+)"/.exec(html)![1].replace(/&amp;/g, '&'),
      ).searchParams.get('token')!;

      const reset = await request(app.getHttpServer())
        .post('/auth/reset-password')
        .send({ token, newPassword: 'a-brand-new-password' });
      expect(reset.status).toBe(201);
      expect(reset.body.coach.email).toBe('forgetful@example.com');

      // The session from before the reset no longer works.
      const staleSession = await request(app.getHttpServer())
        .get('/coaches/me')
        .set('Authorization', `Bearer ${oldLogin.body.accessToken}`);
      expect(staleSession.status).toBe(401);

      // The access token the reset itself returned, issued after the
      // revocation timestamp, still works.
      const freshSession = await request(app.getHttpServer())
        .get('/coaches/me')
        .set('Authorization', `Bearer ${reset.body.accessToken}`);
      expect(freshSession.status).toBe(200);
      expect(freshSession.body.id).toBe(coach.id);

      const relogin = await request(app.getHttpServer())
        .post('/auth/login')
        .send({
          email: 'forgetful@example.com',
          password: 'a-brand-new-password',
        });
      expect(relogin.status).toBe(201);

      // The same reset link can't be replayed to overwrite the password again.
      const replay = await request(app.getHttpServer())
        .post('/auth/reset-password')
        .send({ token, newPassword: 'yet-another-password' });
      expect(replay.status).toBe(401);
    });

    it('responds identically (204, no email sent) for an email with no account -- no enumeration', async () => {
      const res = await request(app.getHttpServer())
        .post('/auth/forgot-password')
        .send({ email: 'no-such-coach@example.com' });

      expect(res.status).toBe(204);
      expect(fakeEmailService.sendRaw).not.toHaveBeenCalled();
    });

    it('rejects an invalid or expired reset token', async () => {
      const res = await request(app.getHttpServer())
        .post('/auth/reset-password')
        .send({ token: 'not-a-real-token', newPassword: 'whatever123' });
      expect(res.status).toBe(401);
    });
  });
});
