# 07. Spectral and angular model

## Spectrum

### Observation problem

VIIRS DNB integrates a broad response from roughly 500 to 900 nm. The future skyglow solver needs wavelength-resolved source emission because molecular scattering varies strongly with wavelength and aerosols, vision, cameras, and ecology use different response functions. Energy below 500 nm—especially blue LED output—is inadequately observed by DNB.

### Canonical representation

Do not freeze the atlas to the current web application's eight display bands. The source profile dictionary should store spectral radiant-power density in 10 nm bins from 350 to 950 nm, with optional narrow-line components (notably sodium near 589 nm) and an explicit sensor response curve. This range captures visible lighting and the DNB near-infrared tail while allowing accurate integration into downstream bands.

Each spectral profile contains:

- normalised spectral radiant-power distribution and unit convention;
- uncertainty or an admissible mixture of basis spectra;
- lamp/source mixture and evidence;
- validity epoch/region;
- measured wavelength support;
- `unknown_outside_support` mask;
- DNB response integral used for cross-calibration.

The current application can resample these profiles into its eight bands. The physical model revision must change whenever the spectral grid or response integration changes.

### Evidence order

1. Calibrated hyperspectral/spectrometer or authoritative luminaire SPD inventory.
2. Calibrated RGB/multispectral nighttime image, corrected for atmosphere, optics, exposure, and sensor response.
3. Complete lamp-type/CCT inventory plus measured manufacturer/library SPDs.
4. Statistically inferred regional/source-class mixture with uncertainty.
5. Unresolved DNB spectrum.

A colour temperature alone is not an SPD, and an RGB photograph is not radiometric until calibrated. The unresolved profile does not distribute DNB power into visible bands.

## Upward angular emission

### Observation problem

Nadir/upward satellite radiance does not reveal near-horizontal emission, facade directions, shielding, or how ground-reflected light contributes. These angles strongly affect long-distance skyglow.

### Canonical representation

The baseline upward emission function (UEF) is a profile over emission zenith angle `0°..90°` in 5° bins, normalised against the DNB reference direction. A profile may optionally include low-order azimuthal harmonics for directional sources such as roads, facades, stadiums, or airports.

Each angular profile declares:

- wavelength dependence or the spectral profile family for which it is valid;
- direct fixture component, ground/facade-reflected component, and combined result where evidence supports separation;
- source height class;
- normalisation and hemispheric integral;
- central curve, uncertainty, and evidence class.

The global default is unresolved. A Lambertian curve may be provided as a named scenario, never an invisible default.

### Evidence order

1. Inventory with photometric IES/LDT files and installation orientation/tilt.
2. Multi-angle satellite observations or calibrated airborne/ground measurements.
3. Fixture class, full-cutoff status, urban form, reflectance, and source-height inference.
4. Validated regional/source-class posterior.
5. Unresolved angular profile.

## Coupling and inference

Spectrum and angle are correlated: an LED retrofit can change both wavelength distribution and shielding. The model therefore assigns a joint `emission_model_family_id` even when compact records refer separately to spectral and angular dictionaries. Validation must test joint families rather than independently choosing the best spectrum and angle from unrelated evidence.

## Calibration equations

For a candidate spectral profile `S(lambda)` and angular profile `U(theta, phi, lambda)`, predict the DNB observation by integrating the source spectrum, DNB relative spectral response, angular direction, footprint, and relevant observation geometry. Only profile mixtures whose forward prediction matches the corrected observation within uncertainty are admissible.

The implementation must forward-model the sensor. It must not divide one broad-band radiance by a single “typical LED” coefficient.

## High-resolution colour imagery

ISS and SDGSAT imagery should first be used to estimate **relative spatial/spectral classes**, then anchored to contemporaneous corrected VIIRS radiance over common support. Camera linearity, dark current, flat field/vignetting, ISO/exposure, lens/window transmittance, atmospheric path, astrometry, saturation, and time difference are all required calibration terms.
