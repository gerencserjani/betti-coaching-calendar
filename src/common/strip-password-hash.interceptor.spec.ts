import type { CallHandler, ExecutionContext } from '@nestjs/common';
import { firstValueFrom, of } from 'rxjs';
import { StripPasswordHashInterceptor } from './strip-password-hash.interceptor.js';

const fakeContext = {} as ExecutionContext;

function handlerReturning(value: unknown): CallHandler {
  return { handle: () => of(value) };
}

async function run(
  interceptor: StripPasswordHashInterceptor,
  value: unknown,
): Promise<unknown> {
  return firstValueFrom(
    interceptor.intercept(fakeContext, handlerReturning(value)),
  );
}

describe('StripPasswordHashInterceptor', () => {
  const interceptor = new StripPasswordHashInterceptor();

  it('strips passwordHash from a flat object', async () => {
    const result = await run(interceptor, {
      id: '1',
      email: 'a@b.com',
      passwordHash: 'secret',
    });
    expect(result).toEqual({ id: '1', email: 'a@b.com' });
  });

  it('strips passwordHash from a nested relation (e.g. Booking.coach)', async () => {
    const result = await run(interceptor, {
      id: 'booking-1',
      coach: { id: 'coach-1', passwordHash: 'secret' },
    });
    expect(result).toEqual({ id: 'booking-1', coach: { id: 'coach-1' } });
  });

  it('strips passwordHash from every item in an array response', async () => {
    const result = await run(interceptor, [
      { id: '1', passwordHash: 'secret1' },
      { id: '2', passwordHash: 'secret2' },
    ]);
    expect(result).toEqual([{ id: '1' }, { id: '2' }]);
  });

  it('leaves Date instances untouched instead of flattening them to plain objects', async () => {
    const date = new Date('2026-01-01T00:00:00.000Z');
    const result = await run(interceptor, { createdAt: date });
    expect((result as { createdAt: Date }).createdAt).toBeInstanceOf(Date);
    expect((result as { createdAt: Date }).createdAt.toISOString()).toBe(
      date.toISOString(),
    );
  });

  it('passes primitive responses through unchanged', async () => {
    await expect(run(interceptor, { status: 'ok' })).resolves.toEqual({
      status: 'ok',
    });
    await expect(run(interceptor, null)).resolves.toBeNull();
  });
});
