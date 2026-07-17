# Reference frames

Owns typed transformations among catalogue/inertial, geocentric, Earth-fixed, ecliptic, topocentric, and observed/local-horizon frames.

Every transform declares origin, axes, epoch/equinox where applicable, and time-scale dependencies. Research must align with IAU/SOFA conventions, distinguish ICRS/GCRS/CIRS/ITRS and apparent/observed places, include observer geodetic/ECEF conversion, and quantify errors from abbreviated matrices. Atmospheric refraction is delegated to the physics refraction module at the observed-place boundary.
