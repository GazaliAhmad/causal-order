import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import matter from "gray-matter";
import { marked } from "marked";

const repoRoot = findRepoRoot();
const guidesRoot = path.join(repoRoot, "guides");
const wikiRoot = path.join(repoRoot, "wiki");
const repoPackage = JSON.parse(
  fs.readFileSync(path.join(repoRoot, "package.json"), "utf8"),
);
const repoUrl = normalizeRepoUrl(
  repoPackage.repository?.url ?? repoPackage.repository,
);

const docsRoots = {
  guides: guidesRoot,
  wiki: wikiRoot,
};

const landingFiles = {
  guides: "README.md",
  wiki: "Home.md",
};

const hiddenFiles = new Set(["_Sidebar.md", "PUBLISH-ORDER.md"]);
const includedGuidesHardeningFiles = new Set([
  "hardening/anomaly-surface-0.3.2.md",
  "hardening/fuzz-testing-0.3.2.md",
  "hardening/runtime-stability-0.3.4.md",
  "hardening/streaming-hardening-0.3.3.md",
]);
const hardeningTitleOverrides = new Map([
  ["hardening/anomaly-surface-0.3.2.md", "Anomaly Surface Audit"],
  ["hardening/fuzz-testing-0.3.2.md", "Fuzz Testing"],
  ["hardening/runtime-stability-0.3.4.md", "Runtime Stability"],
  ["hardening/streaming-hardening-0.3.3.md", "Streaming Hardening And Pressure"],
]);

const docsCache = buildDocsCache();

export function getDocsByCollection(collection) {
  return docsCache.byCollection[collection];
}

export function getDoc(collection, routePath) {
  const normalized = normalizeRoutePath(routePath);
  return docsCache.byRoute.get(`${collection}:${normalized}`) ?? null;
}

export function getNavigation(collection) {
  return docsCache.navigation[collection];
}

export function getFeaturedDocs() {
  return {
    guides: getNavigation("guides")[0]?.items.slice(0, 4) ?? [],
    wiki: getNavigation("wiki")[0]?.items.slice(0, 4) ?? [],
  };
}

function buildDocsCache() {
  const docs = [];

  for (const [collection, rootDir] of Object.entries(docsRoots)) {
    for (const absolutePath of walkMarkdownFiles(rootDir)) {
      const relativePath = path.relative(rootDir, absolutePath);
      if (hiddenFiles.has(path.basename(relativePath))) {
        continue;
      }

      if (shouldExcludeDoc(collection, relativePath)) {
        continue;
      }

      docs.push(createDocRecord(collection, rootDir, absolutePath, relativePath));
    }
  }

  const bySource = new Map(
    docs.map((doc) => [normalizeFsPath(doc.absolutePath), doc]),
  );

  for (const doc of docs) {
    const rendered = renderMarkdown(doc, bySource);
    doc.html = rendered.html;
    doc.toc = rendered.toc;
  }

  const byCollection = {
    guides: docs
      .filter((doc) => doc.collection === "guides")
      .sort((left, right) => left.routePath.localeCompare(right.routePath)),
    wiki: docs
      .filter((doc) => doc.collection === "wiki")
      .sort((left, right) => left.routePath.localeCompare(right.routePath)),
  };

  const byRoute = new Map(
    docs.map((doc) => [`${doc.collection}:${doc.routePath}`, doc]),
  );

  const navigation = {
    guides: parseGuidesNavigation(bySource),
    wiki: parseWikiNavigation(bySource),
  };

  return { byCollection, byRoute, navigation };
}

function findRepoRoot() {
  const candidates = [
    fileURLToPath(new URL("../../../", import.meta.url)),
    path.resolve(process.cwd(), ".."),
    process.cwd(),
  ];

  for (const candidate of candidates) {
    if (
      fs.existsSync(path.join(candidate, "guides")) &&
      fs.existsSync(path.join(candidate, "wiki")) &&
      fs.existsSync(path.join(candidate, "package.json"))
    ) {
      return candidate;
    }
  }

  throw new Error("Unable to resolve repository root for website docs");
}

function normalizeRepoUrl(value) {
  if (typeof value === "string" && value.length > 0) {
    return value.replace(/^git\+/, "").replace(/\.git$/, "");
  }

  return "https://github.com/GazaliAhmad/causal-order";
}

function createDocRecord(collection, rootDir, absolutePath, relativePath) {
  const raw = fs.readFileSync(absolutePath, "utf8");
  const parsed = matter(raw);
  const tokens = marked.lexer(parsed.content, { gfm: true });
  const normalizedRelativePath = relativePath.replace(/\\/g, "/");
  const fallbackTitle =
    parsed.data.title ?? extractTitle(tokens) ?? humanizeTitle(relativePath);
  const title = resolveDisplayTitle(
    collection,
    normalizedRelativePath,
    fallbackTitle,
  );
  const description =
    parsed.data.description ?? cleanInlineText(extractDescription(tokens) ?? "");
  const sitePath = buildSitePath(collection, relativePath);
  const sourcePath = path.relative(repoRoot, absolutePath).replace(/\\/g, "/");

  return {
    collection,
    absolutePath,
    relativePath: normalizedRelativePath,
    routePath: normalizeRoutePath(sitePath),
    sitePath,
    sourcePath,
    sourceUrl: `${repoUrl}/blob/main/${sourcePath}`,
    title,
    description,
    body: parsed.content,
    headings: extractHeadings(tokens),
    isLanding: path.basename(relativePath) === landingFiles[collection],
  };
}

function walkMarkdownFiles(dir) {
  const items = [];

  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const absolutePath = path.join(dir, entry.name);

    if (entry.isDirectory()) {
      items.push(...walkMarkdownFiles(absolutePath));
      continue;
    }

    if (entry.isFile() && absolutePath.endsWith(".md")) {
      items.push(absolutePath);
    }
  }

  return items;
}

function buildSitePath(collection, relativePath) {
  if (path.basename(relativePath) === landingFiles[collection]) {
    return `/${collection}/`;
  }

  const withoutExtension = relativePath.replace(/\.md$/i, "");
  const segments = withoutExtension
    .split(/[\\/]+/)
    .filter(Boolean)
    .map(slugifySegment);

  return `/${collection}/${segments.join("/")}/`;
}

function parseGuidesNavigation(bySource) {
  const readmePath = normalizeFsPath(path.join(guidesRoot, "README.md"));
  const readme = bySource.get(readmePath);

  if (!readme) {
    return [];
  }

  const sections = [];
  let currentSection = createSection("Start Here");
  let currentSectionKey = "start";

  for (const line of readme.body.split(/\r?\n/)) {
    const trimmed = line.trim();

    if (trimmed === "Failure-mode guides:") {
      sections.push(currentSection);
      currentSection = createSection("Failure Modes");
      currentSectionKey = "failures";
      continue;
    }

    if (trimmed === "Workloads and hardening:") {
      sections.push(currentSection);
      currentSection = createSection("Hardening");
      currentSectionKey = "hardening";
      continue;
    }

    const match = trimmed.match(/^\* \[(.+?)\]\((.+?)\)$/);
    if (!match) {
      continue;
    }

    const [, label, href] = match;
    const target = resolveMarkdownHref(readme.absolutePath, href, bySource);
    if (!target?.doc) {
      continue;
    }

    const isHardeningDoc = target.doc.relativePath.startsWith("hardening/");

    if (currentSectionKey === "hardening") {
      if (!isHardeningDoc || shouldExcludeDoc("guides", target.doc.relativePath)) {
        continue;
      }

      currentSection.items.push({
        title: target.doc.title,
        href: target.doc.sitePath,
      });
      continue;
    }

    if (isHardeningDoc) {
      continue;
    }

    currentSection.items.push({
      title: label,
      href: target.doc.sitePath,
    });
  }

  sections.push(currentSection);
  return sections.filter((section) => section.items.length > 0);
}

function parseWikiNavigation(bySource) {
  const sidebarPath = normalizeFsPath(path.join(wikiRoot, "_Sidebar.md"));
  const raw = fs.readFileSync(sidebarPath, "utf8");
  const items = [];

  for (const line of raw.split(/\r?\n/)) {
    const trimmed = line.trim();
    const match = trimmed.match(/^\* \[(.+?)\]\((.+?)\)$/);
    if (!match) {
      continue;
    }

    const [, label, href] = match;
    const target = resolveMarkdownHref(sidebarPath, href, bySource);
    if (!target?.doc) {
      continue;
    }

    items.push({
      title: label,
      href: target.doc.sitePath,
    });
  }

  return [{ title: "Concepts", items }];
}

function renderMarkdown(doc, bySource) {
  const headingQueue = [...doc.headings];
  const renderer = new marked.Renderer();

  renderer.heading = function heading(token) {
    const nextHeading = headingQueue.shift();
    const id = nextHeading?.id ?? slugifySegment(token.text);
    const inner = this.parser.parseInline(token.tokens);
    return `<h${token.depth} id="${id}">${inner}</h${token.depth}>`;
  };

  renderer.link = function link(token) {
    const resolved = resolveMarkdownHref(doc.absolutePath, token.href, bySource);
    const href = resolved?.href ?? token.href;
    const title = token.title ? ` title="${escapeAttribute(token.title)}"` : "";
    const external = /^https?:\/\//i.test(href);
    const attrs = external ? ' target="_blank" rel="noreferrer"' : "";
    const inner = this.parser.parseInline(token.tokens);
    return `<a href="${escapeAttribute(href)}"${title}${attrs}>${inner}</a>`;
  };

  renderer.image = function image(token) {
    const resolved = resolveMarkdownHref(doc.absolutePath, token.href, bySource);
    const href = resolved?.href ?? token.href;
    const title = token.title ? ` title="${escapeAttribute(token.title)}"` : "";
    return `<img src="${escapeAttribute(href)}" alt="${escapeAttribute(token.text)}"${title} />`;
  };

  const html = marked.parse(doc.body, {
    gfm: true,
    renderer,
  });

  return {
    html,
    toc: doc.headings
      .filter((heading) => heading.depth >= 2 && heading.depth <= 3)
      .map((heading) => ({
        depth: heading.depth,
        id: heading.id,
        text: heading.text,
      })),
  };
}

function resolveMarkdownHref(currentFile, href, bySource) {
  if (!href || href.startsWith("#")) {
    return { href };
  }

  if (/^(https?:|mailto:|tel:)/i.test(href)) {
    return { href };
  }

  if (href.startsWith("/")) {
    return { href };
  }

  const [rawTarget, hash = ""] = href.split("#");
  const currentDir = path.dirname(currentFile);
  const directTarget = normalizeFsPath(path.resolve(currentDir, rawTarget));
  const fallbackTarget =
    path.extname(rawTarget) === ""
      ? `${directTarget}.md`
      : directTarget;

  const targetPath = fs.existsSync(directTarget)
    ? directTarget
    : fs.existsSync(fallbackTarget)
      ? fallbackTarget
      : directTarget;

  const linkedDoc = bySource.get(targetPath);
  if (linkedDoc) {
    return {
      href: hash ? `${linkedDoc.sitePath}#${hash}` : linkedDoc.sitePath,
      doc: linkedDoc,
    };
  }

  const normalizedRepoRoot = normalizeFsPath(repoRoot);
  if (targetPath.startsWith(normalizedRepoRoot)) {
    const relative = path.relative(repoRoot, targetPath).replace(/\\/g, "/");
    const anchor = hash ? `#${hash}` : "";
    return {
      href: `${repoUrl}/blob/main/${relative}${anchor}`,
    };
  }

  return { href };
}

function extractTitle(tokens) {
  return tokens.find((token) => token.type === "heading" && token.depth === 1)?.text;
}

function extractDescription(tokens) {
  const descriptionToken = tokens.find((token) => token.type === "paragraph");
  return descriptionToken?.text ?? "";
}

function extractHeadings(tokens) {
  const slugCounts = new Map();
  const headings = [];

  for (const token of tokens) {
    if (token.type !== "heading") {
      continue;
    }

    const baseSlug = slugifySegment(token.text);
    const count = slugCounts.get(baseSlug) ?? 0;
    slugCounts.set(baseSlug, count + 1);

    headings.push({
      depth: token.depth,
      text: token.text,
      id: count === 0 ? baseSlug : `${baseSlug}-${count + 1}`,
    });
  }

  return headings;
}

function humanizeTitle(relativePath) {
  const stem = relativePath
    .replace(/\.md$/i, "")
    .split(/[\\/]+/)
    .pop()
    ?.replace(/[-_]+/g, " ");

  return stem
    ?.split(" ")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

function shouldExcludeDoc(collection, relativePath) {
  const normalizedRelativePath = relativePath.replace(/\\/g, "/");

  if (
    collection === "guides" &&
    normalizedRelativePath.startsWith("hardening/") &&
    !includedGuidesHardeningFiles.has(normalizedRelativePath)
  ) {
    return true;
  }

  return false;
}

function resolveDisplayTitle(collection, relativePath, fallbackTitle) {
  if (collection === "guides") {
    return hardeningTitleOverrides.get(relativePath) ?? fallbackTitle;
  }

  return fallbackTitle;
}

function slugifySegment(value) {
  return value
    .toLowerCase()
    .replace(/[`'"]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function cleanInlineText(value) {
  return value
    .replace(/`/g, "")
    .replace(/\[(.+?)\]\(.+?\)/g, "$1")
    .replace(/\*\*(.+?)\*\*/g, "$1")
    .replace(/\*(.+?)\*/g, "$1")
    .trim();
}

function normalizeFsPath(value) {
  return path.resolve(value).replace(/\\/g, "/");
}

function normalizeRoutePath(value = "/") {
  if (!value || value === "/") {
    return "/";
  }

  const normalized = value.replace(/\\/g, "/").replace(/^\/|\/$/g, "");
  return normalized ? `/${normalized}/` : "/";
}

function createSection(title) {
  return { title, items: [] };
}

function escapeAttribute(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}
