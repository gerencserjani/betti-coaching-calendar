import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { PgBoss } from 'pg-boss';

/**
 * Thin lifecycle wrapper around a single PgBoss instance, shared by every
 * queue in the app. Reuses the same Postgres DATABASE_URL as Prisma - pg-boss
 * manages its own small connection pool and Postgres schema (`pgboss` by
 * default) alongside the Prisma-managed `public` schema.
 *
 * No scheduler/cron drives this: `start()` here just lets pg-boss's own
 * internal supervisor run for as long as this process instance happens to be
 * alive (see README "Background jobs" for why that's an intentional choice,
 * not an oversight, on Cloud Run's scale-to-zero hosting).
 */
@Injectable()
export class PgBossService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(PgBossService.name);
  readonly boss = new PgBoss({ connectionString: process.env.DATABASE_URL });

  async onModuleInit(): Promise<void> {
    this.boss.on('error', (error: unknown) =>
      this.logger.error('pg-boss error', error),
    );
    await this.boss.start();
  }

  async onModuleDestroy(): Promise<void> {
    // Best-effort graceful drain; Cloud Run only gives a short grace period
    // before SIGKILL on scale-down, so this must not hang indefinitely.
    await this.boss.stop({ graceful: true, timeout: 10_000 }).catch(() => {});
  }
}
