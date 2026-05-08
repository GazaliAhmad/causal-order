# causal-order Wiki

`causal-order` is a library for reconstructing distributed event timelines without pretending the system knows more than it does.

This wiki is the conceptual layer of the project.
It explains the mental model behind the library, why the problem is harder than ordinary timestamp sorting, and how `causal-order` tries to stay honest without becoming unusable.

If the README is the quick path, this wiki is the deeper explanation.

## Start Here

If you are new to the project, read these pages first:

1. [What This Library Is](What-This-Library-Is)
2. [The Problem With Distributed Timelines](The-Problem-With-Distributed-Timelines)
3. [Confidence Levels](Confidence-Levels)
4. [Concurrent vs Unknown](Concurrent-vs-Unknown)

## Conceptual Pages

* [What This Library Is](What-This-Library-Is)
* [The Problem With Distributed Timelines](The-Problem-With-Distributed-Timelines)
* [Why Timestamp Sorting Fails](Why-Timestamp-Sorting-Fails)
* [Confidence Levels](Confidence-Levels)
* [Concurrent vs Unknown](Concurrent-vs-Unknown)
* [Streaming Finality](Streaming-Finality)
* [Realistic Workloads](Realistic-Workloads)
* [Design Philosophy](Design-Philosophy)
* [When to Use causal-order](When-to-Use-causal-order)

## The Core Idea

The library does not try to make distributed event order magically certain.
It tries to answer a more honest question:

> What can be ordered safely, what is only inferred, what can be justified as concurrent, and what should remain unknown?

That means the value of the library is not just:

* sorting events

It is also:

* showing when order is justified
* showing when order is only derived
* refusing to flatten concurrency into fake sequence
* making suspicious or weak metadata visible

## Project Standard

`causal-order` should feel easy to use at the surface, but difficult to misuse into false certainty.
