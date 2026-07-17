# Research: weather, clouds, and atmosphere data

## Global baseline

[ERA5 hourly single-level data](https://cds.climate.copernicus.eu/datasets/reanalysis-era5-single-levels?tab=overview) is a candidate global baseline. The published regridded subset is 0.25° with hourly fields and uncertainty-related products, but that resolution is far coarser than local cloud and light-pollution structures. Pressure-level/model-level products and other sources must be reviewed for vertical atmosphere construction.

ERA5 can initialize pressure, temperature, humidity, winds, cloud/aerosol-related proxies, surface state, and climatology/reanalysis scenarios. It should not be presented as exact current local seeing/cloud microphysics.

## Required state

- pressure, temperature, water vapour, ozone/gas composition profiles;
- molecular density/refractivity;
- aerosol optical depth, type/size/vertical profile, single-scattering albedo and phase function;
- cloud base/top or 3D support, liquid/ice water, effective radius, optical depth, phase function, coverage/overlap;
- wind/turbulence information for PSF/seeing if modelled;
- surface pressure, snow/ice/water/land state;
- uncertainty, valid time, spatial/vertical representativeness.

No source will provide all of this perfectly. The scenario builder needs a hierarchy: user measurement → higher-resolution analysis/forecast → global reanalysis → climatology/standard profile, with each substitution flagged.

## Atmospheric optics research

- choose spectroscopy/band model and redistribution-compatible data;
- Rayleigh formula, refractive index and depolarization across humidity/composition;
- ozone and other visible absorbers;
- aerosol families and humidity growth;
- liquid/ice cloud optical tables and delta-scaling treatment;
- 1D layer interpolation that conserves optical depth;
- horizontal interpolation/downscaling without inventing cloud geometry;
- treatment of airglow as a time/location-dependent upper-atmosphere emission source.

ESO documentation for its [ELT image-model background](https://etimecal.hq.eso.org/observing/etc/doc/elt/etc_img_model.pdf) is a useful checklist because it explicitly separates components such as scattered moonlight, zodiacal light, diffuse Galactic background, and airglow. It is not a direct data source for this application.

## Validation

Compare derived vertical optical depth/transmission with independent observations or reference models, verify pressure/hydrostatic consistency, test interpolation conservation, use clear/aerosol/cloud optical-depth sweeps, and separate weather-input error from transfer-solver error. Ground/cloud/aerosol observations near validation cameras are much more valuable than tuning a global preset to appearance.
