import path from 'node:path';
import webpack from 'webpack';

export default {
  // Generate source maps when building for Selenium
  devtool: process.env.SELENIUM ? 'inline-source-map' : false,
  entry: {
    background: './src/background/background.js',
    content_script_isolated: './src/content_script/content_script_isolated.js',
    content_script_main: './src/content_script/content_script_main.js',
  },
  mode: 'none',
  output: {
    filename: '[name].js',
    path: path.resolve(import.meta.dirname, 'dist'),
  },
  resolve: {
    modules: [path.resolve('src'), 'node_modules'],
  },
  ...(process.env.SELENIUM && {
    // Use istanbul to generate coverage data when building for Selenium
    module: {
      rules: [
        {
          test: /\.js$/u,
          use: {
            loader: 'babel-loader',
          },
        },
      ],
    },
  }),
  ...(!process.env.SELENIUM && {
    // There is some coverage instrumentation code under src/selenium/
    // When we're _not_ building for Selenium, replace any 'selenium/*.js' imports with an empty file
    plugins: [new webpack.NormalModuleReplacementPlugin(/src\/selenium\/.*\.js$/u, 'empty.js')],
  }),
};
