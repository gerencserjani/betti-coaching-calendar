import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import { Observable, map } from 'rxjs';

/**
 * Defense-in-depth: Coach objects (and anything nesting one, e.g. a Booking's
 * `coach` relation) can reach a response handler with `passwordHash` still
 * attached. Strip it recursively from every response body rather than
 * relying on every call site remembering to select it out.
 */
@Injectable()
export class StripPasswordHashInterceptor implements NestInterceptor {
  intercept(
    _context: ExecutionContext,
    next: CallHandler,
  ): Observable<unknown> {
    return next.handle().pipe(map((body) => strip(body)));
  }
}

function strip(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map(strip);
  }
  if (value !== null && typeof value === 'object' && !(value instanceof Date)) {
    return Object.fromEntries(
      Object.entries(value)
        .filter(([key]) => key !== 'passwordHash')
        .map(([key, val]) => [key, strip(val)]),
    );
  }
  return value;
}
