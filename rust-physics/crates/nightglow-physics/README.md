# `nightglow-physics`

The single source of truth for physical equations. Modules expose pure or explicitly stateful calculations over typed inputs. Native and Wasm builds select supported algorithms through declared fidelity profiles; neither target owns a second formula.

## Calculation modules

| Module | Responsibility |
|---|---|
| [`molecular-atmosphere`](modules/molecular-atmosphere/README.md) | thermodynamic composition, molecular scattering and absorption |
| [`aerosols`](modules/aerosols/README.md) | aerosol optical depth, phase functions, humidity response |
| [`clouds`](modules/clouds/README.md) | liquid/ice cloud optical properties and coverage |
| [`refraction`](modules/refraction/README.md) | refractive paths and apparent altitude |
| [`radiative-transfer`](modules/radiative-transfer/README.md) | propagation, multiple scattering, and boundary coupling |
| [`surface-brdf`](modules/surface-brdf/README.md) | land, water, snow, and spectral reflection |
| [`terrain`](modules/terrain/README.md) | horizon, shadowing, visibility, and geometric support |
| [`artificial-light`](modules/artificial-light/README.md) | upward emission and light-pollution source terms |
| [`solar-radiance`](modules/solar-radiance/README.md) | solar spectrum, disk, limb darkening, and eclipse state |
| [`lunar-radiance`](modules/lunar-radiance/README.md) | lunar reflection, phase, opposition, and disk radiance |
| [`earthshine`](modules/earthshine/README.md) | Earth illumination of the Moon and return path |
| [`planetary-radiance`](modules/planetary-radiance/README.md) | planet disk/phase/spectral radiance |
| [`resolved-stars`](modules/resolved-stars/README.md) | stellar flux/spectra/variability after astronomy places stars |
| [`diffuse-sky`](modules/diffuse-sky/README.md) | unresolved Galactic, zodiacal, airglow, and extragalactic fields |
| [`psf`](modules/psf/README.md) | atmospheric and observation point/line spread functions |
| [`spectral-color`](modules/spectral-color/README.md) | spectral integration and observer/display transforms |

## Ownership rule

Astronomy computes position, distance, orientation, phase geometry, and motion. These physics modules compute emitted/reflected radiance and propagation. The solver composes them. For example, astronomy produces Sun/Moon directions and distances; `solar-radiance` and `lunar-radiance` produce boundary radiance; `radiative-transfer` propagates it; `psf` produces the observation blur; `spectral-color` produces an observer/display value only at the final boundary.

## Required documentation beside future code

Each module will keep a model note containing equations, references, validity domain, approximation/fidelity variants, units, coordinate assumptions, error budget, invariants, and validation cases. A code change that alters kernel-producing mathematics must change the relevant model revision.
