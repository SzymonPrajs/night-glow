# `nightglow-solver`

The first scheduler makes the synthetic DAG explicit: resolve astronomy, validate
assets, solve transfer, then publish one coherent product. Progress events and
cooperative cancellation occur at bounded stage boundaries; cancellation never
publishes a partial product.

Future caches and refinement belong here only after the underlying physical
calculations pass their reference and convergence gates.
