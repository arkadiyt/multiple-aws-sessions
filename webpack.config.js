import path from 'node:path';

export default {
  devtool: false,
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
  watch: true,
};
