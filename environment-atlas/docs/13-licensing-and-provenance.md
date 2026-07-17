# 13. Licensing and provenance

This document is engineering guidance, not legal advice. A release that combines databases needs licence review before distribution.

## Known source positions

- OpenStreetMap is ODbL 1.0: attribution is required, and altered/derived databases may trigger share-alike obligations.
- Microsoft Global ML Building Footprints is also released under ODbL.
- DLR WSF 2019 is CC BY 4.0.
- GHSL is described by JRC as open/free; the exact product notice and citation must be captured per release.
- Copernicus data is generally free, full, and open, but specific contributing products such as DEM have their own notices/attribution.
- NASA Earth science data is generally openly available, sometimes behind Earthdata authentication; every product's citation and terms still enter the manifest.
- SDGSAT-1's published terms restrict data to scientific/non-commercial use, prohibit redistribution without permission, and restrict derivative compilation. It is excluded from an openly redistributable atlas unless CBAS grants suitable permission.
- ISS photography is US-government/NASA material in many cases, but image-level credit and any third-party restrictions must be checked; calibration derivatives retain source identifiers.

## Release partitions

To avoid licence ambiguity, design separate build graphs:

1. **Radiometry core:** Black Marble/EOG-derived native-resolution atlas with permissive/open provenance.
2. **Open attributed priors:** WSF/GHSL refinements where licence compatibility is confirmed.
3. **ODbL enhancement:** OSM/Microsoft-derived spatial refinement, distributed with required attribution/share-alike treatment after legal review.
4. **Restricted research packs:** SDGSAT or other sources; never published or consumed by the public app unless permission changes.

This separation also lets validation measure the value added by each source.

## Provenance graph

Every output chunk must be traceable through:

```text
release chunk
  -> posterior task + config + software commit
  -> normalized observation/prior tiles
  -> raw asset IDs + SHA-256
  -> provider landing page, product version, DOI, citation, licence snapshot
```

The graph records spatial/temporal overlap weights and method IDs, not merely a list of datasets used somewhere in the build.

## Required manifest fields per source

- provider and canonical URL;
- title, product/collection/release, DOI/citation;
- acquisition/query time and downloaded asset IDs;
- raw checksum, byte size, format, extent, time range;
- access account requirement but never credentials;
- licence identifier, licence URL, captured text/hash/date;
- redistribution and derivative constraints;
- mandatory attribution text;
- processing transform and software/config revision;
- release partitions permitted to consume it.

## OSM-specific rules

- Use the dated planet database, not rendered OSM tiles.
- Display `© OpenStreetMap contributors` and link to the ODbL as required in the final product/app.
- Preserve the snapshot date and derived-feature mapping revision.
- Do not infer that OSM or its contributors endorse the atlas.
- Obtain a legal determination on whether the emitted-cell posterior is a Derivative Database or Produced Work before setting distribution terms.

## Restricted-source contamination controls

- Separate credentials, raw storage, cache namespace, task queue, and output namespace.
- A build recipe declares its maximum licence class.
- The dependency graph rejects a restricted ancestor in an open output.
- Tests scan manifests and chunk provenance for forbidden source IDs.
- Models trained on restricted derivatives require separate review; training can itself transmit information into outputs.

## Attribution output

Every release generates both human-readable `ATTRIBUTION.md` and machine-readable `attribution.json`, including map/UI text appropriate to each active layer. The future application must be able to display attribution for the actual chunks/layers selected, not a stale hardcoded list.
