# Contributing

Thanks for contributing to `causal-order`.

This repository is still in the `0.x` phase.
That means the project is public and usable, but the main job is still to harden the core contract rather than expand scope casually.

The best contributions are usually:

* small
* well-scoped
* easy to verify
* aligned with the current milestone

## Before You Start

Read these first:

* [README.md](./README.md)
* [ROADMAP.md](./ROADMAP.md)
* [SECURITY.md](./SECURITY.md)
* [CODE_OF_CONDUCT.md](./CODE_OF_CONDUCT.md)

If you are touching current hardening work, also read the matching guide under:

* [`guides/hardening/`](./guides/hardening/)

## Project Shape

The repository is split into a few clear areas:

* `src/`
  * core library code
* `test/`
  * direct tests, seeded fuzz coverage, and release-gate checks
* `perf/`
  * benchmark, profiling, and runtime-stability harnesses
* `guides/`
  * practical, repo-coupled documentation
* `wiki/`
  * conceptual documentation and mental-model notes
* `website/`
  * Astro docs site that surfaces guides, wiki, and API material without duplicating source docs

## Local Setup

Use Node.js `24` for repository development work.

The published npm package officially supports Node.js `>=20`.

```bash
npm install
```

Useful commands:

```bash
npm run build
npm run check
npm test
npm run bench:check
npm run release:check
```

Website commands:

```bash
npm run site:dev
npm run site:build
npm run site:preview
```

Current runtime policy for repository work:

* use Node.js `24` for local repository work
* the published package officially supports Node.js `>=20`
* CI runs against Node.js `18`, `20`, and `24`
* Node.js `18` coverage is best-effort regression validation, not a formal support contract

## Contribution Style

Prefer work that keeps one change set doing one job.

Good examples:

* a runtime optimization without docs churn mixed into it
* a new pressure profile without unrelated semantic edits
* a docs alignment pass without hidden behavior changes

Avoid combining these unless there is a strong reason:

* stream semantic changes plus perf harness work
* batch hardening plus website work
* release wording plus unverified runtime claims
* exploratory ideas plus committed release-surface changes

## Branching

For milestone work, use a focused branch.

Examples:

* `release/0.3.4`
* `docs/privacy-page`
* `perf/gc-observed-runs`

If you keep working on a release branch after part of it is merged, sync it with `main` before continuing:

```bash
git checkout release/0.3.4
git fetch origin
git merge origin/main
```

## Commits

Keep commit messages short and honest.

Examples:

* `stream: reduce flushReady buffer rescans in orderEventStream`
* `perf: add constrained-heap stream endurance runs`
* `docs: finalize 0.3.3 hardening and guardrail updates`
* `website: avoid Astro.url in prerendered layouts`

Try not to use one commit for several unrelated concerns.

## Tests And Verification

At minimum, run the checks that match the kind of change you made.

For library code:

```bash
npm run check
npm test
```

For release-facing or performance-sensitive changes:

```bash
npm run release:check
```

For website changes:

```bash
npm run site:build
```

For runtime-stability and pressure work, include the exact command you used in the PR notes when it matters.

## Documentation Expectations

If behavior, posture, or release claims change, update the docs in the same pull request.

That usually means one or more of:

* `README.md`
* `CHANGELOG.md`
* `ROADMAP.md`
* `guides/hardening/...`
* `website/` if the surfaced docs or site behavior changed

Do not quietly let release docs drift away from the code.

## Roadmap Discipline

Not every good idea belongs in the current milestone.

If something is useful but not yet clearly committed to the core runtime, prefer putting it in:

* `ROADMAP.md`
  * usually under a tentative or future section

This repository tries to keep a clear boundary between:

* core contract work
* operational hardening
* future ecosystem or glue ideas

## Pull Requests

A good PR description should say:

* what changed
* why it belongs in the current milestone
* how it was verified
* what is intentionally not included

For milestone chunks, it is helpful to name the chunk directly in the PR summary.

## Security

If you believe you found a security issue, do not open a public issue first.

Follow [SECURITY.md](./SECURITY.md) and report it privately.

## License

By contributing, you agree that your contributions will be released under the MIT license used by this repository.
