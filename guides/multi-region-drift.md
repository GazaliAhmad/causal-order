# Multi-Region Drift

Multi-region systems often have clocks that are good enough for operations but not trustworthy enough for causal truth.

## The Failure Mode

Suppose one request path touches:

* `api-sg-1`
* `worker-us-1`
* `db-eu-1`

Each node emits timestamps from a different machine clock.

If the Singapore node is a little ahead and the US worker is a little behind, naive sorting may tell a story like:

1. `email_sent`
2. `user_created`
3. `billing_initialized`

That timeline looks precise.
It may also be nonsense.

## Why This Happens

Wall clocks can drift.
NTP can lag.
Virtual machines can pause.
Cloud instances can disagree by just enough to create believable but false event order.

## What The Library Should Surface

In a case like this, the library should distinguish between:

* HLC or timestamp-based ordering that is only `derived`
* explicit dependencies that make some relationships `proven`
* cross-node events that may actually be `concurrent`

This is especially important when a user expects a total order simply because every record has a timestamp.

## The Business Value

Without this distinction, a team can produce a confident postmortem timeline that is cleaner than reality.

That is exactly the kind of false certainty `causal-order` is designed to prevent.
