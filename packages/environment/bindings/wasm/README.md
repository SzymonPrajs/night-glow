# WebAssembly bindings

This is a thin browser ABI over shared Environment format/query crates. It
will expose release registration, chunk planning/decoding, numeric queries,
regional interpolation, bounded climatology sampling and contiguous-buffer handoff
to Physics.

It will not contain provider ingestion, global weather prediction, data fusion,
optical closure, radiative transfer, per-cell JavaScript callbacks or a second set
of equations. Emission and atmosphere handles remain independently versioned even
when one worker hosts both decoders. Large outputs use typed arrays or transferable
buffers, with explicit units, shape, support, revision, uncertainty and lifetime.

Native and Wasm builds consume the same conformance fixtures. The single-worker
path is mandatory; SIMD and threads are optional measured tiers.
