# Release Process

This guide documents the normal release path for `causal-order`.

It is intentionally practical.
Use it when cutting a release line, finishing follow-through work, or tagging a published version.

## Release Shape

The normal sequence is:

1. choose a scoped release line
2. land the code and docs on a focused branch
3. verify the release-facing checks
4. merge to `main`
5. update local `main`
6. create the annotated tag
7. push the tag
8. publish release notes if needed

## Before Opening A Release PR

Make sure the branch has:

* a clear release scope
* aligned `CHANGELOG.md` wording
* aligned `ROADMAP.md` wording when milestone framing changed
* updated docs if public posture changed
* updated examples if recommended usage changed

## Release-Facing Checks

At minimum, run:

```bash
npm run check
npm test
npm run docs:sync:check
```

For release lines that touch package posture, examples, or docs automation, also run:

```bash
npm run prepack
npm run badge:footprint:check
```

For release lines that touch performance or runtime-stability claims, also run the matching perf commands and record the exact profile used in the PR.

## PR Expectations

A release PR should say:

* what changed
* why it belongs in the release line
* what was intentionally left out
* how it was verified

If the repo template is present, use it rather than inventing a custom format.

## Merge And Sync

After the PR is merged:

```bash
git checkout main
git pull --ff-only
```

If the release branch is no longer needed:

```bash
git branch -d release/x.y.z
git push origin --delete release/x.y.z
```

## Tagging

Create an annotated tag from updated `main`:

```bash
git tag -a v0.7.0 -m "v0.7.0 - transferability baseline and public docs polish"
git push origin v0.7.0
```

Use a short honest message.
The annotation should summarize the release line, not repeat the whole changelog.

## Release Notes

Keep the sources aligned:

* `CHANGELOG.md`
* `docs/releases/...`
* `ROADMAP.md` when milestone framing changed

The changelog should stay concise.
Longer narrative belongs in `docs/releases/`.

## Website Release Notes And Metadata

If the release changes website-facing behavior, also check:

* sitemap generation
* RSS generation
* social/share metadata defaults
* guides/wiki/API navigation consistency

For Cloudflare Pages, remember that the website build runs with `website/` as the project root.

## Failure Handling

If a release check fails:

* fix the underlying issue first
* avoid waving through a failure with wording alone
* if a workflow failure is due to missing install/setup expectations, fix the workflow in the same release follow-through line

## After Release

After the tag is pushed:

* confirm the tag appears remotely
* confirm the release notes or tag annotation are readable
* confirm the website or package deployment signals are healthy if that release touched them
* move roadmap attention to the next scoped chunk
