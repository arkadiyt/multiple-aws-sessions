import CopyPlugin from 'copy-webpack-plugin';
import path from 'node:path';
import webpack from 'webpack';

export default {
  // Generate source maps when building for Selenium
  devtool: process.env.SELENIUM ? 'inline-source-map' : false,
  entry: {
    background: 'background/background.js',
    isolated: 'content_script/isolated.js',
    main: 'content_script/main.js',
  },
  mode: 'none',
  output: {
    filename: '[name].js',
    path: path.resolve(import.meta.dirname, 'dist'),
  },
  resolve: {
    modules: ['src', 'node_modules'],
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
  plugins: [
    new CopyPlugin({
      patterns: [
        {
          from: './src/content_script/main.css',
          to: './main.css',
        },
      ],
    }),
    // There is some coverage instrumentation code under src/selenium/
    // When we're _not_ building for Selenium, replace any 'selenium/*.js' imports with an empty file
    ...(process.env.SELENIUM ? [] : [new webpack.NormalModuleReplacementPlugin(/src\/selenium\/.*\.js$/u, 'empty.js')]),
  ],
};
