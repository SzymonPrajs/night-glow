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
- Aerosol haze and humidity increase scattering. Low cloud cover reflects more urban light back toward the observer; higher cloud bases reduce that effect.
- Astronomy Engine supplies time- and observer-specific positions for the Sun, Moon, and planets. J2000 positions are used for the recognizable bright-star and deep-sky catalog.
- Sky quality, limiting magnitude, Milky Way visibility, stars, clusters, nebulae, planets, moonlight, and twilight all respond to the model.

The light model is an exploratory visual estimate, not calibrated photometry or a substitute for an all-sky light-pollution survey. Public Overpass servers can occasionally time out; the interface falls back to a conservative baseline and retries whenever the pin moves.

Map and feature data © OpenStreetMap contributors, available under the ODbL.
