# Terrain

Owns geometric horizon, line-of-sight visibility, shadowing, surface normals, and terrain support used by transfer and source projection.

Inputs: DEM/ellipsoid, observer/source geometry, Earth curvature, refraction policy, LOD/error tolerance. Outputs: horizon profile, occlusion/visibility, surface intersections, path masks, normals, and approximation error.

The ellipsoid remains the far-field base geometry; real elevation must refine it. Research must cover conservative multiresolution horizons, curvature, near/far tiling, voids, coastlines, source heights, terrain shielding of artificial light, and whether 3D transport is approximated by terrain-aware 1D/2D operators.
