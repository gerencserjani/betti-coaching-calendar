import { Injectable, Logger, type NestMiddleware } from '@nestjs/common';
import type { NextFunction, Request, Response } from 'express';

/**
 * One line per request, after it finishes (so the status code and duration
 * are known, and `req.coach` -- set by JwtAuthGuard, which runs after this
 * middleware but before the handler -- is populated by the time we read it).
 * Written via Nest's own Logger, which writes structured lines to stdout;
 * on Cloud Run that's picked up by Cloud Logging automatically, so this
 * needs no separate log file or shipping setup.
 */
@Injectable()
export class RequestLoggingMiddleware implements NestMiddleware {
  private readonly logger = new Logger('HTTP');

  use(req: Request, res: Response, next: NextFunction): void {
    const start = Date.now();
    res.on('finish', () => {
      const durationMs = Date.now() - start;
      const coachId = req.coach?.id;
      const message = `${req.method} ${req.originalUrl} ${res.statusCode} ${durationMs}ms${coachId ? ` coach=${coachId}` : ''}`;
      if (res.statusCode >= 500) {
        this.logger.error(message);
      } else if (res.statusCode >= 400) {
        this.logger.warn(message);
      } else {
        this.logger.log(message);
      }
    });
    next();
  }
}
