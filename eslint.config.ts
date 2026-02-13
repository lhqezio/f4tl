import eslint from '@eslint/js';
import tseslint from 'typescript-eslint';
import eslintConfigPrettier from 'eslint-config-prettier';
import reactHooks from 'eslint-plugin-react-hooks';

export default tseslint.config(
  // Global ignores
  { ignores: ['dist/', 'node_modules/', '.f4tl/', 'coverage/'] },

  // Base: JS recommended
  eslint.configs.recommended,

  // TypeScript: strict
  ...tseslint.configs.strict,

  // React hooks for dashboard
  {
    files: ['dashboard/src/**/*.{ts,tsx}'],
    plugins: { 'react-hooks': reactHooks },
    rules: reactHooks.configs.recommended.rules,
  },

  // Prettier must be last — disables conflicting format rules
  eslintConfigPrettier,

  // Project-specific overrides
  {
    rules: {
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
      '@typescript-eslint/no-explicit-any': 'warn',
      '@typescript-eslint/consistent-type-imports': 'error',
    },
  },

  // Relax rules for test files
  {
    files: ['tests/**/*.test.ts'],
    rules: {
      '@typescript-eslint/no-explicit-any': 'off',
      '@typescript-eslint/no-non-null-assertion': 'off',
    },
  },
);
