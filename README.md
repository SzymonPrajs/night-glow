# Night Glow

An interactive observer-first night-sky and light-pollution explorer. Pick a location on the map, survey nearby mapped emitters, tune atmospheric scattering, and inspect the resulting sky in 3D.

The map and atmosphere controls live in edge drawers: hover either side to inspect them temporarily, or use the pin control to keep a drawer open across visits.

## Run locally

```bash
npm install
npm run dev
```

Create a production build with `npm run build` and check the source with `npm run lint`.

## What is modeled

- OpenStreetMap land-use polygons, major roads, and nearby settlements are fetched through Overpass. Polygon area, road length, settlement class, and population tags are converted to directional light-source estimates.
- Each emitter is projected to its physical angular width and integrated into a continuous 360° horizon field. A normalized atmospheric convolution softens the edges without creating or losing total modeled light.
- Aerosol haze and humidity increase scattering. Low cloud cover reflects more urban light back toward the observer; higher cloud bases reduce that effect.
- Astronomy Engine supplies time- and observer-specific positions for the Sun, Moon, and planets. The bundled CDS/VizieR Yale Bright Star Catalogue supplies 8,404 catalogued stars through visual magnitude 6.5, including J2000 positions, Johnson V and B−V photometry, and MK spectral classifications.
- Stellar magnitude controls the point-spread size and intensity. B−V and spectral type set the intrinsic colour; air mass, aerosol, humidity, and cloud settings then add extinction, reddening, seeing halos, and chromatic atmospheric dispersion.
- Sky quality, limiting magnitude, Milky Way visibility, stars, clusters, nebulae, planets, moonlight, and twilight all respond to the model.

The light model is an exploratory visual estimate, not calibrated photometry or a substitute for an all-sky light-pollution survey. Public Overpass servers can occasionally time out; the interface falls back to a conservative baseline and retries whenever the pin moves.

Map and feature data © OpenStreetMap contributors, available under the ODbL.

Star data: Bright Star Catalogue, 5th Revised Ed. (Hoffleit & Warren, 1991), catalogue V/50 via CDS/VizieR.
