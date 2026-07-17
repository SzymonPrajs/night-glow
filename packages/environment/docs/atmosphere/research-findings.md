# Atmospheric research findings

## 1. A complete global field must be model-backed

Surface stations, sun photometers and satellite retrievals are invaluable but sparse, column-limited, daylight/cloud-limited or track-based. A global 4-D runtime product therefore needs an assimilated forecast/reanalysis backbone. Observations are used through the provider's assimilation and again for independent validation or carefully defined local correction.

## 2. No single product is best for every time regime

- **ERA5** is the stable historical meteorological backbone: hourly, about 31 km, 137 hybrid model levels and CC-BY availability.
- **CAMS global composition** is the preferred operational aerosol/composition source: forecasts to five days, multi-level aerosol species, 3-D extinction at 355/532/1064 nm, spectral single-scattering albedo/asymmetry diagnostics and meteorology.
- **CAMS European ensemble** gives roughly 10 km air-quality analysis/forecast and ensemble spread for Europe.
- **MERRA-2** is the main independent long-term aerosol cross-check: about 0.5° × 0.625°, 72 native layers, 3-hourly 3-D output and assimilated aerosol observations.
- **GFS/GEFS or ECMWF IFS** provide open meteorological forecast alternatives/ensembles, but do not replace CAMS composition.

Product version changes matter: an operational forecast is not a homogeneous climate record. Stable climatology must come from reanalysis or version-aware bias correction.

## 3. The light problem needs a volume, not observer weather

Artificial light may scatter inside a polluted boundary layer near its source, then traverse different rural/marine air before reaching the observer. The runtime domain must cover the source-to-observer region and relevant altitudes. A weather record sampled only at the observer is physically inadequate.

## 4. Humidity and composition must travel together

Hygroscopic sulfate, nitrate, sea salt and hydrophilic organics take up water and alter size/scattering as relative humidity rises. The EPA IMPROVE approach explicitly applies humidity growth to hygroscopic species; CAMS provides composition and humidity together. A single visibility or dry PM value loses this coupling.

## 5. Prefer state variables; preserve useful optical diagnostics

The Environment should store temperature, pressure, humidity, cloud condensate/fraction and aerosol species/bin mass where supported. It should also preserve source-supplied extinction, AOD, single-scattering albedo and asymmetry as diagnostics/constraints. Physics may use them directly under a declared source-optics mode or reconstruct optical properties under its own reviewed aerosol model.

## 6. PM and AOD are constraints, not complete optics

Surface PM2.5/PM10 is a local mass concentration; AOD is a column integral; lidar supplies narrow vertical curtains; composition determines absorption and hygroscopic growth. Inferring a spectral 3-D phase function from any one of these requires a model and uncertainty. Product schemas must prevent scalar substitution.

## 7. “Cities are dirtier” is not a safe universal constant

Urban concentration depends on sector emissions, boundary-layer depth, wind, precipitation, chemistry, topography and transported backgrounds. Some rural sites can be dominated by dust, smoke or regional secondary aerosol. Urban/built-up classes may choose a conditional prior only when direct/reanalysis evidence is missing; inventories such as CAMS/EDGAR, station type, GHSL morphology and meteorological regime drive that prior. Its uncertainty must be wider than model-backed state.

## 8. Far-future weather must be distributional

Medium-range forecasts reach days; seasonal forecasts describe probabilistic anomalies, not local hour-by-hour weather. Arbitrary future dates should use a reanalysis-derived joint distribution conditioned on location, day-of-year and local solar/civil time, optionally adjusted by a seasonal ensemble anomaly. Sampling must retain correlations between humidity, boundary-layer height, aerosol, cloud and wind.

## 9. High spatial resolution can be false precision

A 1 km AOD tile does not imply a resolved 1 km vertical aerosol field. Downscaling may use terrain, land/sea, urban form, inventories and stations, but output carries effective resolution and representativeness uncertainty. Native model support remains visible.

## 10. Precompute is essential even with Rust/Wasm

Global GRIB/netCDF archives, hybrid-level conversion, climatology fitting and station/satellite fusion happen natively. Browser Rust/Wasm should decode a small regional 4-D subset, interpolate/query and construct a Physics input batch. It should not parse terabytes or run global data assimilation.

