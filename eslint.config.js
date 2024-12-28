import eslintConfigPrettier from 'eslint-config-prettier';
import globals from 'globals';
import pluginJest from 'eslint-plugin-jest';
import pluginJs from '@eslint/js';

export default [
  {
    ignores: ['dist/*'],
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
    languageOptions: {
      globals: {
        ...globals.node,
        ...globals.jest,
      },
    },
    plugins: { jest: pluginJest },
    ...pluginJest.configs['flat/all'],
  },
  pluginJs.configs.all,
  eslintConfigPrettier,
  {
    files: ['test/**/*'],
    rules: {
      'jest/no-hooks': 'off',
    },
  },
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
      'complexity': ['error', 25],
      'max-lines-per-function': ['error', 100],
      'max-statements': ['error', 25],
      'no-console': ['error', { allow: ['warn', 'error'] }],
      'no-magic-numbers': 'off',
      'no-ternary': 'off',
      'no-unused-vars': ["error", { "argsIgnorePattern": "^_" }],
      'no-void': 'off',
      'one-var': ['error', 'never'],
    },
  },
];
