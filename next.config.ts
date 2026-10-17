import path from "node:path";
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ["groq-sdk", "openai"],
  turbopack: {
    rules: {
      "*.txt": {
        loaders: [path.join(__dirname, "txt-raw-loader.cjs")],
        as: "*.js",
      },
    },
  },
  webpack(config) {
    config.module.rules.push({
      test: /\.txt$/,
      type: "asset/source",
    });
    return config;
  },
};

export default nextConfig;
