import eslintConfigPrettier from 'eslint-config-prettier';
import globals from 'globals';
import pluginJest from 'eslint-plugin-jest';
import pluginJs from '@eslint/js';

export default [
  {
    ignores: ['dist/', 'build/'],
  },
  {
    files: ['src/**/*'],
    languageOptions: {
      globals: {
        ...globals.browser,
        chrome: 'readonly',
      },
    },
  },
  {
    files: ['test/**/*'],
    plugins: { jest: pluginJest },
    ...pluginJest.configs['flat/all'],
  },
  pluginJs.configs.all,
  eslintConfigPrettier,
  {
    files: ['webpack.config.js'],
    languageOptions: {
      globals: {
        ...globals.node,
      },
    },
    rules: {
      camelcase: [
        'error',
        {
          properties: 'never',
        },
      ],
    },
  },
  {
    rules: {
      'capitalized-comments': [
        'error',
        'always',
        {
          ignoreConsecutiveComments: true,
        },
      ],
      'complexity': ['error', 30],
      'max-lines-per-function': ['error', 100],
      'max-params': ['error', 4],
      'max-statements': ['error', 30],
      'no-console': ['error', { allow: ['warn', 'error'] }],
      'no-inline-comments': 'off',
      'no-magic-numbers': 'off',
      'no-ternary': 'off',
      'no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
      'no-void': 'off',
      'one-var': ['error', 'never'],
      'prefer-named-capture-group': 'off',
    },
  },
  {
    files: ['test/**/*'],
    languageOptions: {
      globals: {
        ...globals.node,
      },
    },
    rules: {
      'jest/max-expects': 'off',
      'jest/no-conditional-in-test': 'off',
      'jest/no-hooks': 'off',
      'max-lines-per-function': 'off',
    },
  },
];
