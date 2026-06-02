export function GET({ site }) {
  const lines = [
    "User-agent: *",
    "Content-signal: search=yes, ai-input=yes, ai-train=yes",
    "Allow: /",
    "Disallow: /offline/",
    "",
    "User-agent: OAI-SearchBot",
    "Allow: /",
    "",
    "User-agent: GPTBot",
    "Allow: /",
    "",
    "User-agent: ClaudeBot",
    "Allow: /",
    "",
    "User-agent: Claude-SearchBot",
    "Allow: /",
    "",
    "User-agent: Claude-User",
    "Allow: /",
    "",
    "User-agent: Googlebot",
    "Allow: /",
    "",
    "User-agent: Google-Extended",
    "Allow: /",
  ];

  if (site) {
    lines.push("");
    lines.push(`Sitemap: ${new URL("/sitemap.xml", site).toString()}`);
  }

  return new Response(`${lines.join("\n")}\n`, {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
    },
  });
}
