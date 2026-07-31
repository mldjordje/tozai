import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "X-Frame-Options", value: "SAMEORIGIN" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          {
            key: "Permissions-Policy",
            value: "camera=(), microphone=(), geolocation=(), payment=()",
          },
        ],
      },
    ];
  },
  async redirects() {
    return [
      { source: "/index", destination: "/", permanent: true },
      { source: "/index.html", destination: "/", permanent: true },
      { source: "/en/index", destination: "/en", permanent: true },
      { source: "/en/index.html", destination: "/en", permanent: true },
    ];
  },
  // `next dev` and `next start` both default to `.next`, so running a dev
  // server next to the production one on :3001 has them overwriting each
  // other's manifests — both then 500 with missing routes-manifest.json or
  // "__webpack_modules__[moduleId] is not a function". Dev gets its own
  // directory; `next build`/`next start` keep `.next` untouched.
  distDir: process.env.NODE_ENV === "development" ? ".next-dev" : ".next",
  // The invoice renderer reads its font files from disk at runtime. Next only
  // ships files it can see being imported, and a readFile(path.join(cwd, …))
  // is invisible to the tracer — without this the PDFs render locally and
  // throw ENOENT in production.
  outputFileTracingIncludes: {
    "/**": ["./lib/invoices/fonts/*.ttf"],
  },
  images: {
    remotePatterns: [
      // Admin uploads (result shots, portfolio media) live in Vercel Blob.
      // Without this next/image refuses the host and every uploaded image 400s.
      { protocol: "https", hostname: "*.public.blob.vercel-storage.com" },
    ],
  },
};

export default nextConfig;
