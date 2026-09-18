const path = require('node:path');

/** @type {import('jest').Config} */
module.exports = {
  preset: 'ts-jest/presets/default-esm',
  testEnvironment: 'node',
  extensionsToTreatAsEsm: ['.ts'],
  moduleNameMapper: {
    // @nestjs/throttler (CJS, no "type" field) synchronously require()s
    // @nestjs/common (real ESM) from its decorator module. Under Jest's
    // --experimental-vm-modules ESM runtime this collides with Node's
    // require(esm)-mid-cycle restriction ("Cannot require() ES Module ...
    // in a cycle") the moment AppModule's import graph is linked - it
    // reproduces purely from booting the real app under Jest+ESM, not from
    // anything specific to this app's code. Rate limiting itself is a
    // well-tested third-party concern, not business logic, so e2e swaps in
    // a trivial stub instead of the real package to avoid it.
    '^@nestjs/throttler$': '<rootDir>/test/mocks/nestjs-throttler.stub.ts',
    '^(\\.{1,2}/.*)\\.js$': '$1',
  },
  transform: {
    '^.+\\.tsx?$': ['ts-jest', { useESM: true, tsconfig: 'tsconfig.json' }],
  },
  moduleFileExtensions: ['ts', 'tsx', 'js', 'json'],
  // Jest resolves a bare `rootDir: '.'` relative to this config file's own
  // directory (test/), not the project root - resolve it explicitly instead.
  rootDir: path.resolve(__dirname, '..'),
  roots: ['<rootDir>/test'],
  testRegex: '.*\\.e2e-spec\\.ts$',
  setupFilesAfterEnv: ['<rootDir>/src/test/setup.ts'],
  // Boots the real Nest app (incl. a real pg-boss instance) against the
  // shared test database - same single-worker reasoning as jest.config.cjs.
  maxWorkers: 1,
  testTimeout: 30_000,
};
