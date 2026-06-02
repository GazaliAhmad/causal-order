# Website Notes

These notes track docs-site and website refinements that do not map cleanly to a package version bump.

## Current Notes

Recent website work includes:

* 0.9.0 release-surface alignment around the deployable event-ordering runtime posture
* docs navigation cleanup across guides, wiki, and API surfaces
* sidebar label cleanup so navigation titles strip inline Markdown formatting such as visible backticks
* mobile docs polish, including return-to-top behavior and tighter footer grouping
* shared SEO metadata, `robots.txt`, `sitemap.xml`, and PWA metadata improvements
* generated API reference improvements and reduced generated-snapshot churn
* homepage hero typography and measure tuning so the main title and intro copy wrap more naturally instead of breaking in awkward places

## `0.9.0` Website Release Surface

The 0.9.0 website pass repositioned the public site around `causal-order` as a deployable event-ordering runtime rather than a forensics-only or design-note-oriented package.

This pass included:

* homepage hero, subtitle, navigation tagline, CTA, and feature-card copy updated to emphasize deployment, replay, recovery, stream reconciliation, late-arrival policy, and operator-visible output
* website title, description, keywords, Open Graph metadata, and JSON-LD structured data aligned with the deployable-runtime framing
* package metadata and public website metadata kept consistent around distributed event ordering, causal ordering, Lamport clocks, vector clocks, HLC, replay, reconciliation, and late-arriving events
* public docs feeds and release-facing links adjusted so the website reads as documentation for the current runtime surface, not as a release-history archive
* repo-only stability and design notes kept out of public website navigation, with tests guarding against public pages linking to excluded docs
* mobile header tagline restored so the runtime direction remains visible on narrow screens

The public website should now present three layers clearly:

* practical guides for evaluating and deploying the runtime
* conceptual wiki pages for distributed-systems background and terminology
* API reference pages generated from the public package surface

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
* surfacing only the `0.4.0` developer-experience overview in website guides navigation while keeping the `0.4.0`, `0.4.1`, and `0.4.2` implementation guides as repo-only historical notes for the completed ingress follow-through track

## Artwork

The README banner artwork was adjusted so the subtitle no longer collides with the plotted lines in rendered website and GitHub contexts.

## Homepage Formatting

Recent homepage polish also includes:

* rebalancing the hero copy width so the main title wraps as a cleaner two-line statement
* widening the intro paragraph measure so the opening description reads as flowing prose rather than a cramped narrow block
* keeping the right-side output-contract panel in place while letting the left-side copy breathe more naturally
