/** @type {import('next').NextConfig} */

// For GitHub Pages we build a fully static export under the repository
// subpath (e.g. /basketballmanager). The CI workflow sets STATIC_EXPORT=1 and
// NEXT_PUBLIC_BASE_PATH to the path reported by actions/configure-pages.
// Local `next dev` / `next start` leave both unset and behave normally.
const isExport = process.env.STATIC_EXPORT === "1";
const basePath = process.env.NEXT_PUBLIC_BASE_PATH || "";

const nextConfig = {
  reactStrictMode: true,
  ...(isExport ? { output: "export" } : {}),
  basePath: basePath || undefined,
  trailingSlash: true,
  images: { unoptimized: true },
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
