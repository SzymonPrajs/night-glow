# WebAssembly binding

The Wasm package is an execution adapter for shared Rust crates, not a separate physics package.

## Responsibilities

- create/destroy solver and asset handles;
- accept normalized scenario updates;
- map large Wasm-memory regions to typed arrays;
- expose bounded solve/refine steps and cancellation;
- return output descriptors, progress/residuals, and structured errors;
- expose compiled capabilities such as SIMD/threads and schema/model versions.

## Boundary principles

- No per-pixel or per-star JavaScript calls.
- No JSON for large numeric arrays.
- Prefer handles and stable binary descriptors to copying internal state.
- Transfer owned `ArrayBuffer`s when shared memory is unavailable.
- Never retain a JavaScript view across a Wasm memory growth without refreshing it.
- Treat thread support as optional; a single-worker implementation is the compatibility baseline.
- Keep network/cache policy in TypeScript and rendering in WebGL2.

The proposed API and memory ownership are detailed in [Wasm ABI](../../docs/contracts/WASM_ABI.md).
