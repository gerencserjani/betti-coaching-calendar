import { ConflictException } from '@nestjs/common';
import { Prisma, type PrismaClient } from '@prisma/client';

const SERIALIZATION_RETRY_ATTEMPTS = 3;
const DEFAULT_CONFLICT_MESSAGE =
  'Could not complete the request due to a conflicting change, please try again';

/**
 * Runs `fn` inside a SERIALIZABLE transaction, retrying on Postgres
 * serialization failures (Prisma error P2034). Use whenever a read that
 * decides whether a write is allowed (a conflict/availability check) must
 * not race a concurrent request making the same decision.
 */
export async function runSerializable<T>(
  prisma: PrismaClient,
  fn: (tx: Prisma.TransactionClient) => Promise<T>,
  conflictMessage = DEFAULT_CONFLICT_MESSAGE,
): Promise<T> {
  for (let attempt = 1; attempt <= SERIALIZATION_RETRY_ATTEMPTS; attempt++) {
    try {
      return await prisma.$transaction(fn, {
        isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
      });
    } catch (error) {
      const isSerializationFailure =
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2034';
      if (!isSerializationFailure || attempt === SERIALIZATION_RETRY_ATTEMPTS) {
        throw error;
      }
    }
  }
  throw new ConflictException(conflictMessage);
}
