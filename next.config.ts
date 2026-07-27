import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  // `next dev` and `next start` both default to `.next`, so running a dev
  // server next to the production one on :3001 has them overwriting each
  // other's manifests — both then 500 with missing routes-manifest.json or
  // "__webpack_modules__[moduleId] is not a function". Dev gets its own
  // directory; `next build`/`next start` keep `.next` untouched.
  distDir: process.env.NODE_ENV === "development" ? ".next-dev" : ".next",
};

export default nextConfig;
