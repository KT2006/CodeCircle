import js from '@eslint/js'
import globals from 'globals'

/** @type {import("eslint").Linter.Config[]} */
export default [
  // Globally ignore migration files — they use CommonJS (exports.up/down)
  // because node-pg-migrate requires it, not ESM.
  {
    ignores: ['src/db/migrations/**'],
  },

  js.configs.recommended,

  {
    files: ['src/**/*.js'],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'module',
      globals: {
        ...globals.node,
      },
    },
    rules: {
      'no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
      eqeqeq: ['error', 'always'],
      'no-console': ['warn', { allow: ['warn', 'error'] }],
    },
  },
]
