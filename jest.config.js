/** @type {import('ts-jest/dist/types').InitialOptionsTsJest} */
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  testRegex: '/test/.+test.tsx?$',
  passWithNoTests: true,
  collectCoverageFrom: [
    './proxy/**/**.ts',
    '!**/model/**.ts',
    '!./proxy/app.ts',
    '!**/index.ts',
    './mgmt-lambda/**/**.ts',
  ],
  coverageReporters: ['lcov', 'json-summary', ['text', { file: 'coverage.txt', path: './' }]],
  testTimeout: 60000,
}
