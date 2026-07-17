# libRadtran pure-absorption reference fixture

These files reproduce the three values in
`../../v1/libradtran-pure-absorption.json` with the official libRadtran 2.0.6
source archive. They exercise DISORT with a monochromatic, non-scattering slab
whose vertical absorption optical depth is exactly 0.5.

Copy the five input files into the extracted libRadtran source root, build
`bin/uvspec`, then run:

```sh
bin/uvspec < reference-sza-0.inp
bin/uvspec < reference-sza-30.inp
bin/uvspec < reference-sza-45.inp
```

The raw stdout is preserved in `reference-output.txt`. The generated numeric
output and these project-authored inputs are CC0-1.0. libRadtran itself is not
redistributed here; version 2.0.6 is GPL-2.0-or-later and the source archive
used for this run had SHA-256
`64930cc40b6e4a37aa220520974d330fc1563796f466a649b2238131f2d69840`.

This fixture validates projected direct-beam Beer-Lambert transmission only. It
does not validate diffuse radiance, scattering, spherical geometry, aerosols,
clouds, surfaces, or multiple scattering.
