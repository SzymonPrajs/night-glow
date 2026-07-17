# 16. First feasibility experiment

This is the first work after the design is reviewed. It is intentionally small: its purpose is to prevent a global implementation from being built around misunderstood radiance units, QA, or geometry.

## Questions

1. Can Collection 2 A2/A3/A4 be decoded into a consistent surface-radiance quantity with lossless QA?
2. Which product is the best annual baseline without downloading every daily global tile?
3. Does H3 resolution 8 preserve the useful information at native VIIRS support without unacceptable resampling artefacts?
4. How much spatial improvement can WSF/OSM priors provide while conserving the measured signal?
5. What source/cardinality/compute measurements are needed to size the Europe build?

Spectrum, UEF, and nightly-profile inference are not part of this experiment; they remain unresolved.

## Study areas

Use compact, reproducibly defined bounding polygons around:

- London and surrounding southeast England — dense UK, varied roads, strong OSM, user relevance.
- Paris or Randstad/Ruhr — dense continental urban network and cross-border context.
- Tromsø/Reykjavík candidate — high latitude, snow/aurora/season challenge.
- Nairobi — rapidly growing African city with different morphology/OSM completeness.
- Lagos — dense coastal megacity and cloud/coast challenge.
- Delhi NCR — extremely large, bright, aerosol-heavy urban field.
- Tokyo/Yokohama — very dense structured city and coastline.
- Jakarta — tropical cloud/vegetation/coastal morphology.
- Phoenix/Las Vegas corridor — isolated bright sources, grid roads, desert control, long-range dome relevance.
- São Paulo — large South American metropolis.
- Perth or Sydney — southern hemisphere and isolated/coastal behavior.
- A dark desert/rural control plus an offshore platform/flare area — background and non-settlement tests.

Final AOIs are selected by source tile availability and availability of legally usable validation imagery. Whole AOIs are reserved for holdout; do not randomly split adjacent pixels.

## Inputs

- Same dates/extent from Black Marble C2 A2, A3, A4 near-nadir/all-angle variants as available.
- Corresponding EOG annual/monthly VNL.
- One dated OSM snapshot/extract.
- WSF 2019 and GHSL built surface.
- DEM only for metadata/elevation checks, not propagation.
- At least four legally usable high-resolution or inventory validation sites; restricted imagery is evaluated in an isolated report and cannot enter open fixtures.

Use a single recent complete year common to compared products, chosen after catalog inspection. Record it; do not silently substitute the current year.

## Ordered tasks

### E1. Metadata and unit probe

For a handful of pixels per AOI, record raw values, scaling, units, fill, QA, view convention, acquisition time, gap-fill status, and manual SI conversion. Compare values against provider display/example tools where possible.

Pass: independent calculations agree and every sentinel has a schema state.

### E2. Product comparison

Aggregate high-quality A2 observations into a candidate annual statistic and compare with A3/A4/EOG at identical supports. Stratify residual by brightness, observation count, view, snow, latitude, platform, and urban/rural class.

Pass: select one baseline product/recipe and quantify what information is lost relative to daily derivation.

### E3. Exact area and H3 transfer

Intersect native radiance pixels with H3 res7/8/9 using exact overlap, convert to `J_DNB`, and transfer back to the source grid.

Pass: conservation meets numerical tolerance and resampling error is characterised at coasts, latitude extremes, and bright edges.

### E4. Prior completeness

Extract OSM feature groups and compare building/settlement support against WSF/GHSL. Produce a per-AOI completeness report; do not fit brightness weights yet.

Pass: define a measurable rule for when OSM can dominate, supplement, or be ignored.

### E5. Baseline disaggregation comparison

Compare only three transparent allocations: uniform within source support, built-fraction, and simple versioned semantic weights. All conserve `J_DNB`. Evaluate against held-out fine evidence at multiple aggregation scales.

Pass: determine whether refinement is useful and establish baselines a later probabilistic model must beat.

### E6. Scale measurement

Record download bytes, normalized bytes, feature bytes, cell counts, resolution histogram, CPU time, peak RAM, scratch space, and chunk compression by AOI.

Pass: derive a measured Europe low/expected/high resource estimate.

## Required artifacts

```text
research/feasibility-001/
├── README.md                    # question, recipe, environment, conclusion
├── source-manifest.json
├── aois.geojson
├── unit-and-qa-report.md
├── product-comparison.md
├── spatial-transfer.md
├── prior-completeness.md
├── disaggregation-baselines.md
├── scale-report.md
├── results.json                 # key metrics and gates
└── figures/                     # reproducible diagnostic plots
```

Only tiny legally redistributable fixtures are committed. Raw global/provider data stays in the configured research cache.

## Stop conditions

Stop before further implementation if:

- surface-radiance meaning or scale remains ambiguous;
- A3/A4 cannot support required QA and daily global processing is unaffordable;
- OSM/WSF refinement fails to beat uniform allocation on holdouts;
- licence review cannot define a distributable output;
- H3 transfer introduces errors larger than the expected refinement gain.

The correct response to a failed gate is to revise the design or keep coarser/unresolved data, not to hide the problem in a tuned coefficient.
