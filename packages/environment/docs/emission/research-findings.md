# 01. Research findings

## Executive conclusion

A scientifically defensible global source product is feasible, but not as a single complete map of “real light.” Public global data robustly supports a corrected broad-band nighttime radiance field at roughly 500–750 m scale. It does not globally support visible spectrum, luminaire shielding, or the full nightly switching schedule. The product must therefore be layered and evidence-aware.

## What can be done globally now

### Calibrated spatial backbone

NASA Black Marble Collection 2 supplies daily, monthly, and yearly VIIRS DNB products on a 15-arc-second grid from 2012 onward. The A2 product includes corrected radiance plus mandatory quality, cloud, snow/ice, lunar, and latest-high-quality retrieval information. NASA describes the output as upward surface radiance in `nW cm^-2 sr^-1` after atmospheric and lunar/BRDF correction.

This is the best global backbone because it exposes the QA needed to distinguish direct high-quality retrievals from gap filling and contamination. EOG's 15-arc-second monthly/annual VIIRS composites are valuable for cross-checking, historical continuity, and a simpler prototype, but their product variants and ephemeral-light filtering must be handled explicitly.

### Global spatial priors

- OpenStreetMap supplies worldwide roads, buildings, land uses, facilities, and occasional lighting tags. Its July 2026 planet PBF is about 87 GB, so a planet build is substantial but practical as a streaming batch process.
- DLR WSF 2019 supplies a CC BY 4.0 global 10 m settlement mask.
- GHSL supplies open global built-up surface grids and time series.
- Microsoft Global ML Building Footprints is a useful ODbL building source where OSM buildings are incomplete.

These datasets identify likely source locations inside a satellite footprint. They do not measure brightness. Their correct role is conservative disaggregation with confidence limited by geometry completeness and by the satellite point-spread/support function.

## What is only patchy

- NASA astronaut photography can reach approximately 4 m/pixel and includes colour, but coverage, camera settings, view angle, geolocation, blur, and calibration vary. It is a calibration/enrichment source, not a global base.
- SDGSAT-1 offers 10 m panchromatic and 40 m RGB nighttime imagery, but its published terms restrict use to scientific, non-commercial work and prohibit redistribution/derivative compilation without permission. It must be isolated from distributable public editions unless explicit permission is obtained.
- Luojia-1-01 provides roughly 130 m panchromatic nighttime imagery in selected coverage; access continuity, calibration, and redistribution rights need a dataset-specific legal/technical audit.
- Municipal lamp inventories can contain location, wattage, correlated colour temperature, luminaire, dimming, and switch-off policy. Completeness and licences vary city by city.
- NASA TEMPO has demonstrated experimental nocturnal spectral observations from geostationary orbit over its regional field of regard. It is promising regional spectral/temporal calibration evidence, not a current global product.

## Critical limitations

### VIIRS is not a visible-colour instrument

The DNB response is approximately 500–900 nm. It is weak or blind to the blue/violet energy most important to Rayleigh scattering and modern LED skyglow. A county LED retrofit study observed decreased VIIRS upward radiance while ground skyglow became brighter and extended higher, illustrating why DNB radiance cannot be directly converted to perceived sky quality without spectral and angular evidence.

Consequence: Environment stores a DNB measurement separately from the inferred spectrum. Unknown blue emission remains unknown; it is not filled with a generic “mixed city” colour without an uncertainty-bearing model.

### One viewing direction is not total upward flux

Surface radiance measured toward a satellite does not determine hemispheric upward power. Fixture shielding, facade emission, ground reflectance, vegetation, and near-horizontal light change the upward emission function.

Consequence: the global baseline conserves the measured DNB directional signal. Converting it to total upward watts requires a named angular profile or posterior distribution. A silent Lambertian `πL` conversion is prohibited.

### VIIRS does not measure the whole night

Suomi-NPP's nominal night equator crossing is about 01:30 local time. Daily repeat observations track changes between nights near that phase of the night; they do not provide a dusk-to-dawn curve at each place.

Consequence: `constant/unknown` is the global default temporal profile. Measured local schedules and studies may override it. A learned regional prior may be offered only as a scenario with uncertainty, never as observation.

### Corrected radiance can still be uncertain

Clouds, snow, aurora, glint, fires, gas flares, fishing fleets, vegetation screening, view angle, background airglow, temporal gap filling, and sensor changes all affect interpretation. Collection 2 exposes several of these as QA layers and applies yearly response functions for Suomi-NPP degradation.

Consequence: ingestion retains per-pixel QA and observation counts; yearly composites are not accepted as an unqualified image.

### “Bloom” is not automatically an image defect

Diffuse light around cities may combine sensor support, atmospheric scattering, reflection, and actual small sources. Aggressive sharpening against OSM can erase genuine spatial emission or assign it to the wrong road/building.

Consequence: disaggregation is calibrated against high-resolution nighttime images and withheld observations. It is constrained within the coarse measurement support and produces posterior uncertainty; it is not generic deconvolution.

## Product decision

Environment is a **multi-resolution posterior source field**:

- observed DNB directional intensity;
- optional inferred spectral, angular, and temporal profiles;
- geometry-conditioned sub-cell distribution;
- explicit uncertainty and evidence flags;
- no atmospheric propagation baked in.

This is more modest than a globally complete lamp inventory, but it is physically honest and can improve continuously as local evidence becomes available.
