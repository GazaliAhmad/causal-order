# Website

This app renders the public documentation site for `causal-order`.

The source of truth for content stays in the repository root:

* `../guides`
* `../wiki`

The website does not keep a duplicated docs tree under `website/`.
It reads those Markdown files directly at build time and turns:

* doc-to-doc links into internal site routes
* doc-to-source links into GitHub blob links

## Local Development

From the repo root:

```bash
npm run site:dev
```

Build the static site:

```bash
npm run site:build
```

## Cloudflare Pages

Recommended Pages settings:

* Root directory: `website`
* Build command: `npm run build`
* Build output directory: `dist`

If you prefer to keep the Pages project pointed at the repo root instead:

* Build command: `npm run site:build`
* Build output directory: `website/dist`
