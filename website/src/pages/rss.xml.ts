import fs from "node:fs";
import { getDocsByCollection } from "../lib/docs.js";

const defaultSiteDescription =
  "Deployable event-ordering runtime docs for distributed systems.";

function escapeXml(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function getDocsFeedEntries(baseUrl) {
  return ["guides", "wiki", "examples"]
    .flatMap((collection) => getDocsByCollection(collection))
    .map((doc) => {
      const absoluteUrl = new URL(doc.sitePath, baseUrl).toString();
      return {
        title: doc.title,
        description: doc.description || defaultSiteDescription,
        url: absoluteUrl,
        guid: absoluteUrl,
        publishedAt: fs.statSync(doc.absolutePath).mtime,
      };
    })
    .sort((left, right) => right.publishedAt.getTime() - left.publishedAt.getTime())
    .slice(0, 40);
}

export function GET({ site, url }) {
  const baseUrl = site ?? new URL(url.origin);
  const feedUrl = new URL("/rss.xml", baseUrl).toString();
  const siteUrl = new URL("/", baseUrl).toString();
  const items = getDocsFeedEntries(baseUrl)
    .map(
      (entry) => `  <item>
    <title>${escapeXml(entry.title)}</title>
    <link>${escapeXml(entry.url)}</link>
    <guid>${escapeXml(entry.guid)}</guid>
    <pubDate>${entry.publishedAt.toUTCString()}</pubDate>
    <description>${escapeXml(entry.description)}</description>
  </item>`,
    )
    .join("\n");

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0">
<channel>
  <title>causal-order docs</title>
  <link>${escapeXml(siteUrl)}</link>
  <description>${escapeXml(defaultSiteDescription)}</description>
  <language>en</language>
  <atom:link href="${escapeXml(feedUrl)}" rel="self" type="application/rss+xml" xmlns:atom="http://www.w3.org/2005/Atom" />
${items}
</channel>
</rss>
`;

  return new Response(xml, {
    headers: {
      "Content-Type": "application/rss+xml; charset=utf-8",
    },
  });
}
