import { jest } from '@jest/globals';
import { config } from 'dotenv';
import { resolve } from 'node:path';

// Loaded before every test file. Points the whole process at the dedicated
// test database and dummy credentials (see .env.test) - never the real
// dev/production env.
config({
  path: resolve(import.meta.dirname, '../../.env.test'),
  override: true,
  quiet: true,
});

jest.setTimeout(15_000);
