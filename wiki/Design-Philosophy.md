# Design Philosophy

`causal-order` is guided by a simple product standard:

> Be easy to use at the surface, but hard to misuse into false certainty.

Everything else in the project is downstream of that idea.

## Core Values

The design philosophy can be summarized like this:

* correctness matters more than feature count
* uncertainty should be explicit
* streaming claims should be operationally honest
* documentation and examples are part of the product

## The Main Tension

The project is trying to avoid two bad outcomes.

### Too simple

If the library becomes too simple, it risks doing little more than timestamp sorting with better branding.

### Too pure

If the library becomes too conceptually heavy, it risks becoming correct but unusable.

## The Target Shape

The target shape is something like:

* boring to start
* profound when inspected

That means:

* simple entry points
* inspectable outputs
* meaningful confidence levels
* progressive disclosure of complexity

Users should not have to absorb the full theory to get value.
But the theory should be there when the simple answer stops being safe.
