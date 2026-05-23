# Website Notes

These notes track docs-site and website refinements that do not map cleanly to a package version bump.

## Current Notes

Recent website work includes:

* docs navigation cleanup across guides, wiki, and API surfaces
* mobile docs polish, including return-to-top behavior and tighter footer grouping
* shared SEO metadata, `robots.txt`, `sitemap.xml`, and PWA metadata improvements
* generated API reference improvements and reduced generated-snapshot churn

## API Reference

The docs-site API reference now:

* derives function pages and overview groups from the actual public `src/index.ts` export surface instead of a hand-maintained page map
* includes `translateBatch()` and the published translation types in the API reference
* uses a generated dynamic function-page route with shared usage and summary rendering
* keeps sidebar navigation focused on primary entry points so the export-driven reference stays comprehensive without becoming noisy
* treats raw-record translation as a first-class starting point in the API overview alongside batch ordering, stream ordering, validation, and pairwise comparison

## Published `0.4.0` Docs Surface

The website docs surface now also reflects the published `0.4.0` line more directly by:

* renaming the developer-experience docs surface from `0.4.x` to `0.4.0` in navigation and docs registry
* using `guides/devex/` as the live repository path for that material, with the old short-name path retired
* surfacing only the `0.4.0` developer-experience overview in website guides navigation while keeping the `0.4.0` implementation guide as a repo-only historical note and the `0.4.1` / `0.4.2` implementation guides as repo-only planning notes

## Artwork

The README banner artwork was adjusted so the subtitle no longer collides with the plotted lines in rendered website and GitHub contexts.
