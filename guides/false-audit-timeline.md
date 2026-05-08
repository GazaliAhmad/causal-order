# False Audit Timelines

Audit timelines are dangerous because they are often treated as factual records after the fact.

## The Failure Mode

A compliance export or internal audit tool may take records from several systems and sort them by timestamp:

1. `access_granted`
2. `policy_approved`
3. `actor_authenticated`

If those timestamps came from different nodes with drift, partial metadata, or replay artifacts, that ordering can be false while still looking official.

## Why This Is Worse Than A Debugging Error

In debugging, a wrong order wastes engineering time.
In an audit or compliance context, a wrong order can misrepresent who did what, when, and with what authorization context.

## What The Library Should Surface

In audit mode, the library should help teams say:

* this relationship is `proven`
* this one is only `derived`
* this relationship should remain `unknown` rather than being flattened into false certainty
* this part of the evidence is `unknown`

That is a stronger audit posture than emitting a single false total order.

## Practical Reading

A trustworthy audit timeline is not always the most linear timeline.
Sometimes the honest result is:

```txt
the records do not justify a stronger claim
```

That is not weakness.
That is integrity.
