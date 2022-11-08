/** @type {import('ts-jest/dist/types').InitialOptionsTsJest} */
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'jsdom',
  testRegex: '/test/.+test.tsx?$',
  passWithNoTests: true,
  collectCoverageFrom: [
    './src/**/**.ts',
    '!**/handlers/**.ts',
    '!**/model/**.ts',
    '!./src/app.ts'
  ],
  coverageReporters: ['lcov', 'json-summary', ['text', { file: 'coverage.txt', path: './' }]],
}