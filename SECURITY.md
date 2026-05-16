# Security Policy

## Supported Versions

Security fixes are provided on a best-effort basis for the current development line and the latest published `0.3.x` release.

| Version | Supported |
| --- | --- |
| `main` / unreleased work | best effort |
| latest `0.3.x` | yes |
| older `0.x` lines | no |

Because `causal-order` is still in the `0.x` phase, security and hardening work may land in the latest release line without backporting to older tags.

## Reporting a Vulnerability

Please do **not** open a public GitHub issue for an undisclosed security vulnerability.

Instead:

1. gather the affected version, impact, and reproduction details
2. include whether the issue affects:
   * batch ordering
   * streaming behavior
   * validation
   * anomaly detection
   * documentation or website infrastructure
3. report it privately to [team@rightbusiness.com.sg](mailto:team@rightbusiness.com.sg)

If a report is validated, the goal is to:

* acknowledge receipt within a reasonable timeframe
* assess severity, exploitability, and downstream impact
* prepare a fix, mitigation, or documented workaround where practical
* disclose the issue responsibly after a fix is available, when appropriate

## Scope

This policy covers:

* the published `causal-order` npm package
* the core library source in this repository
* the documentation website source under `website/`

It does not guarantee support for vulnerabilities in third-party dependencies beyond upgrading, replacing, or documenting them where practical.

## Supply Chain Integrity

Releases are published from the canonical source repository and linked to the npm package source reference where possible.

Consumers should avoid installing unofficial forks or republished variants.
