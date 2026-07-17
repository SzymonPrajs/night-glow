# Research: Sun, Moon, planets, and earthshine

## Solar source

Select an absolute top-of-atmosphere solar spectrum, distance scaling convention, and limb-darkening model. Finite-disk integration matters for eclipses and the horizon/twilight boundary. Research must define activity variability relevance, spectral resolution through ozone/other absorption, and validation against reference irradiance.

## Lunar source

The Moon requires apparent geometry from the astronomy package and reflected-radiance physics from the lunar module. Candidate research includes Hapke-like or other accepted lunar photometric models, opposition surge, wavelength-dependent albedo/phase reddening, topographic/albedo maps, libration/orientation, finite solar disk, eclipses, and disk-resolved versus integrated runtime representations.

USGS ISIS documents several [lunar/planetary photometric model families](https://isis.astrogeology.usgs.gov/8.1.0/Application/presentation/PrinterFriendly/photemplate/photemplate.html); this is a model inventory to evaluate, not an immediate selection. The model must be validated against calibrated lunar irradiance/radiance across phases rather than tuned only to an attractive disk.

## Scattered moonlight

The atmosphere receives an extended lunar disk source and propagates it through the same molecular/aerosol/cloud/surface operator used for other sources. The literature includes detailed models such as the [ESO scattered-moonlight treatment](https://www.aanda.org/articles/aa/pdf/2013/12/aa22433-13.pdf). Research must compare phase, separation angle, lunar altitude, aerosol, wavelength, and multiple-scattering behavior.

## Earthshine

NASA’s overview of [Earthshine and climate](https://science.nasa.gov/earth/earth-observatory/earthshine-and-climate-4532/) describes Earthlight reflected from the Moon as a way of observing Earth’s reflectance; a more detailed NASA record is available for [Earthshine observations and modelling](https://ntrs.nasa.gov/citations/20190001705). This supports the need for variable Earth reflectance rather than a constant decorative term.

Research levels:

1. validated disk-integrated apparent Earth albedo with phase/season uncertainty;
2. mapped land/ocean/snow plus climatological clouds and atmosphere;
3. time-specific cloud/surface BRDF integration as seen from the Moon;
4. explicitly enumerated additional Earth–Moon reflection orders if significant.

The calculation integrates the illuminated and Moon-visible Earth disk, including atmosphere/cloud/surface anisotropy, to obtain spectral irradiance incident on the Moon. Lunar photometry then produces earthshine radiance toward the observer, which traverses Earth’s atmosphere.

## Planets

Each planet needs body-specific phase/ring/spectral models at least for visually important bright objects. Quantify their contribution to sky illumination and Moon illumination. The expected result is that their feedback illumination is negligible in ordinary scenarios; document the bound and omit it from the coupled solve unless evidence says otherwise.

## Validation matrix

- solar/lunar distance extremes and disk angular sizes;
- new, crescent, quarter, gibbous, full and opposition-region Moon;
- earthshine on the dark lunar portion;
- lunar/solar eclipses and occultation contacts;
- lunar altitude and source-separation sweeps through atmosphere;
- Venus/Jupiter and ringed Saturn appearance/flux;
- conservation/normalization of disk integration and native/Wasm parity.
