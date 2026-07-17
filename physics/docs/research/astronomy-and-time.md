# Research: astronomy, time, and apparent place

## Standards and candidate sources

[IAU SOFA](https://www.iausofa.org/about-us) provides authoritative standards algorithms for fundamental astronomy, and its [cookbooks](https://www.iausofa.org/cookbooks) document astrometry workflows. [JPL DE440/DE441](https://ssd.jpl.nasa.gov/doc/de440_de441.html) is the primary candidate family for solar-system ephemerides.

The Rust implementation cannot copy APIs blindly: first review SOFA’s license/current release, select algorithms/conventions, and construct independent reference vectors. Ephemeris coefficient redistribution and compact browser representation also require explicit review.

## Required pipeline

```text
user UTC
 -> leap-second aware TAI/TT
 -> UT1 and Earth-orientation state
 -> ephemeris time argument (e.g. TDB)
 -> barycentric/geocentric states
 -> IAU frame transformations
 -> topocentric parallax and apparent place
 -> physical atmospheric refraction
 -> local observed horizon direction
```

Each arrow must carry a model/data revision and error. The browser needs an offline-safe bounded date interval and clear out-of-range behavior rather than silently using stale Earth-orientation data.

## Research tasks

- select exact time scales and input semantics for the UI/API;
- pin leap-second and EOP sources; define update and prediction policy;
- choose IAU precession-nutation and frame conventions;
- compare full and compact/cached matrix paths over date/location extremes;
- determine ephemeris date range and coefficient tiling/compression;
- include topocentric Moon parallax, light time, aberration, deflection, disk orientation/libration, phase, eclipses, and occultations;
- define terrain-horizon and refraction interaction;
- specify apparent versus geometric altitude everywhere.

## Validation

Use SOFA published/example vectors, JPL/Horizons or direct DE evaluation, leap-second boundaries, high latitude, historical/future range edges, fast lunar motion, occultation contacts, and high-proper-motion stars. Set angular tolerances by rendered/physical impact—for example, a sub-pixel star position target differs from an eclipse-contact target.
