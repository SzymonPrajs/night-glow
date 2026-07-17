# Data workspace policy

This directory is the explicit boundary for repository-level data used during
research, conformance, and release construction. Domain-specific loaders and
precompute code remain with the domain that understands the data.

Only small, redistributable, checksummed conformance fixtures and their provenance
may be committed here. Large downloads, restricted inputs, staging products,
generated releases, caches, and benchmark artifacts remain local or in approved
object storage and are ignored by Git.

```text
data/
├── fixtures/       future small open cross-package fixtures
├── raw/            local immutable provider downloads; never committed
├── staging/        local normalized/intermediate products; never committed
├── generated/      local release candidates; never committed
└── cache/          disposable local caches; never committed
```

Every committed fixture must record source URL, licence, retrieval date, content
hash, coordinate/time/unit conventions, transformations, and expected values.
Environment owns environmental ingest and releases; Physics owns its scientific
assets and derived accelerators. This directory must not become a second copy of
either package's data model.
