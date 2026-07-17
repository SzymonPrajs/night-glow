# First-slice machine-readable schemas

These JSON Schema 2020-12 documents freeze the public synthetic first-slice
descriptors. Rust decoders remain the executable semantic validators: they also
check array products, pressure ordering, conservation, dependency identities,
and physical bounds that JSON Schema alone cannot express.

Schema revisions are explicit constants. A compatible additive change requires
a new reviewed schema revision; model or release changes do not silently alter
the schema. The schemas describe language-neutral boundary data and are not a
TypeScript or Viewer API.
