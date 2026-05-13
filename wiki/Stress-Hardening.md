# Stress Hardening

Stress hardening exists to answer a different question from small semantic fixtures.

Small fixtures tell you whether the logic is correct on readable examples.
Stress hardening tells you whether that same logic stays honest when the input becomes large, corrupted, and operationally messy.

## Why It Matters

Without stress work, a library can look correct while still hiding problems such as:

* anomaly-heavy performance cliffs
* pathological allocation behavior
* large-batch failure modes that never appear on tiny fixtures

For `causal-order`, the point of stress hardening is not abstract number chasing.
It is to pressure-test realistic failure shapes at a size where implementation weaknesses become visible.

## The Conceptual Rule

The important distinction is:

* benchmark numbers by themselves are not the product story
* semantic honesty under ugly data is the product story

That is why the project treats corrupted-dataset stress work as credibility work, not just speed work.

In practice, that means the stress suite should help answer questions like:

* does weak evidence still remain weak under pressure?
* do anomalies stay visible instead of being flattened away?
* does the implementation remain usable when corruption is dense?

## Why The `150k` Band Matters

The `150k` stress band is best understood as a hardening envelope, not a bragging number.

It is meant to represent a believable operational slice such as:

* a central server outage lasting several hours
* many nodes continuing locally
* a large delayed backlog arriving for reconciliation later

So the scale matters because it makes the corruption patterns operationally meaningful, not because the project is trying to claim unlimited in-memory scale.

## Where To Go Next

For the canonical operational guide, profile shapes, commands, and benchmark interpretation, see:

* [Stress Hardening guide](../guides/stress-hardening.md)

For the workload-shaping discussion around `100k`, `150k`, and when streaming becomes the more honest model, see:

* [Realistic Workloads](Realistic-Workloads)
