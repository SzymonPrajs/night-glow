# Research: spectral basis, colour, and photometry

## Physical convention

Transport uses absolute spectral radiance per wavelength or explicitly band-integrated radiance. Every conversion declares wavelength grid, response function, integration weights, zero point/reference spectrum where relevant, and output units.

The current eight wavelength samples are a practical seed. They must be tested against a finer reference for:

- Rayleigh/aerosol wavelength dependence;
- ozone/oxygen/water absorption structure;
- solar and lunar spectra;
- hot/cool stars and Gaia passbands;
- narrow/structured LED, sodium, mercury, and mixed city spectra;
- surface/snow/water reflectance;
- photopic/scotopic/mesopic and camera responses.

## Basis choices

1. Fixed nonuniform narrow bands with quadrature weights.
2. Fine precompute grid collapsed to runtime bands per component/operator.
3. Low-rank spectral basis fitted over a representative library, with positivity/error concerns.
4. Hybrid line-plus-continuum representation for artificial sources.

Choose by worst-case physical/output error and operator compatibility. A basis optimized for smooth daylight spectra may fail badly for sodium or LED emission.

## Observer functions

Keep radiometry separate from photometry. Named transforms can include CIE photopic tristimulus/luminous quantities, scotopic response, mesopic model, melanopic/other alpha-opic action spectra, a calibrated camera sensor, and linear display primaries.

[CIE S 026](https://www.cie.co.at/publications/cie-system-metrology-optical-radiation-iprgc-influenced-responses-light-0) defines a metrology system for ipRGC-influenced responses and is a candidate reference when melanopic/alpha-opic outputs are required. Licensing/access terms for standard tables must be checked before embedding data.

## Magnitudes and catalogues

Magnitude conversion must name the passband/system and zero point (Vega, AB, Gaia-specific, etc.). Parallax/distance, extinction, and spectral fitting must not be folded into an anonymous RGB colour. Catalogue uncertainties propagate to source flux/basis coefficients.

## Display pipeline

```text
spectral radiance
 -> named observer/sensor linear response
 -> exposure/adaptation or camera model
 -> linear display primaries
 -> gamut mapping and tone mapping
 -> output transfer function
```

The physical field remains available for metrics after display mapping. Low-light desaturation or visual adaptation is an observer model with parameters, not an edit to the atmosphere.

## Validation

Integrate reference spectra directly at high resolution and compare basis output; include line spectra and adversarial mixtures. Check energy/photometric units, standard illuminants/reference spectra where legally available, Gaia passband transformations, camera calibration fixtures, and native/Wasm/shader agreement. Report both typical and maximum error.
