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
  },
  pluginJs.configs.all,
  eslintConfigPrettier,
  {
    rules: {
      // TODO re-enable later
      'capitalized-comments': 'off',
      'no-undefined': 'off',
      'jest/no-commented-out-tests': 'off',
      'no-magic-numbers': 'off',
      'one-var': 'off',
      'jest/prefer-expect-assertions': 'off',
      'no-warning-comments': 'off',
      'jest/no-conditional-in-test': 'off',
      // leave off permanently
      'jest/no-hooks': 'off',
      'no-ternary': 'off',
      'jest/max-expects': 'off',
    },
  },
];
