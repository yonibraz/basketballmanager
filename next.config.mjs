/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  webpack: (config) => {
    // The engine core (src/**) uses explicit ".js" import specifiers that
    // resolve to ".ts" source files (NodeNext/ESM convention). Teach webpack
    // to follow that mapping so the same source compiles in the browser bundle.
    config.resolve.extensionAlias = {
      ".js": [".ts", ".tsx", ".js"],
      ".mjs": [".mts", ".mjs"],
    };
    return config;
  },
};

export default nextConfig;
