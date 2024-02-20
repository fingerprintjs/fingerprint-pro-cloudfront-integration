module.exports = {
  extends: ['@fingerprintjs/eslint-config-dx-team'],
  parserOptions: {
    ecmaFeatures: {
      jsx: true,
    },
  },
  ignorePatterns: ['build/*'],
}
