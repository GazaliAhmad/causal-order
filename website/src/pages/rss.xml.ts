import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import matter from "gray-matter";
import { marked } from "marked";

const releasesRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../../../docs/releases",
);
const repoUrl = "https://github.com/GazaliAhmad/causal-order";
const defaultSiteDescription =
  "Release notes and docs-site updates for causal-order.";

function escapeXml(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function getReleaseEntries() {
  return fs
    .readdirSync(releasesRoot, { withFileTypes: true })
    .filter((entry) => entry.isFile() && entry.name.endsWith(".md"))
    .map((entry) => {
      const absolutePath = path.join(releasesRoot, entry.name);
      const raw = fs.readFileSync(absolutePath, "utf8");
      const parsed = matter(raw);
      const tokens = marked.lexer(parsed.content, { gfm: true });
      const title = extractTitle(tokens) ?? humanizeFilename(entry.name);
      const description = extractDescription(tokens) ?? defaultSiteDescription;
      const relativePath = `docs/releases/${entry.name}`.replace(/\\/g, "/");
      const sourceUrl = `${repoUrl}/blob/main/${relativePath}`;
      const publishedAt = fs.statSync(absolutePath).mtime;

      return {
        title,
        description,
        sourceUrl,
        guid: sourceUrl,
        publishedAt,
      };
    })
    .sort((left, right) => right.publishedAt.getTime() - left.publishedAt.getTime());
}

function extractTitle(tokens) {
  const heading = tokens.find((token) => token.type === "heading" && token.depth === 1);
  return heading ? cleanInlineText(heading.text ?? "") : null;
}

function extractDescription(tokens) {
  const paragraph = tokens.find((token) => token.type === "paragraph");
  const text = paragraph ? cleanInlineText(paragraph.text ?? "") : "";
  return text || null;
}

function cleanInlineText(value) {
  return value.replace(/`/g, "").replace(/\s+/g, " ").trim();
}

function humanizeFilename(filename) {
  const basename = filename.replace(/\.md$/i, "");
  if (basename.toLowerCase() === "website") {
    return "Website Notes";
  }

  return `Release ${basename}`;
}

export function GET({ site, url }) {
  const baseUrl = site ?? new URL(url.origin);
  const feedUrl = new URL("/rss.xml", baseUrl).toString();
  const siteUrl = new URL("/", baseUrl).toString();
  const items = getReleaseEntries()
    .map(
      (entry) => `  <item>
    <title>${escapeXml(entry.title)}</title>
    <link>${escapeXml(entry.sourceUrl)}</link>
    <guid>${escapeXml(entry.guid)}</guid>
    <pubDate>${entry.publishedAt.toUTCString()}</pubDate>
    <description>${escapeXml(entry.description)}</description>
  </item>`,
    )
    .join("\n");

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0">
<channel>
  <title>causal-order releases</title>
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
