/** @type {import('jest').Config} */
module.exports = {
  preset: 'ts-jest/presets/default-esm',
  testEnvironment: 'node',
  extensionsToTreatAsEsm: ['.ts'],
  moduleNameMapper: {
    '^(\\.{1,2}/.*)\\.js$': '$1',
  },
  transform: {
    '^.+\\.tsx?$': ['ts-jest', { useESM: true, tsconfig: 'tsconfig.json' }],
  },
  moduleFileExtensions: ['ts', 'tsx', 'js', 'json'],
  rootDir: 'src',
  testRegex: '.*\\.spec\\.ts$',
  collectCoverageFrom: ['**/*.(t|j)s'],
  coveragePathIgnorePatterns: ['/generated/'],
  coverageDirectory: '../coverage',
  setupFilesAfterEnv: ['<rootDir>/test/setup.ts'],
  // Integration specs share one real Postgres test database (see
  // src/test/prisma-test.util.ts) and each does `resetDatabase()` in
  // `beforeEach` - running suites in parallel workers lets one suite's
  // reset wipe rows another suite just created mid-test. Serializing avoids
  // that without needing per-worker databases or transactional rollback.
  maxWorkers: 1,
};
