# WebAssembly binding

The Wasm package is an execution adapter for shared Rust crates, not a separate physics package.

The first exports cover the scalar exponential-transmittance parity probe and a
Wasm-owned coherent 24-value first-slice product buffer. The coordinator invokes
the product operation once per field-sized solve and copies the returned view
before any subsequent Wasm call. General asset handles and progressive solver
steps remain later binding work; this fixture ABI is not a production solver.

## Responsibilities

- create/destroy solver and asset handles;
- accept normalized scenario updates;
- map large Wasm-memory regions to typed arrays;
- expose bounded solve/refine steps and cancellation;
- return output descriptors, progress/residuals, and structured errors;
- expose compiled capabilities such as SIMD/threads and exact supported
  `physics_abi_revision`, observer-product/scenario schema and model-revision ranges.

## Boundary principles

- No per-pixel or per-star JavaScript calls.
- No JSON for large numeric arrays.
- Prefer handles and stable binary descriptors to copying internal state.
- Transfer owned `ArrayBuffer`s when shared memory is unavailable.
- Never retain a JavaScript view across a Wasm memory growth without refreshing it.
- Treat thread support as optional; a single-worker implementation is the compatibility baseline.
- Keep network/cache policy in TypeScript and rendering in WebGL2.

The Environment emission/atmosphere decoders and Physics solver remain independently versioned packages. They may run in one coordinator worker for efficient ownership, or exchange coarse contiguous `SurfaceEmissionBatch` and `AtmosphereStateVolume` buffers; independence never implies one JavaScript call/object per cell or voxel. Lifecycle names and handles follow the [unified system contract](../../../contracts/README.md).

The proposed API and memory ownership are detailed in [Wasm ABI](../../docs/contracts/wasm-abi.md).
