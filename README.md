[![Make.fun bounty](https://make.fun/badge/gta6-cover-art-01.svg)](https://make.fun/bounty/gta6-cover-art-01)
[![Rank](https://make.fun/badge/gta6-cover-art-01/nycthyraxo-oss/gta6-cover-art-01/rank.svg)](https://make.fun/bounty/gta6-cover-art-01)
[![Reward](https://make.fun/badge/gta6-cover-art-01/nycthyraxo-oss/gta6-cover-art-01/reward.svg)](https://make.fun/bounty/gta6-cover-art-01)

# Vice Cover Studio

A GTA 6-style cover art maker that runs entirely offline in a desktop
browser. Load a photo (or two, three, four), pick a multi-panel layout and
a Vice City colour grade, write a caption, and export a poster PNG in
1080 × 1080, 1080 × 1350, or 1920 × 1080. Nothing is uploaded: photos are
read on your own machine and never leave it.

This is an entry for the [Make GTA 6 Cover Art](https://make.fun/bounty/gta6-cover-art-01)
bounty on [make.fun](https://make.fun). All art and lettering here is
original — no Rockstar logo, artwork, or font. The display face is
[Anton](https://github.com/google/fonts/tree/main/ofl/anton) (SIL Open Font
License, vendored under `app/fonts/` with its licence text).

## How to run

```sh
node serve.ts          # serves app/ at http://localhost:8080
```

Open the page in desktop Chrome. Any static file server works — there is
no build step and no network request.

## What it does

- **6 panel layouts** — Hero + Three, 4-Panel Grid, Full Bleed, Tilted
  Snapshots, 9-Panel Grid, Diagonal Split. One photo fills every panel
  with a different crop; up to 4 photos can be mixed panel by panel.
- **5 colour grades** — Vice Sunset, Neon Night, Duotone Magenta, Comic
  Halftone, Gold Foil. Each is a canvas gradient / composite grade plus
  its own title-lettering palette.
- **Per-panel crop** — click a panel in the preview (or pick it in the
  panel controls) and set its photo, zoom (1–3×), and pan. Defaults give
  every panel a different crop of a single photo.
- **Caption** — editable title and subtitle, with gradient lettering,
  outline, and shadow toggles, left / centre / right alignment, a retro
  vector sun, film grain, and vignette.
- **Export** — one PNG per size, or all three at once, from the same
  renderer that draws the preview (no second code path).
- **Deterministic shots** — `?shot=cover|editor&photo=…&photos=…&layout=…&grade=…&size=…&caption=…&subtitle=…`
  loads a sample photo and renders with no interaction, so screenshots
  are reproducible. `?shot=cover` is the full-screen cover preview.
  `?verify=export` renders all three export sizes in memory and reports
  their pixel sizes and PNG byte counts into `#verify`.

## Approach

The classic poster-composition pipeline, implemented directly on canvas:
panel layout grid → per-panel cover-fit crop with zoom/pan → gradient-map
grade via canvas composite operations → bold display lettering with
gradient fill, outline, and shadow → grain and vignette. The grain uses a
fixed-seed generator, so the same state always draws the same pixels.
The export path reuses the preview renderer at full resolution.

## Validation

- `main.ts` run twice into two directories produces byte-identical trees:
  all 14 output files compare equal by sha256 (dossier.json
  `819cd1d862038425f731169fe415fd797d068c55f625b659d40c3be39ac22e12`,
  783,132 bytes; 9 app files; 4 screenshots).
- Headless Chrome (Google Chrome for Testing 157) loads the app with
  **zero console errors** and **zero network requests** (all assets are
  local files under `app/`).
- Export verification (`?verify=export`, headless): 1080 × 1080 →
  2,423,294 bytes; 1080 × 1350 → 3,007,902 bytes; 1920 × 1080 →
  4,189,918 bytes, each at the exact pixel size.
- Layout × grade sweep: all 6 layouts × 5 grades render without error.
- Screenshots (genuine headless-Chrome captures, JPEG quality 0.85):
  `1-cover.jpg` 1280 × 720, 111 KB; `2-editor.jpg` 1280 × 720, 122 KB;
  `3-cover-portrait.jpg` 1024 × 1280, 156 KB; `4-cover-square.jpg`
  1024 × 1024, 167 KB — each under the 256 KiB cap.
- Baseline vs this entry: the starter ("Cover Snap") had 1 layout,
  1 grade, 1 export size, 1 photo, no crop controls. This entry has
  6 layouts, 5 grades, 3 export sizes, up to 4 photos, and per-panel
  zoom/pan.

## Limitations (honest)

- **No face detection, no background removal.** Crops are manual:
  zoom and pan sliders per panel. A face can land half out of frame if
  you pan it there — the preview shows exactly what you will get.
- **No vector text.** Titles are rasterised onto the canvas at export
  resolution; they do not stay editable in the PNG.
- **One photo per panel.** A panel cannot blend two photos, and there is
  no layering or masking beyond the layout grid.
- **Sample photos are the kit's.** The two bundled samples were made
  with an image model for make.fun and are free to use; bring your own
  photos for real covers.
- **Desktop Chrome only, tested.** Other browsers should work (plain
  canvas + ES modules), but only headless Chrome 157 was verified here.

## Files

- `app/index.html`, `app/style.css` — editor UI.
- `app/src/cover.js` — the cover renderer (layouts, grades, lettering).
- `app/src/main.js` — state, controls, export, shot boot.
- `app/src/shots.js` — deterministic `?shot=` scenes.
- `app/fonts/Anton-Regular.ttf`, `app/fonts/OFL.txt` — OFL display font.
- `app/samples/` — the kit's two sample photos.
- `main.ts` — copies `app/` + `screenshots/` to `/output` and writes
  `dossier.json` via `vendor/makefun-app.ts`.
- `shots.json` — the four screenshots and the URLs they were taken from.
- `serve.ts` — the kit's tiny static server (development convenience).
