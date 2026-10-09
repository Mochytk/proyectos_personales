// https://docs.expo.dev/guides/using-eslint/
const { defineConfig } = require('eslint/config');
const expoConfig = require('eslint-config-expo/flat');

module.exports = defineConfig([
  expoConfig,
  { ignores: ['dist/*', 'release/*', 'node_modules/*', 'coverage/*'] },
  {
    // Electron main-process files are CommonJS running in Node.
    files: ['electron-*.js'],
    languageOptions: { globals: { __dirname: 'readonly', Buffer: 'readonly', process: 'readonly' } },
  },
]);
