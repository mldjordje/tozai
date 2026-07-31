import type { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: ["/", "/en", "/portfolio", "/en/portfolio", "/upit", "/en/upit", "/uslovi", "/en/uslovi", "/privatnost", "/en/privatnost"],
      disallow: ["/admin", "/api", "/nalog", "/prijava", "/porudzbina", "/en/porudzbina"],
    },
    sitemap: "https://toza-ai.rs/sitemap.xml",
    host: "https://toza-ai.rs",
  };
}
