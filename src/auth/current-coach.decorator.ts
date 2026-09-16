import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import type { Request } from 'express';
import type { Coach } from '@prisma/client';

export const CurrentCoach = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): Coach => {
    const request = ctx.switchToHttp().getRequest<Request>();
    return request.coach!;
  },
);
