import { jest } from '@jest/globals';
import type { INestApplication } from '@nestjs/common';
import { ValidationPipe } from '@nestjs/common';
import { SwaggerModule } from '@nestjs/swagger';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { AppModule } from '../src/app.module.js';
import { PrismaExceptionFilter } from '../src/common/prisma-exception.filter.js';
import { StripPasswordHashInterceptor } from '../src/common/strip-password-hash.interceptor.js';
import { EmailService } from '../src/notifications/email.service.js';
import { buildOpenApiDocument } from '../src/swagger.js';
import {
  createFullWeekAvailability,
  createTestCoach,
  createTestEventType,
} from '../src/test/factories.js';
import {
  disconnectTestPrisma,
  resetDatabase,
} from '../src/test/prisma-test.util.js';
import { CoachRole, LocationType } from '@prisma/client';

jest.setTimeout(30_000);

describe('App (e2e)', () => {
  let app: INestApplication;
  const fakeEmailService = {
    send: jest.fn<() => Promise<void>>().mockResolvedValue(undefined),
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

      const unauthorized = await request(app.getHttpServer()).get('/coaches');
      expect(unauthorized.status).toBe(401);

      const login = await request(app.getHttpServer())
        .post('/auth/login')
        .send({
          email: 'e2e-coach2@example.com',
          password: 'correct-password',
        });
      const token = login.body.accessToken as string;

      const authorized = await request(app.getHttpServer())
        .get('/coaches')
        .set('Authorization', `Bearer ${token}`);
      expect(authorized.status).toBe(200);
      expect(Array.isArray(authorized.body)).toBe(true);
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
          startAt: '2026-10-01T10:00:00+02:00',
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

      const res = await request(app.getHttpServer())
        .get('/slots')
        .query({
          eventTypeId: eventType.id,
          from: '2026-10-01',
          to: '2026-10-01',
        });

      expect(res.status).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);
      expect(res.body.length).toBeGreaterThan(0);
    });

    it('lists active event types publicly, without leaking archived or another coach data shape', async () => {
      const coach = await createTestCoach();
      await createTestEventType(coach.id, {
        title: 'Active One',
        isActive: true,
      });
      await createTestEventType(coach.id, {
        title: 'Archived One',
        isActive: false,
      });

      const res = await request(app.getHttpServer()).get('/event-types');
      expect(res.status).toBe(200);
      const titles = res.body.map((e: { title: string }) => e.title);
      expect(titles).toContain('Active One');
      expect(titles).not.toContain('Archived One');
    });
  });

  describe('role-gated route', () => {
    it('rejects a non-admin coach creating a new coach', async () => {
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

      const res = await request(app.getHttpServer())
        .post('/coaches')
        .set('Authorization', `Bearer ${login.body.accessToken}`)
        .send({
          email: 'new-coach@example.com',
          name: 'New',
          password: 'a-real-password',
        });

      expect(res.status).toBe(403);
    });

    it('lets an admin coach create a new coach', async () => {
      await createTestCoach({
        email: 'admin@example.com',
        password: 'correct-password',
        role: CoachRole.ADMIN,
      });
      const login = await request(app.getHttpServer())
        .post('/auth/login')
        .send({ email: 'admin@example.com', password: 'correct-password' });

      const res = await request(app.getHttpServer())
        .post('/coaches')
        .set('Authorization', `Bearer ${login.body.accessToken}`)
        .send({
          email: 'new-coach@example.com',
          name: 'New',
          password: 'a-real-password',
        });

      expect(res.status).toBe(201);
      expect(res.body.email).toBe('new-coach@example.com');
      expect(res.body.passwordHash).toBeUndefined();
    });
  });
});
