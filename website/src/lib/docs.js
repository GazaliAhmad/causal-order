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
// Website boundary:
// - `guides/` on the site are package-facing usage and workflow docs.
// - `wiki/` on the site is conceptual explanation for users.
// - implementation records, decision records, stability notes, migration notes,
//   and other repo-local design/release artifacts stay in the repo only.
const includedGuidesHardeningFiles = new Set([
  "hardening/anomaly-surface-0.3.2.md",
  "hardening/fuzz-testing-0.3.2.md",
  "hardening/runtime-stability-0.3.4.md",
  "hardening/streaming-hardening-0.3.3.md",
]);
const repoOnlyGuideDirectoryPrefixes = ["devex/", "stability/"];
const repoOnlyGuideBaseNamePrefixes = [
  "implementation-guide-",
  "decision-record-",
  "release-prep-",
  "migration-notes-",
  "exported-surface-inventory-",
  "default-behavior-compatibility-inventory-",
  "domain-semantic-design-notes-",
];
const repoOnlyGuideFiles = new Set([
  "operations/implementation-guide-0.6.0.md",
]);
const hardeningTitleOverrides = new Map([
  ["hardening/anomaly-surface-0.3.2.md", "Anomaly Surface Audit"],
  ["hardening/fuzz-testing-0.3.2.md", "Fuzz Testing"],
  ["hardening/runtime-stability-0.3.4.md", "Runtime Stability"],
  ["hardening/streaming-hardening-0.3.3.md", "Streaming Hardening And Pressure"],
]);
const featuredDocRoutePaths = {
  guides: [
    "/guides/quick-start-scenarios/",
    "/guides/policy-guidance/",
    "/guides/operations/replay-inspection-workflow/",
    "/guides/operations/operator-metrics-guide/",
  ],
  wiki: [
    "/wiki/what-this-library-is/",
    "/wiki/the-problem-with-distributed-timelines/",
    "/wiki/concurrent-vs-unknown/",
    "/wiki/confidence-levels/",
    "/wiki/streaming-finality/",
  ],
};

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
    guides: getFeaturedDocsForCollection("guides"),
    wiki: getFeaturedDocsForCollection("wiki"),
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
  const normalizedRelativePath = relativePath.replace(/\\/g, "/");
  const body = prepareDocBody(collection, normalizedRelativePath, parsed.content);
  const tokens = marked.lexer(body, { gfm: true });
  const hasExplicitDescription =
    typeof parsed.data.description === "string" &&
    parsed.data.description.trim().length > 0;
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
    body,
    tokens,
    hasExplicitDescription,
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
  const sectionTransitions = new Map([
    ["Failure-mode guides:", { title: "Failure Modes", key: "failures" }],
    ["## Failure Modes", { title: "Failure Modes", key: "failures" }],
    ["Workloads and hardening:", { title: "Hardening", key: "hardening" }],
    ["## Workloads And Hardening", { title: "Hardening", key: "hardening" }],
    ["Support and upgrades:", { title: "Support And Upgrades", key: "support-upgrades" }],
    ["## Support And Upgrades", { title: "Support And Upgrades", key: "support-upgrades" }],
    ["Developer experience:", { title: "Policy Guidance", key: "policy-guidance" }],
    ["Policy guidance:", { title: "Policy Guidance", key: "policy-guidance" }],
    ["## Policy Guidance", { title: "Policy Guidance", key: "policy-guidance" }],
    ["Published `0.7.0` release line:", { title: "Release Context", key: "release-context" }],
    ["Operational workflows:", { title: "Operations", key: "operations" }],
    ["## Operational Workflows", { title: "Operations", key: "operations" }],
    ["Published stability line:", { title: "Stability", key: "stability" }],
    ["Runnable examples:", { title: "Examples", key: "examples" }],
    ["## Runnable Examples", { title: "Examples", key: "examples" }],
    ["Stability candidate:", { title: "Stability", key: "stability" }],
  ]);

  for (const line of readme.body.split(/\r?\n/)) {
    const trimmed = line.trim();

    const transition = sectionTransitions.get(trimmed);
    if (transition) {
      sections.push(currentSection);
      currentSection = createSection(transition.title);
      currentSectionKey = transition.key;
      continue;
    }

    const match = trimmed.match(/^\* \[(.+?)\]\((.+?)\)$/);
    if (!match) {
      continue;
    }

    const [, label, href] = match;
    const cleanLabel = cleanInlineText(label);
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
      title: cleanLabel,
      href: target.doc.sitePath,
    });
  }

  sections.push(currentSection);
  return collapseGuideNavigationSections(
    sections.filter((section) => section.items.length > 0),
  );
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
      title: cleanInlineText(label),
      href: target.doc.sitePath,
    });
  }

  return [{ title: "Concepts", items }];
}

function renderMarkdown(doc, bySource) {
  const headingQueue = [...doc.headings];
  const tokens = getRenderableTokens(doc);
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

  renderer.table = function table(token) {
    let header = "";
    let cell = "";

    for (let j = 0; j < token.header.length; j += 1) {
      cell += this.tablecell(token.header[j]);
    }

    header += this.tablerow({ text: cell });

    let body = "";
    for (let j = 0; j < token.rows.length; j += 1) {
      const row = token.rows[j];
      cell = "";

      for (let k = 0; k < row.length; k += 1) {
        cell += this.tablecell(row[k]);
      }

      body += this.tablerow({ text: cell });
    }

    const tbody = body ? `<tbody>${body}</tbody>` : "";
    const tableHtml = `<table>\n<thead>\n${header}</thead>\n${tbody}</table>\n`;

    return `<div class="markdown-table-scroll">${tableHtml}</div>`;
  };

  const html = marked.parser(tokens, {
    gfm: true,
    renderer,
  });

  return {
    html,
    toc: buildTableOfContents(doc.headings),
  };
}

function buildTableOfContents(headings) {
  const tocHeadings = headings.filter(
    (heading) => heading.depth >= 2 && heading.depth <= 3,
  );
  const repeatedDepth3Texts = new Set(
    tocHeadings
      .filter((heading) => heading.depth === 3)
      .map((heading) => heading.text)
      .filter((text, index, values) => values.indexOf(text) !== index),
  );

  return tocHeadings
    .filter(
      (heading) =>
        heading.depth !== 3 || !repeatedDepth3Texts.has(heading.text),
    )
    .map((heading) => ({
      depth: heading.depth,
      id: heading.id,
      text: heading.text.replace(/`/g, ""),
    }));
}

function getRenderableTokens(doc) {
  const tokens = [...doc.tokens];

  if (doc.hasExplicitDescription || !doc.description) {
    return tokens;
  }

  const firstHeadingIndex = tokens.findIndex(
    (token) => token.type === "heading" && token.depth === 1,
  );
  const searchStartIndex = firstHeadingIndex >= 0 ? firstHeadingIndex + 1 : 0;
  const firstParagraphIndex = tokens.findIndex(
    (token, index) => index >= searchStartIndex && token.type === "paragraph",
  );

  if (firstParagraphIndex === -1) {
    return tokens;
  }

  const firstParagraph = tokens[firstParagraphIndex];
  const firstParagraphText = cleanInlineText(firstParagraph.text ?? "");

  if (firstParagraphText !== doc.description) {
    return tokens;
  }

  tokens.splice(firstParagraphIndex, 1);
  return tokens;
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
  const title = tokens.find(
    (token) => token.type === "heading" && token.depth === 1,
  )?.text;
  return title ? cleanInlineText(title) : undefined;
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

    const text = cleanInlineText(token.text);
    const baseSlug = slugifySegment(token.text);
    const count = slugCounts.get(baseSlug) ?? 0;
    slugCounts.set(baseSlug, count + 1);

    headings.push({
      depth: token.depth,
      text,
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

function prepareDocBody(collection, relativePath, body) {
  if (collection === "guides" && relativePath === "README.md") {
    return body
      .replace(
        /\r?\nUse the `0\.5\.0` release notes and stability implementation guide when you want the narrower contract and compatibility reasoning behind the current surface\.\r?\n/g,
        "\n",
      )
      .replace(/^\* \[Developer Experience\]\(\.\/devex\/developer-experience-0\.4\.0\.md\)\r?\n/gm, "")
      .replace(/^\* \[Implementation Guide `0\.4\.1`\]\(\.\/devex\/implementation-guide-0\.4\.1\.md\)\r?\n/gm, "")
      .replace(/^\* \[Implementation Guide `0\.4\.2`\]\(\.\/devex\/implementation-guide-0\.4\.2\.md\)\r?\n/gm, "")
      .replace(/^\* \[Release Notes `0\.4\.2`\]\(\.\.\/docs\/releases\/0\.4\.2\.md\)\r?\n/gm, "")
      .replace(/^\* \[Release Notes `0\.5\.0`\]\(\.\.\/docs\/releases\/0\.5\.0\.md\)\r?\n/gm, "")
      .replace(
        /\r?\nPublished `0\.7\.0` release line:\r?\n(?:\r?\n|\* .*\r?\n)+?(?=\r?\nOperational workflows:)/,
        "\n\n",
      )
      .replace(
        /\r?\nPublished stability line:\r?\n(?:\r?\n|\* .*\r?\n)+?(?=\r?\nRunnable examples:)/,
        "\n\n",
      )
      .replace(/\r?\nStart here:\r?\n/g, "\n\n## Start Here\n\n")
      .replace(/\r?\nWorkloads and hardening:\r?\n/g, "\n\n## Workloads And Hardening\n\n")
      .replace(/\r?\nSupport and upgrades:\r?\n/g, "\n\n## Support And Upgrades\n\n")
      .replace(/\r?\nDeveloper experience:\r?\n/g, "\n\n## Policy Guidance\n\n")
      .replace(/\r?\nPolicy guidance:\r?\n/g, "\n\n## Policy Guidance\n\n")
      .replace(/\r?\nOperational workflows:\r?\n/g, "\n\n## Operational Workflows\n\n")
      .replace(/\r?\nRunnable examples:\r?\n/g, "\n\n## Runnable Examples\n\n")
      .replace(/\r?\nFailure-mode guides:\r?\n/g, "\n\n## Failure Modes\n\n");
  }

  return body;
}

function shouldExcludeDoc(collection, relativePath) {
  const normalizedRelativePath = relativePath.replace(/\\/g, "/");

  if (collection === "guides") {
    return shouldExcludeGuideDoc(normalizedRelativePath);
  }

  return false;
}

function shouldExcludeGuideDoc(relativePath) {
  if (isRepoOnlyGuideDoc(relativePath)) {
    return true;
  }

  if (
    relativePath.startsWith("hardening/") &&
    !includedGuidesHardeningFiles.has(relativePath)
  ) {
    return true;
  }

  return false;
}

function isRepoOnlyGuideDoc(relativePath) {
  const baseName = path.basename(relativePath);

  if (repoOnlyGuideFiles.has(relativePath)) {
    return true;
  }

  if (
    repoOnlyGuideDirectoryPrefixes.some((prefix) =>
      relativePath.startsWith(prefix),
    )
  ) {
    return true;
  }

  if (
    repoOnlyGuideBaseNamePrefixes.some((prefix) =>
      baseName.startsWith(prefix),
    )
  ) {
    return true;
  }

  return false;
}

function getFeaturedDocsForCollection(collection) {
  const featuredPaths = featuredDocRoutePaths[collection] ?? [];
  const docs = getDocsByCollection(collection);
  const featured = featuredPaths
    .map((routePath) => docs.find((doc) => doc.routePath === routePath))
    .filter(Boolean);

  if (featured.length > 0) {
    return featured;
  }

  return getNavigation(collection)[0]?.items.slice(0, 4) ?? [];
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

function collapseGuideNavigationSections(sections) {
  const collapsed = [];

  for (const section of sections) {
    const shouldFoldIntoStartHere =
      section.title === "Policy Guidance" &&
      section.items.length === 1 &&
      section.items[0]?.title === "Policy Guidance";

    if (shouldFoldIntoStartHere) {
      const startHereSection = collapsed.find(
        (entry) => entry.title === "Start Here",
      );

      if (startHereSection) {
        startHereSection.items.push(...section.items);
        continue;
      }
    }

    collapsed.push(section);
  }

  return collapsed;
}

function escapeAttribute(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}
