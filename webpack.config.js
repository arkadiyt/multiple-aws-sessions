import CopyPlugin from 'copy-webpack-plugin';
import ZipPlugin from 'zip-webpack-plugin';
import ejs from 'ejs';
import path from 'node:path';
import { readFileSync } from 'node:fs';
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
    clean: true,
    filename: '[name].js',
    path: path.resolve(import.meta.dirname, 'dist/js'),
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
          from: 'src/content_script/main.css',
          to: path.resolve(import.meta.dirname, 'dist/css/main.css'),
        },
        {
          from: '_locales',
          to: path.resolve(import.meta.dirname, 'dist/_locales'),
        },
        {
          from: 'img',
          to: path.resolve(import.meta.dirname, 'dist/img'),
        },
        {
          from: 'manifest.json.ejs',
          to: path.resolve(import.meta.dirname, 'dist/manifest.json'),
          transform(content) {
            return ejs.render(content.toString(), { target: process.env.TARGET, version: readFileSync('.version') });
          },
        },
      ],
    }),
    // There is some coverage instrumentation code under src/selenium/
    // When we're _not_ building for Selenium, replace any 'selenium/*.js' imports with an empty file
    ...(process.env.SELENIUM ? [] : [new webpack.NormalModuleReplacementPlugin(/src\/selenium\/.*\.js$/u, 'empty.js')]),
    ...(process.env.ZIP
      ? [
          new ZipPlugin({
            filename: `${process.env.TARGET}-${readFileSync('.version')}`,
            path: path.resolve(import.meta.dirname, 'build'),
            pathPrefix: 'js',
          }),
        ]
      : []),
  ],
};
