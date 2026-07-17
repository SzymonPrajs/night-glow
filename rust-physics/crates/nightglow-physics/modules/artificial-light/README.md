# Artificial light

Owns conversion of a calibrated upward-emission field into spectral/angular/time-dependent propagation source terms.

Inputs: emission cells with total upward power or intensity, spectra, angular profiles, source height/support, schedules, evidence and uncertainty. Outputs: boundary/volume source terms compatible with radiative transfer.

It must not equate VIIRS Day/Night Band at-sensor radiance with emitted upward optical power. Research includes atmospheric/surface inversion, cloud/moon/snow contamination, DNB spectral response, source inventory fusion, luminaire spectra, shielding, OSM/built-surface redistribution, temporal operation, wavelength-dependent terrain/surface bounce, and uncertainty propagation.

The existing `emission-atlas/` is the likely upstream provider and remains the authority for its H3 spatial model; this module owns the physical adapter and propagation semantics.
