const path = require('path');

/** @typedef {import('webpack').Configuration} WebpackConfig **/

// Configuration for the extension (Node.js target)
/** @type WebpackConfig */
const extensionConfig = {
  target: 'node',
  mode: 'none',
  entry: './src/extension.ts', // Entry point for extension
  output: {
    path: path.resolve(__dirname, 'dist'),
    filename: 'extension.js', // Output file for extension
    libraryTarget: 'commonjs2'
  },
  externals: {
    vscode: 'commonjs vscode' // vscode-module is excluded
  },
  resolve: {
    extensions: ['.ts', '.js']
  },
  module: {
    rules: [
      {
        test: /\.ts$/,
        exclude: /node_modules/,
        use: {
          loader: 'ts-loader'
        }
      }
    ]
  },
  devtool: 'nosources-source-map',
  infrastructureLogging: {
    level: "log",
  },
};

// Configuration for the webview (Web target)
/** @type WebpackConfig */
const webviewConfig = {
  target: 'web',
  mode: 'none',
  entry: './src/webviews/main.ts', // Entry point for webview
  output: {
    path: path.resolve(__dirname, 'dist'),
    filename: 'webview.js', // Output file for webview
  },
  resolve: {
    extensions: ['.ts', '.js']
  },
  module: {
    rules: [
      {
        test: /\.ts$/,
        exclude: /node_modules/,
        use: {
          loader: 'ts-loader'
        }
      }
    ]
  },
  devtool: 'nosources-source-map',
};

module.exports = [extensionConfig, webviewConfig];
