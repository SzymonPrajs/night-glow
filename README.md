# Night Glow

An interactive observer-first night-sky and light-pollution explorer. Pick a location on the map, survey nearby mapped emitters, tune atmospheric scattering, and inspect the resulting sky in 3D.

The map and atmosphere controls live in edge drawers: hover either side to inspect them temporarily, or use the pin control to keep a drawer open across visits.

## Run locally

```bash
npm install
npm run dev
```

Create a production build with `npm run build` and check the source with `npm run lint`.

Run the deterministic conservation/direction benchmark with `npm run test:physics`. Run the real browser/worker progress flow with `npm run test:e2e` (install Chromium once with `npx playwright install chromium`).

## What is modeled

- A bundled regional layer supplies extended settlement footprints out to 1000 km. OpenStreetMap land-use polygons, roads, and settlement tags refine those footprints without adding a duplicate copy of their light.
- Every ellipse, polygon, and road is integrated by geometry quadrature into 81 observer-centred distance rings, 720 half-degree bearings, and eight spectral bands. Flux is conserved per band and sources remain spread across their real angular width.
- A curved-Earth radiative-transfer kernel models Rayleigh, aerosol, humidity, cloud, cloud/ground feedback, two-leg extinction, and a bounded multiple-scattering approximation. A harmonic circular convolution turns the ring grid into a full directional sky field.
- The expensive kernel and Fourier plan are cached in a Web Worker. Panning and zooming never recompute the model; atmosphere and location changes report real component progress while the UI remains responsive.
- Astronomy Engine supplies time- and observer-specific positions for the Sun, Moon, and planets. The bundled CDS/VizieR Yale Bright Star Catalogue supplies 8,404 catalogued stars through visual magnitude 6.5, including J2000 positions, Johnson V and B−V photometry, and MK spectral classifications.
- Stellar magnitude controls the point-spread size and intensity. B−V and spectral type set the intrinsic colour; air mass, aerosol, humidity, and cloud settings then add extinction, reddening, seeing halos, and chromatic atmospheric dispersion.
- Directional sky quality and limiting magnitude feed the visibility of stars, the Milky Way, clusters, nebulae, galaxies, and planets. Moonlight and twilight are applied separately.

The complete equations, conservation rules, cache design, performance measurements, verification, and limitations are in [docs/physical-glow-model.md](docs/physical-glow-model.md). The light model is an exploratory relative-radiance estimate, not calibrated photometry or a substitute for an all-sky light-pollution survey. If a public Overpass server times out, the extended regional footprints remain active; the UI reports that local OSM refinement was unavailable instead of inventing a directional point source.

Map and feature data © OpenStreetMap contributors, available under the ODbL.

Star data: Bright Star Catalogue, 5th Revised Ed. (Hoffleit & Warren, 1991), catalogue V/50 via CDS/VizieR.
