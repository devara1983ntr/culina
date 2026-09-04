# build/ — traced geometry inputs (committed)

These are the measured outputs of the tracing scripts and the **inputs** to
`scripts/generate-brand-assets.py` (which composes the family in
`assets/brand/vector/` + `scripts/raster-manifest.json`):

- `monogram-geom.json` — Panel B monogram Bézier paths + IoU report
  (`scripts/brand/trace_monogram.py`, IoU 0.97 vs the board mask)
- `emblem-geom.json` — Panel A emblem 16 color layers + IoU report
  (`scripts/brand/trace_emblem.py`, union IoU 0.92)

Regenerate after a board change: run the two trace scripts, then the
generator, then `node scripts/rasterize-brand.mjs`. Committing the geometry
keeps the generator deterministic without re-tracing.
