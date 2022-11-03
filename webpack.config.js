const path = require("path");

module.exports = {
  target: "web",
  mode: "development",
  devtool: "source-map",
  externals: {
    react: "react",
    "react-dom": "reactDOM",
  },
  optimization: {
    minimize: true,
  },
  entry: {
    main: "./src/index.ts",
  },
  module: {
    rules: [
      {
        test: /\.tsx?$/,
        use: "ts-loader",
        exclude: /node_modules/,
      },
    ],
  },
  resolve: {
    extensions: [".tsx", ".ts", ".js", ".jsx"],
  },
  output: {
    path: path.resolve(__dirname, "dist"),
    filename: "index.min.js",
    library: {
      name: "graphand-react",
      type: "umd",
    },
    globalObject: "this",
  },
  watch: !!parseInt(process.env.WATCH),
  watchOptions: {
    ignored: [path.resolve(__dirname, "node_modules"), path.resolve(__dirname, "docs"), path.resolve(__dirname, "dist")],
  },
};
