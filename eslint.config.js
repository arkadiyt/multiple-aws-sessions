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
  pluginJs.configs.all,
  eslintConfigPrettier,
  {
    rules: {
      'max-statements': ['error', 20],
    },
  },
];
