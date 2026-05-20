import { apiNavigation } from "../lib/api.js";
import { getDocsByCollection } from "../lib/docs.js";

function getAllRoutePaths() {
  const routes = new Set(["/", "/privacy/"]);

  for (const collection of ["guides", "wiki"]) {
    for (const doc of getDocsByCollection(collection)) {
      routes.add(doc.sitePath);
    }
  }

  for (const section of apiNavigation) {
    for (const item of section.items) {
      routes.add(item.href);
    }
  }

  return [...routes].sort();
}

function escapeXml(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

export function GET({ site }) {
  if (!site) {
    return new Response("Astro site URL is required to generate sitemap.xml", {
      status: 500,
      headers: {
        "Content-Type": "text/plain; charset=utf-8",
      },
    });
  }

  const urls = getAllRoutePaths()
    .map((pathname) => `  <url><loc>${escapeXml(new URL(pathname, site).toString())}</loc></url>`)
    .join("\n");

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls}
</urlset>
`;

  return new Response(xml, {
    headers: {
      "Content-Type": "application/xml; charset=utf-8",
    },
  });
}
