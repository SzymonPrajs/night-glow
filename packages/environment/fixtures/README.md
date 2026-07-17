# Environment fixtures

These are compact, synthetic metadata extracts used to test the Environment
normalization boundary without downloading or committing provider datasets.

- `v1/black-marble-vnp46a2-extract.json` describes a few Black Marble-like
  pixels with radiometry, support, validity and QA fields.
- `v1/atmosphere-provider-extracts.json` describes representative atmospheric
  variables and vertical-coordinate metadata.

Environment tests and the deterministic precompute probe load these files.
They intentionally contain no provider imagery, model volumes, credentials or
local downloads. The fixtures are source inputs and should remain tracked;
provider data and generated products should remain ignored.
