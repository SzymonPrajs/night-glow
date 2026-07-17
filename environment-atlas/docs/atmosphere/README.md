# Atmospheric-state domain

This domain reconstructs the spatially and vertically varying state through which Night Glow Physics propagates light. It replaces eight fixed UI weather presets as the normal evidence path while retaining explicit standard/preset scenarios for testing and fallback.

It is not a numerical weather-prediction model and not a radiative-transfer engine. It ingests existing forecasts, reanalyses and observations; normalizes and fuses them; constructs uncertainty-aware climatologies; and publishes browser-queryable `AtmosphereFieldRelease` products.

## Reading order

1. [Charter and boundary](00-charter-and-boundary.md)
2. [Research findings](01-research-findings.md)
3. [Source catalogue](02-source-catalog.md)
4. [4-D field model](03-field-model.md)
5. [Fusion, climatology and fallbacks](04-fusion-climatology-and-fallbacks.md)
6. [Format and API](05-format-and-api.md)
7. [Validation, licensing and risks](06-validation-licensing-and-risks.md)
8. [Roadmap and TODO](07-roadmap-and-todo.md)
9. [Normative Physics handoff](../21-atmosphere-physics-handoff.md)

## Central rule

The release preserves environmental state and any source-provided optical diagnostics. Physics decides how that state becomes wavelength-dependent extinction, absorption, scattering and phase functions. This prevents the Atlas from silently choosing Physics' aerosol optics and prevents Physics from pretending that PM2.5 alone is a complete optical medium.

