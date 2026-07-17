# Research: artificial light and emission maps

## Existing local foundation

The repository’s `emission-atlas/` package already represents a sparse H3 global atlas with eight spectral bands, temporal profiles, angular profiles, upward-power semantics, and evidence flags for satellite/inventory/redistribution inputs. Preserve that separation: it estimates an emission field; the new physics toolkit turns that field into radiative-transfer source terms.

## Satellite products

NASA’s Black Marble family uses VIIRS Day/Night Band observations for nighttime lights. NASA material describes at-sensor radiance and notes confounders including clouds, snow reflectance, moon phase, fires, and smoke; the [Black Marble overview layer](https://gis.earthdata.nasa.gov/gis05/rest/services/DISASTERS_202601_WINTERWX_US/202601_BlackMarble_BRDF/ImageServer) also identifies approximately 500 m visualization resolution for that product context.

This is evidence of light arriving at a satellite, not a multispectral upward luminaire inventory. The DNB is broadband and cannot uniquely distinguish LED, sodium, decorative, vehicle, fire, or reflected moonlight spectra.

## Required inference hierarchy

```text
quality-screened satellite radiance
+ atmospheric/view correction
+ lunar/snow/cloud/fire screening
+ municipal/luminaire inventories where available
+ land use, built surface, roads/OSM as redistribution priors
+ measured/default lamp spectra
+ source height and shielding/angular priors
+ temporal schedules
 -> upward spectral power/intensity field + uncertainty/evidence
```

The hierarchy must allow local high-quality inventories to override coarse priors while retaining provenance. Total upward power must be conserved through spatial redistribution. Source angular profiles remain normalized and wavelength-dependent when supported.

## Propagation questions

- finite source height and terrain/building shielding;
- direct upward versus downward-to-ground reflected fractions;
- spectral surface albedo/BRDF and snow amplification;
- cloud-base scattering/reflection and repeated orders;
- near/far source tiling and Earth curvature;
- atmospheric state at both source region and observer path;
- extended-city geometry versus point/ellipsoid approximations;
- time zones, curfews, weekends, seasons, outages, transient sources;
- uncertainty when a single satellite band is spectrally reconstructed.

## Validation

Use independent upward-flux inventories, ground all-sky radiance, calibrated sky brightness transects, spectral measurements, controlled lights where available, city blackout/change events, terrain-shadow cases, clear/cloud/snow contrasts, and withheld regions. Avoid fitting and validating on the same satellite aggregate.

## Interface to settle

The adapter should query a region/time/LOD and return upward spectral radiant intensity or total flux plus normalized angular distribution, spatial/vertical support, uncertainty/evidence, temporal validity, and dataset/model revision. It must not return display RGB or pre-scattered sky glow.
