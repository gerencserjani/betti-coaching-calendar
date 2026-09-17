import {
  type ArgumentsHost,
  Catch,
  ConflictException,
  type ExceptionFilter,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import type { Response } from 'express';

/**
 * Without this, a unique-constraint race (e.g. two concurrent coach-creation
 * requests for the same email) surfaces as a raw, unhandled 500 instead of a
 * clean 409 -- services generally check for duplicates before writing, but
 * that check-then-write isn't atomic, so the constraint itself is the real
 * backstop.
 */
@Catch(Prisma.PrismaClientKnownRequestError)
export class PrismaExceptionFilter implements ExceptionFilter {
  catch(exception: Prisma.PrismaClientKnownRequestError, host: ArgumentsHost) {
    if (exception.code === 'P2002') {
      const conflict = new ConflictException(
        'A record with that value already exists',
      );
      const response = host.switchToHttp().getResponse<Response>();
      response.status(conflict.getStatus()).json(conflict.getResponse());
      return;
    }
    // Anything else is unexpected here -- rethrow so Nest's default handler
    // logs it and returns a generic 500, rather than this filter silently
    // swallowing an error class it wasn't written to handle.
    throw exception;
  }
}
