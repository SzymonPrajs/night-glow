# Diffuse celestial sky

Owns top-of-atmosphere extended radiance fields: unresolved integrated starlight, diffuse Galactic light, nebular/emission components, zodiacal light, airglow, and extragalactic background.

Inputs: calibrated multiresolution spectral maps or physical component models, observer/time/geometry where component-dependent, wavelength basis. Outputs: component-separated spectral radiance tiles and uncertainty.

The Milky Way must not be represented solely by a decorative RGB panorama. Research must establish absolute calibration, spectral basis, angular PSF of source surveys, dust extinction/emission, temporal behavior for airglow/zodiacal components, seams, and resolved-star subtraction. Atmospheric transfer affects each component; a stellar point-source PSF must not be blindly applied to an already diffuse field.
