# Offline Sync Anomalies

Offline-first systems are one of the clearest examples of why timestamp sorting is not enough.

They are also a realistic example of a deployment that cannot rely on a globally synchronized server clock to keep operating usefully.

## The Failure Mode

A mobile device can create events while disconnected:

1. `draft_created`
2. `draft_edited`
3. `draft_submitted`

Hours later, the device reconnects and uploads them after server-side events have already happened:

* `review_started`
* `notification_sent`

Naive sorting by server ingestion time can make the offline device appear late to its own history.

## Why This Happens

Offline systems break the hidden assumption that creation time, observation time, and ingestion time are close enough to be interchangeable.

That gap is not always a few seconds.
In real deployments, a central server may be down for `4` to `8` hours while devices or nodes continue locally and sync only when the server is available again.

Those timelines are not interchangeable.

## What The Library Should Surface

The library should help a developer distinguish:

* local monotonic sequence on the device
* server ingestion order
* derived HLC order across nodes
* places where order is only partially knowable

This is where `same_node_sequence` and explicit evidence matter.

## Why This Matters

If an offline sync system is forced into one clean server-side order, the application may accidentally tell a false story about user intent and state evolution.

`causal-order` is useful here because it lets the system preserve ambiguity where ambiguity is real.
