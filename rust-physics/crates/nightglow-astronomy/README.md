# `nightglow-astronomy`

Astronomy owns celestial geometry and motion. It combines the time/frame/ephemeris/catalogue modules into an apparent-sky state for a specific observer and epoch. It does not own atmospheric transport, PSF, or display colour.

## Proposed modules

| Module | Responsibility |
|---|---|
| [`time`](modules/time/README.md) | UTC, TAI, TT, UT1, TDB and leap/EOP handling |
| [`reference-frames`](modules/reference-frames/README.md) | ICRS/GCRS/CIRS/ITRS, ecliptic, observed, ENU/horizon transforms |
| [`earth-orientation`](modules/earth-orientation/README.md) | precession-nutation, Earth rotation, polar motion |
| [`ephemerides`](modules/ephemerides/README.md) | JPL/kernel access and interpolation |
| [`solar-system`](modules/solar-system/README.md) | apparent Sun/Moon/planet geometry, phase and occultation |
| [`stellar-kinematics`](modules/stellar-kinematics/README.md) | epoch propagation, parallax, proper motion, radial velocity, aberration |
| [`catalog-tiling`](modules/catalog-tiling/README.md) | HEALPix/LOD selection, visibility, flux-complete batching |

## Primary product

An `ApparentSkyState` conceptually contains observer and time metadata; apparent directions and angular sizes; distances and phase geometry; occultation/horizon status; batches of visible star records with propagated states; and required sky-tile IDs. It carries no RGB display values and no atmospheric attenuation.

## Accuracy tiers

- Reference: standards-based time/frame pipeline and high-precision ephemerides.
- Interactive: interpolated/cached transforms with a declared maximum angular/time error.
- Fallback: lower update cadence or catalogue LOD while maintaining identical frame definitions.

All tiers are validated against the same reference cases. “Looks in the right place” is not sufficient.
