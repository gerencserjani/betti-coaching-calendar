import { PrismaPg } from '@prisma/adapter-pg';
import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';

@Injectable()
export class PrismaService
  extends PrismaClient
  implements OnModuleInit, OnModuleDestroy
{
  constructor() {
    super({
      // DATABASE_POOLER_URL in production (Neon's pooled endpoint -- see
      // README "Production hosting"); falls back to DATABASE_URL for local
      // dev/test, which has no pooled/direct distinction.
      adapter: new PrismaPg({
        connectionString:
          process.env.DATABASE_POOLER_URL ?? process.env.DATABASE_URL,
      }),
    });
  }

  async onModuleInit() {
    await this.$connect();
  }

  async onModuleDestroy() {
    await this.$disconnect();
  }
}
