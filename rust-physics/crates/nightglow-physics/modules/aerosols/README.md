# Aerosols

Owns aerosol extinction, single-scattering albedo, phase matrices/functions, and humidity-dependent evolution.

Inputs: aerosol optical depth/profile, type or size/refractive-index distribution, relative humidity, wavelength basis. Outputs: per-layer extinction/scattering/absorption, phase representation, asymmetry and quality metadata.

Research must distinguish urban, rural, maritime, desert, smoke, and volcanic regimes; investigate Mie/T-matrix or tabulated properties, hygroscopic growth, vertical distribution, and strongly forward-peaked numerical treatment. Ångström-only RGB scaling is a fallback, not the reference model.
