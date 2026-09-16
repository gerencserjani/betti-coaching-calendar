import type { Coach } from '@prisma/client';

declare module 'express' {
  interface Request {
    coach?: Coach;
  }
}
