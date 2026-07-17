# Atmospheric roadmap and TODO

## Current implementation checkpoint

The synthetic contract subset of Phase 2 is implemented: typed identities,
selection/evidence/validity semantics, immutable release decoding, contiguous
regional pressure queries, extracted-metadata normalization for ERA5/CAMS and
MERRA-2, missingness/unit/vertical/wet-dry rejection, deterministic native
orchestration and a field-sized Wasm adapter. Phase 1 remains the active gate
because no credentialed provider subset has been retrieved or decoded. No
historical, forecast, climatology or production chunk release is claimed. See the
repository [implementation status](../../../../implementation/STATUS.md).

## Phase 0 — source and contract review

- [ ] Freeze exact ERA5, CAMS forecast/reanalysis and MERRA-2 collections/variables/levels.
- [ ] Record licences, attribution, API/access limits, retention and redistribution for each.
- [x] Align `AtmosphereFieldRelease`, `SourceEvidenceClass`, `AtmosphereSelectionMode`, time/revision identities and Physics handoff with the unified system contract; machine-readable schema remains to be frozen.
- [ ] Decide wet/dry aerosol and source-optics semantics with Physics.
- [ ] Select geographic/history fixtures and held-out observations.

Gate: every required variable has a source, unit, vertical/time meaning and missing policy.

## Phase 1 — bounded feasibility experiment

For Warsaw, Delhi, Lagos, Los Angeles, marine/dust and clean-rural cases:

- [ ] retrieve tiny ERA5, CAMS and MERRA-2 subsets at matched instants;
- [ ] decode model/pressure levels and compare vertical coordinates;
- [ ] inventory temperature, pressure, humidity, clouds, aerosol bins, PM, AOD, extinction, SSA and asymmetry;
- [ ] verify CAMS extinction/AOD and MERRA PM formulas;
- [ ] compare provider disagreement and available QA;
- [ ] encode one browser chunk and measure bytes/decode/query/memory;
- [ ] publish commands, checksums, licences and results.

Gate: no global build until quantities close and a compact chunk is demonstrably useful.

## Phase 2 — core Rust and adapters

- [x] implement first-slice `environment-core` typed quantities/evidence/provenance;
- [x] implement first-slice source-run, atmosphere selection and geometric-height structures;
- [x] add extracted-metadata ERA5, CAMS and MERRA-2 adapters behind synthetic fixtures; real provider-file adapters remain open;
- [x] normalize the synthetic extracted variables without fusion;
- [ ] implement deterministic chunk writer/reader and native/Wasm parity;
- [x] add first-slice corrupt/incompatible fixture cases.

## Phase 3 — historical and operational products

- [ ] build one-month/region historical reanalysis release;
- [ ] build immutable operational CAMS forecast-run release/channel;
- [ ] add lead/member uncertainty and stale-run policy;
- [ ] integrate a meteorological alternative ensemble (GEFS or IFS) for comparison;
- [ ] prove source-domain regional queries for Physics.

## Phase 4 — observations and uncertainty

- [ ] add AERONET Level 2 validation adapter;
- [ ] add EEA/EPA background-station validation with station representativeness;
- [ ] add CALIPSO vertical-profile validation;
- [ ] add satellite AOD/cloud constraints where they improve held-out evidence;
- [ ] calibrate lead/region/season uncertainty without erasing raw spread.

## Phase 5 — climatology and priors

- [ ] choose baseline period and version-stable reanalysis sources;
- [ ] fit joint season/local-time/vertical/regime distributions;
- [ ] preserve correlations and tail events;
- [ ] validate quantile reliability on withheld years;
- [ ] build urban residual model from inventories/GHSL/stations only if it improves held-out sites;
- [x] Define `insufficient` and `standard_scenario` selection semantics; exact standard scenario data remains to be selected.

## Phase 6 — Viewer and Vercel delivery

- [ ] derive unit-labelled `EnvironmentDisplayProduct` surface/column tiles independently from numeric chunks;
- [ ] add atmospheric layer plugins and vertical/profile inspector;
- [ ] store large immutable releases in object storage/CDN, not Functions;
- [ ] test range/cache/CORS/COEP behavior and update channels;
- [ ] enforce geographic privacy and source attribution.

## Phase 7 — end-to-end Physics validation

- [x] consume the first-slice atmosphere conformance fixture in native and Wasm Physics tests; broader regional cases remain open;
- [ ] compare uniform-column versus 3-D plume results and quantify materiality;
- [ ] validate horizon/source-region scattering under humidity/aerosol gradients;
- [ ] run paired all-sky observations across atmospheric regimes;
- [ ] separate emission reconstruction, atmosphere state, Physics optical closure/transfer and display errors in reports.

## Open decisions

- [ ] Runtime horizontal hierarchy: cube sphere, H3-addressed chunks, lat/lon tiles or hybrid.
- [ ] Vertical product: preserve native levels, canonical pressure/height grid or both.
- [ ] Required source-to-observer domain and atmosphere tail bounds.
- [ ] Whether CAMS source optical diagnostics are authoritative inputs, validation constraints or selectable mode.
- [ ] Cloud representation and subgrid overlap sufficient for first interactive fidelity.
- [ ] Regional replacement/blending and seam policy.
- [ ] Ensemble storage versus compact calibrated sampler.
- [ ] Climatology trend/nonstationarity and future emissions scenarios.
- [ ] Operational update service ownership and cost.
