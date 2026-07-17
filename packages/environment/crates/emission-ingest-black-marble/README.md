# `emission-ingest-black-marble`

This first native adapter validates and normalizes a tiny language-neutral
extraction of NASA Black Marble Collection 2 VNP46A2 scientific data sets. It
freezes the provider metadata and QA meanings documented in the official
[Collection 2 user guide](https://viirsland.gsfc.nasa.gov/PDF/BlackMarbleUserGuide_Collection2.0.pdf):

- corrected and gap-filled DNB radiance are unscaled `f32` values in
  `nW cm^-2 sr^-1`, with `-999.9` fill;
- mandatory quality values are `0` through `5`, with `255` as no retrieval;
- snow is `0`/`1`, with `255` fill;
- cloud-mask bit fields remain separate from retrieval quality.

The crate deliberately does not download provider data or link HDF5. A real
provider granule and an independently inspected extraction are still required
to close the Phase 2 feasibility gate. The fixture proves normalization and
corrupt-metadata rejection only.
