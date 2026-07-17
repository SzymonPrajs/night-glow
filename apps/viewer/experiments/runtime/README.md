# M1 Viewer runtime proof

This bounded experiment tests the planned Next.js App Router boundary without
turning it into the production Viewer. `/globe` dynamically loads MapLibre and a
synthetic custom WebGL layer; `/observe` dynamically loads an independent WebGL2
engine. The shared layout owns navigation only.

It uses no basemap, provider data, scientific equation, server function,
database, secret, or production claim. Run:

```bash
npm ci
npm run lint
npm run build
npm run dev
```

The experiment can be removed or revised without moving the runnable reference
Viewer or making `apps/viewer/` the root Makefile's active web application.
