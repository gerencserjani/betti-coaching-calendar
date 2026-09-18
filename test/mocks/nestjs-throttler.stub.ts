import {
  Injectable,
  Module,
  type CanActivate,
  type DynamicModule,
} from '@nestjs/common';

/**
 * Test-only stand-in for @nestjs/throttler - see the comment in
 * jest-e2e.config.cjs's moduleNameMapper for why the real package can't be
 * loaded under Jest's ESM runtime. Rate limiting is third-party behavior,
 * not something these e2e specs need to exercise for real.
 */
@Injectable()
export class ThrottlerGuard implements CanActivate {
  canActivate(): boolean {
    return true;
  }
}

@Module({})
class StubThrottlerModule {}

export const ThrottlerModule = {
  forRoot(): DynamicModule {
    return { module: StubThrottlerModule };
  },
};

export function Throttle(...args: unknown[]): MethodDecorator {
  void args;
  return () => {};
}
