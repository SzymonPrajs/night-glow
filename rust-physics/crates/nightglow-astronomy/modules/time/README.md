# Time scales

Owns explicit conversion among UTC, TAI, TT, UT1, and TDB (and any ephemeris-specific time argument), including leap seconds and Earth-orientation inputs.

Inputs never use an unqualified timestamp. Outputs carry scale and uncertainty. Research must select authoritative leap-second/EOP sources, offline update/version policy, interpolation, out-of-range behavior, ΔT fallback, and deterministic browser assets. Validation uses published SOFA/reference examples and discontinuities around leap seconds.
