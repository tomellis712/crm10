const path = require("node:path");
const HtmlWebpackPlugin = require("html-webpack-plugin");
const webpack = require("webpack");
require("dotenv").config({ path: path.resolve(__dirname, ".env") });

module.exports = {
  entry: "./src/main.jsx",
  output: {
    path: path.resolve(__dirname, "dist"),
    filename: "[name].[contenthash].js",
    clean: true,
    publicPath: "/",
  },
  resolve: {
    extensions: [".js", ".jsx"],
  },
  module: {
    rules: [
      {
        test: /\.jsx?$/,
        exclude: /node_modules/,
        use: {
          loader: "babel-loader",
          options: {
            presets: [
              ["@babel/preset-env", { targets: "defaults" }],
              ["@babel/preset-react", { runtime: "automatic" }],
            ],
          },
        },
      },
      {
        test: /\.css$/,
        use: ["style-loader", "css-loader"],
      },
    ],
  },
  plugins: [
    new HtmlWebpackPlugin({ template: "./index.html" }),
    new webpack.DefinePlugin({
      "process.env.API_ENABLED": JSON.stringify(process.env.API_ENABLED || "true"),
    }),
  ],
  devServer: {
    host: "0.0.0.0",
    port: 5173,
    allowedHosts: "all",
    historyApiFallback: true,
    proxy: [
      {
        context: ["/api"],
        target: "http://localhost:5000",
        changeOrigin: false,
      },
    ],
  },
};
