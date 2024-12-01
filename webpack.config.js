const path = require('path');

module.exports = {
  entry: './src/background.js',
  output: {
    filename: 'background.js',
    path: path.resolve(__dirname, 'dist'),
  },
  resolve: {
    modules: ['node_modules'],
  },
  mode: 'none',
  devtool: false,
  watch: true
};