# Research: artificial light and emission maps

## Independent upstream expert

The sibling `environment-atlas/` project is the authority for source reconstruction. It defines a sparse, mixed-resolution H3 release built from corrected Black Marble radiometry, inventories, high-resolution evidence, OSM/settlement priors, and explicit quality/licence lineage. It is documentation-first and has not implemented Rust yet.

Its conserved baseline is not eight bands or total upward power. It is:

```text
J_DNB [W sr^-1]
  = DNB-response directional intensity
    integrated over exact surface support
    for a declared corrected reference-view convention
```

Spectrum, upward angle, and time are independent tagged profiles and may remain unresolved. The atlas proposes a higher-resolution source spectrum (10 nm bins from 350–950 nm plus narrow lines), which Physics will project into its own eventual runtime basis.

## What Physics does not research again

The atlas owns Black Marble product selection and QA; satellite-path atmospheric/view/lunar/BRDF correction semantics; exact support integration and conservative H3 refinement; OSM/WSF/GHSL/inventory fusion; source spectral/angular/temporal evidence; source-side uncertainty; source-only validation; release format; provenance and licence partitions.

Physics reviews those outputs for compatibility but does not build a second satellite inversion model inside its precompute or Wasm solver. Detailed atlas research remains in its own project.

## Physics research at the boundary

- verify `J_DNB`, DNB response, and corrected reference-view semantics;
- define insufficient-evidence, conservative-bound, and explicit-scenario behavior for unresolved spectrum/angle/time;
- validate joint spectral/angular forward closure to `J_DNB`;
- project vacuum-nanometre source spectra into the selected Physics basis with measured error;
- evaluate source-local ENU angular profiles without assuming Lambertian emission;
- combine atlas source-height evidence with Physics terrain exactly once;
- preserve coverage/censoring, uncertainty components, evidence, provenance, licence, and attribution;
- keep source/profile/atlas revisions distinct from propagation/scenario revisions;
- batch/stream mixed-resolution cells without per-cell JavaScript traffic;
- combine source-side chunk intensity bounds with a conservative transfer bound for adaptive domain termination.

## Surface-boundary subtlety

The corrected atlas value is already outgoing at the surface and may contain direct fixture/facade light plus downward lamp light that reflected upward. Physics consumes this combined outgoing boundary unless the atlas explicitly separates components. It must not apply the initial ground BRDF again. Later atmosphere-to-ground-to-atmosphere reflection is a new transport order and remains Physics work.

Likewise, Physics never replays the correction used to reconstruct the source from the satellite path; it propagates the corrected source along a new source-to-observer path.

## Validation split

Environment Atlas emission domain validates ingest, conservation, spatial/source reconstruction, profile evidence, and DNB forward closure. Physics validates adapter conservation/semantics, source construction, atmosphere/terrain/surface propagation, and observer radiance. End-to-end cases pin both revisions and report residuals separately rather than tuning one project to compensate for the other.

The shared integration fixture covers resolved and unresolved profiles, dark/upper-bound/no-evidence states, mixed H3 resolutions, time contexts, uncertainty/provenance, exact direction/height metadata, chunk bounds, and corrupt/incompatible data.

## Normative interface

The complete Physics-side contract is [Environment Atlas emission domain consumer contract](../contracts/EMISSION_RELEASE_CONTRACT.md). The atlas owns the producer meanings and future machine-readable schema; Physics either consumes its released schema/format decoder crates or proves an independent decoder against the same conformance fixture.
