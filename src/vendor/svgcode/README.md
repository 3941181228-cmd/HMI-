# SVGcode integration for HMI

Based on [tomayac/SVGcode](https://github.com/tomayac/SVGcode), pinned at
`d8837bbe0bee4e1e8203bb2b5484fea60f574596`.

`trace.ts` adapts `src/js/colorworker.js` (Copyright 2021 Google LLC,
GPL-2.0-or-later). The original copyright and warranty notice is retained.
See LICENSE for GPL v2. Changes made 2026-09-09:

- Typed async API and progress messages for the HMI worker.
- Sequential per-RGBA masks using the existing bundled esm-potrace-wasm engine.
- Retained complete Potrace coordinate transforms and original RGBA for inputs
  with at most 128 colours. Complex inputs use bounded HMI alpha-aware palette
  preprocessing (2–64 colours), explicitly reported in the interface.
- Optional opaque-only seam strokes measured in original image pixels.
- Explicit size limits and errors; worker termination cancels conversion.
- SVGO 4.0.1 browser optimization in `src/services/vectorTrace.worker.ts`, based
  on SVGcode's optimization workflow; keeps the viewBox and colour groups.

This is an adapted integration, not a copy of the full SVGcode PWA. PWA install,
file system associations, experimental CanvasFilter and clipboard APIs are not
required. The original HMI palette tracing and AI component analysis remain.

Complete integration source and build files:
https://github.com/3941181228-cmd/HMI-

Dependencies: Potrace / esm-potrace-wasm (GPL), SVGO (MIT, with upstream license
in its published package). Neither library requires an API key or sends images
out of the browser. SVG output remains path-based and contains no raster image.
