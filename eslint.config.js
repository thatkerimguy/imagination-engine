import js from '@eslint/js';
import tseslint from 'typescript-eslint';
import prettier from 'eslint-config-prettier';
import reactHooks from 'eslint-plugin-react-hooks';
import globals from 'globals';

export default tseslint.config(
  {
    ignores: [
      '**/node_modules/**',
      '**/dist/**',
      '**/dev-dist/**',
      'coverage/**',
      'apps/writer/.expo/**',
      'apps/writer/expo-env.d.ts',
    ],
  },
  js.configs.recommended,
  ...tseslint.configs.strict,
  {
    languageOptions: { globals: { ...globals.browser, ...globals.node } },
    rules: {
      '@typescript-eslint/no-explicit-any': 'error',
      '@typescript-eslint/consistent-type-imports': 'error',
      // With noUncheckedIndexedAccess, a checked `!` is the honest way to index typed arrays.
      '@typescript-eslint/no-non-null-assertion': 'off',
      'max-lines': ['warn', { max: 250, skipBlankLines: true, skipComments: true }],
    },
  },
  {
    // The frozen core stays DOM-free except for the web-only renderer contract.
    files: ['packages/core/src/**/*.ts'],
    ignores: ['packages/core/src/renderer-contract.ts'],
    languageOptions: { globals: {} },
  },
  {
    // CLAUDE.md §3.3: the writer may only see meta, schema and card. Modules must keep
    // their barrel free of renderer code so that stays true.
    files: [
      'packages/modules/*/index.ts',
      'packages/modules/*/schema.ts',
      'packages/modules/*/card.ts',
    ],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            { group: ['three', 'three/*', 'cannon-es'], message: 'Renderer-only dependency.' },
            {
              group: ['./renderer*', './high*', './lite*'],
              message: 'Barrel must not reach renderer code.',
            },
            { group: ['@kn/core/renderer'], message: 'Web-only contract; keep it in renderer.ts.' },
          ],
        },
      ],
    },
  },
  {
    // Expo writer: React hooks rules, and the Zero Heavy Imports fence (CLAUDE.md §3.3).
    files: ['apps/writer/src/**/*.{ts,tsx}'],
    plugins: { 'react-hooks': reactHooks },
    rules: {
      'react-hooks/rules-of-hooks': 'error',
      'react-hooks/exhaustive-deps': 'warn',
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: ['three', 'three/*', 'cannon-es', '@dimforge/*'],
              message: 'The writer never loads 3D or physics; preview runs in the reader WebView.',
            },
            {
              group: ['@kn/module-*/renderer', '**/renderer', '**/renderer.ts'],
              message: 'Import only a module barrel (schema + formatCardSummary).',
            },
            { group: ['@kn/core/renderer'], message: 'Web-only renderer contract.' },
          ],
        },
      ],
    },
  },
  {
    // Expo / Metro config files are CommonJS.
    files: ['apps/writer/*.js'],
    languageOptions: { sourceType: 'commonjs', globals: { ...globals.node } },
    rules: { '@typescript-eslint/no-require-imports': 'off' },
  },
  prettier,
);
