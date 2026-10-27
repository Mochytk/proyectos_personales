// @ts-check
import js from '@eslint/js';
import { defineConfig, globalIgnores } from 'eslint/config';
import reactHooks from 'eslint-plugin-react-hooks';
import tseslint from 'typescript-eslint';

export default defineConfig(
  globalIgnores([
    '**/dist/',
    '**/coverage/',
    '**/.wrangler/',
    '**/playwright-report/',
    '**/test-results/',
    '**/release/',
  ]),
  {
    files: ['**/*.{js,ts,tsx}'],
    extends: [
      js.configs.recommended,
      tseslint.configs.strictTypeChecked,
      tseslint.configs.stylisticTypeChecked,
    ],
    languageOptions: {
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
  },
  // Rules of Hooks, effect dependencies and the React Compiler checks, for the React app.
  {
    files: ['apps/web/**/*.{ts,tsx}'],
    extends: [reactHooks.configs.flat.recommended],
    rules: {
      // useTimedLiveQuery takes deps like useEffect, so check them the same way.
      'react-hooks/exhaustive-deps': ['warn', { additionalHooks: '(useTimedLiveQuery)' }],
    },
  },
  // Plain JS config files are not part of any tsconfig, so they get untyped rules only.
  {
    files: ['**/*.js'],
    extends: [tseslint.configs.disableTypeChecked],
  },
);
