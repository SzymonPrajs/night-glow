# 06. Temporal model

## Goal

Allow the consumer to ask for source emission at a date and time while clearly separating observed nightly behavior, policy schedules, inferred activity, and an unknown fallback.

## Reference phase

Every radiance baseline is tied to its actual acquisition/composite convention. For VIIRS, samples are near the satellite's local overpass phase, nominally around 01:30 local time for Suomi-NPP at the equator, with actual UTC/view metadata retained. A temporal profile is normalised to factor 1 at the baseline's reference phase.

## Profile axes

A temporal profile may use one or more of:

- UTC instant;
- local civil time with IANA time-zone rules and daylight-saving version;
- local apparent solar time;
- hours since sunset / before sunrise;
- day of week;
- month or season;
- holiday/event class;
- astronomical darkness and lunar context, if the source policy depends on them.

Civil switch-off policies must use civil time. Human activity priors may use local time. Cross-region scientific comparisons should retain local solar time. The schema records the axis rather than silently converting all profiles to one clock.

## Profile evidence classes

1. **Measured:** repeated calibrated observations across the night.
2. **Operational:** authoritative dimming/switching schedule, adjusted for inventory coverage.
3. **Object semantic:** e.g. valid OSM `opening_hours` on a specific facility.
4. **Inferred:** statistical profile learned from comparable places or activity proxies.
5. **Scenario:** user-selectable assumption such as constant, typical urban, or curfew.
6. **Unresolved:** no claim; factor is held at 1 and uncertainty grows away from the reference phase.

Only classes 1–3 should alter the default scientific estimate in an initial release. Inferred profiles should be opt-in until validation demonstrates transferability.

## Representation

- 96 quarter-hour factors for a 24-hour axis, stored once per shared profile.
- 12 monthly factors and weekday/weekend/holiday modifiers.
- Valid date range and region/source classes.
- Central factor plus compact uncertainty bounds.
- Optional hard transitions for authoritative schedules; interpolation rules declared.
- `reference_bin`, which must evaluate to exactly 1.

Quarter-hour bins preserve common dimming/control changes while remaining tiny in a dictionary. The runtime may linearly interpolate continuous measured profiles but must not smooth authoritative on/off transitions unless configured.

## Global default

The global baseline profile is `unresolved-constant-at-reference`. It returns factor 1 and marks a temporal fallback. This means “no supported nightly change,” not “lights are physically constant.” Its uncertainty envelope may widen toward dusk/dawn once a validated model exists.

## Building a measured local profile

1. Gather time-resolved calibrated imagery or ground source/sky observations and operational schedules.
2. Remove clouds, moon/solar twilight contamination, snow changes, outages, and one-off events.
3. Separate source classes where possible: street, commercial, residential facade/window, vehicle, industrial, sports/advertising.
4. Estimate factors relative to Environment reference phase.
5. Validate on withheld nights and across seasons.
6. Attach only to spatial cells whose source mixture and evidence support transfer.

## What daily Black Marble can support

It can support annual trend, seasonality near overpass, holidays, outages, conflict/disaster changes, and stability estimates. It cannot by itself tell whether a city was twice as bright two hours after sunset than at 03:00. The pipeline must not infer intranight shape from a series sampled at essentially the same local phase.

## Runtime behavior

The query returns both a factor and status. If the required axis input is unavailable, the factor remains 1 and status becomes unresolved; it never evaluates a civil-time schedule using longitude alone. The caller can request a conservative interval or named scenario in addition to the central estimate.

The query accepts an explicit `EmissionTimeContext`. Physics/astronomy supplies UTC and solar/ephemeris fields; the application supplies authoritative IANA civil-zone, time-zone-database revision, and policy/holiday context. Environment emission domain evaluates the stored profile but does not implement leap-second conversion, ephemerides, time-zone discovery, or solar geometry. This keeps the projects independent and prevents two astronomy implementations.
