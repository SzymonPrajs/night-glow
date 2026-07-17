# Research: terrain, surface reflection, and Earth boundary

## Terrain data

NASA Earthdata’s [LP DAAC overview](https://www.earthdata.nasa.gov/centers/lp-daac) lists NASADEM and SRTM global elevation products, including 30 m classes. Candidate selection must consider global/polar coverage, vertical datum, voids, water handling, redistribution, update, and whether higher-resolution regional DEMs are necessary.

Native products should derive multiresolution elevation/normals, conservative horizon profiles for supported observer-height ranges, visibility/source-height structures, and error bounds. Earth curvature is always present. Refraction policy is explicit because it changes apparent horizon/visibility.

## Surface BRDF/albedo

MODIS/VIIRS BRDF/albedo products are candidate priors. The [MCD43 product guide](https://lpdaac.usgs.gov/documents/441/MCD43_User_Guide_V5.pdf) describes kernel-driven BRDF parameters and black-sky/white-sky albedo derived over multi-day observations. The [VIIRS VNP43 algorithm basis](https://lpdaac.usgs.gov/documents/194/VNP43_ATBD_V1.pdf) documents Ross-Thick/Li-Sparse-Reciprocal modelling and multiple product grids.

Research must determine how daytime satellite bands/fit windows translate to nighttime wavelengths and conditions, retain quality/snow flags, fit the runtime spectral basis, and avoid treating hemispherical albedo as a directional BRDF.

## Material models

- Land/vegetation/urban: kernel BRDF or validated mixtures with spectral dependence.
- Water: Fresnel reflection, wind/wave distribution, foam, and night geometry; simple Lambertian water is usually wrong.
- Snow/ice: high spectral albedo and strong anisotropy; major impact on skyglow.
- City surfaces: downward luminaire reflection and material mixtures.
- Clouds are an atmospheric boundary/volume, not a ground material, though cloud base strongly couples to upward light.

All BRDFs must pass hemispherical energy checks. Spatial aggregation must preserve the appropriate area-weighted or directional response rather than average display colours.

## Terrain-aware transfer levels

1. Ellipsoid/spherical atmosphere with surface albedo and terrain horizon mask.
2. Terrain-aware source/observer visibility plus local normals/BRDF.
3. Regional 2D/3D correction for valleys/ridges and horizontal atmosphere differences.
4. Full 3D Monte Carlo/reference studies for selected validation regions.

Select an interactive level from measured error. A real DEM alone does not produce real terrain scattering if transport still assumes an unoccluded flat boundary.

## Validation

Synthetic ridge/valley analytic visibility, rotational/geodesic consistency, comparison with direct ray tracing, horizon angular error by LOD, snow/no-snow and water-glint cases, surface energy conservation, and ground measurements on both sides of terrain barriers.
