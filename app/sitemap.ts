import type { MetadataRoute } from "next";

const BASE = "https://toza-ai.rs";

export default function sitemap(): MetadataRoute.Sitemap {
  const paths = [
    "",
    "/portfolio",
    "/upit",
    "/uslovi",
    "/privatnost",
    "/en",
    "/en/portfolio",
    "/en/upit",
    "/en/uslovi",
    "/en/privatnost",
  ];

  return paths.map((path) => ({
    url: `${BASE}${path}`,
    lastModified: new Date(),
    changeFrequency: path === "" || path === "/en" ? "weekly" : "monthly",
    priority: path === "" || path === "/en" ? 1 : 0.7,
  }));
}
