# Catalogue tiling and visibility

Owns multiresolution sky indexing, magnitude/quality tiers, observer/frustum selection, proper-motion safety margins, and flux-conserving batches for runtime evaluation.

The likely spatial basis is HEALPix or a compatible hierarchical equal-area scheme; the final choice must consider neighbour queries, equal-area aggregation, spherical transforms, streaming ranges, and available tooling. Native precompute performs quality filtering and tier construction. Runtime selection must avoid star popping and preserve aggregate flux when transitioning between resolved and statistical/diffuse representations.
