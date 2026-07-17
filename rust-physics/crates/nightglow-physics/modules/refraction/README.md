# Atmospheric refraction

Owns refractive index profiles, curved ray paths, apparent/geometric altitude conversion, differential chromatic refraction, and refractive path-length effects.

Inputs: molecular profile, humidity, wavelength, observer height, geometric direction. Outputs: apparent direction, bent path samples, horizon/ducting status, airmass/path diagnostics.

Near-horizon polynomial corrections are insufficient for the reference model. Research must define ray integration through a spherical atmosphere, inversion stability, wavelength dependence, interaction with terrain horizons, below-horizon visibility limits, and when refracted paths must feed the transfer solver rather than only reposition rendered objects.
