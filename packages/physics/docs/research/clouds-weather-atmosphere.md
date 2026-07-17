# Research: atmospheric state, aerosols, clouds, and weather

## 1. Architecture result

Raw weather/composition acquisition does not belong in Physics. The sibling
[Environment atmosphere domain](../../../environment/docs/atmosphere/README.md)
researches and fuses open observations, forecasts, reanalyses and climatologies
into an independently versioned `AtmosphereFieldRelease`. Physics consumes a
bounded four-dimensional region and alone converts that environmental state into
wavelength-dependent extinction, scattering, absorption, refraction and cloud
optics. The normative boundary is the
[Environment consumer contract](../contracts/environment.md).

This division keeps provider-specific grids, licences, update jobs and evidence
semantics out of the transfer solver without hiding any optical assumptions in a
data pipeline.

## 2. Source conclusions

The detailed, official-source catalogue is maintained in the Environment
[source catalogue](../../../environment/docs/atmosphere/source-catalog.md).
The leading source families are:

- ECMWF/Copernicus ERA5 for long historical meteorology and climatology;
- CAMS global composition forecast for operational aerosols, gases, PM and
  useful optical diagnostics, with CAMS EAC4 or NASA MERRA-2 for historical
  aerosol reanalysis;
- CAMS regional ensembles where available, and NOAA GFS/GEFS or ECMWF Open Data
  as open meteorological alternatives/ensemble context;
- AERONET spectral sun-photometer products, regulatory surface stations, and
  CALIPSO/EarthCARE/Sentinel profile/layer products for constraints/validation;
- satellite cloud products, fire emissions/plume heights, anthropogenic emission
  inventories and settlement morphology as priors—not direct complete optical
  state.

No one source provides exact local three-dimensional aerosol/cloud optics. Global
models are tens of kilometres, stations sample points near the surface, and
satellite/lidar products have sampling, cloud and overpass limitations. Fusion
must preserve those limits and expose uncertainty rather than advertise invented
street-scale accuracy.

## 3. Required state and semantics

- pressure, temperature, water vapour/humidity, ozone/gases and winds by level;
- aerosol species or size-bin mass/mixing ratios, with PM/AOD/optical diagnostics;
- cloud liquid/ice content, fraction/overlap, effective size and precipitation;
- surface pressure, land/water/snow state and boundary-layer diagnostics;
- explicit horizontal support, native vertical coordinate and valid-time support;
- exact per-field `SourceEvidenceClass` plus separate runtime `AtmosphereSelectionMode`;
- model run, valid time, lead, member/ensemble and uncertainty;
- wet/dry/reference-state convention for aerosol optical quantities;
- missing, censored, assimilated, inferred and extrapolated status;
- source, transform, quality, licence, attribution and hashes.

The volume must extend through polluted source regions, elevated layers and clouds
along curved-Earth paths. The local observer column cannot explain a city plume
that scatters light before the remaining path crosses clean rural air.

## 4. Optical-closure research owned by Physics

- hydrostatic layer reconstruction and conservative vertical remapping;
- Rayleigh scattering, refractive index and gas absorption from state;
- aerosol mixing state, hygroscopic growth, Mie/T-matrix or reduced phase bases;
- assimilation of provider extinction/AOD/SSA/asymmetry without applying humidity
  twice;
- liquid/ice cloud optical tables, delta scaling, overlap and sub-grid geometry;
- optical-depth-conserving horizontal/vertical interpolation;
- adaptive spherical/oblate ray integration and domain-error bounds;
- staged 3-D transport: reference solution first, then validated interactive
  approximations;
- airglow as a separate upper-atmosphere volume source.

PM2.5, PM10, AOD or visibility alone cannot determine composition, vertical
profile, absorption, wavelength dependence and phase function. They constrain a
state; they do not replace it.

## 5. Fallbacks and far-future requests

The evidence hierarchy is observation/analysis where justified, forecast within
its declared horizon, reanalysis for historical time, joint conditioned
climatology for unsupported/far-future time, and finally an explicitly named
standard-profile scenario. A climatology realization is sampled jointly by
location, season, local time and weather regime so humidity, cloud, aerosol,
boundary-layer height and wind remain plausible together. Independent medians
produce a physically incoherent atmosphere and are not allowed.

An urban residual may use open emissions, settlement morphology, land use,
meteorology and nearby observations, but there is no universal “city multiplier.”
It must be bounded, validated out of sample, labelled inferred, and must never use
night-light brightness as if it were a causal air-pollution measurement.

## 6. Validation

Validate the state and closure separately from radiative transfer:

- reconstruct columns/mass and hydrostatic structure across vertical grids;
- compare PM/AOD/extinction and profiles against held-out AERONET, stations and
  lidar rather than tuning and testing on the same sites;
- test wet/dry aerosol pairs, elevated plumes, clean/urban transitions, broken
  cloud and missing-data behavior;
- compare derived transmission and phase properties with accepted reference
  models and spectral observations;
- compare full radiance against calibrated all-sky observations spanning dark,
  urban, aerosol, cloudy and moonlit conditions;
- report input uncertainty, closure/model inadequacy, numerical error and display
  differences separately.

Coarser inputs may still support a useful prediction, but smooth rendering is not
evidence of atmospheric resolution or physical convergence.
