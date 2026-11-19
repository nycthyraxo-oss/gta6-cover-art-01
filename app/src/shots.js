// Fixed scenes for screenshots, driven by URL parameters — no interaction
// needed, so a headless browser can capture the app exactly as a person
// would see it after loading a photo:
//
//   ?shot=cover|editor
//     cover  — full-screen cover preview (editor chrome hidden)
//     editor — the editor, photo loaded, panels and controls visible
//   &photo=boulevard|pier        the first sample photo (default pier)
//   &photos=boulevard,pier       several sample photos, in panel order
//   &layout=hero|grid4|fullbleed|strip|grid9|diagonal
//   &grade=sunset|neon|magenta|halftone|gold
//   &size=1080x1080|1080x1350|1920x1080
//   &caption=...                 the title (default "Sunset Heist")
//   &subtitle=...                the subtitle line
//
// window.__shotReady is set once the scene has painted.
import { defaultPanels, LAYOUTS, GRADES, SIZES } from './cover.js';

export async function runShot(shot, query, state, loadImage, redraw) {
  if (shot === 'cover') document.body.classList.add('shot-cover');

  const layout = query.get('layout');
  if (layout && LAYOUTS[layout]) state.layout = layout;
  const grade = query.get('grade');
  if (grade && GRADES[grade]) state.grade = grade;
  const size = query.get('size');
  if (size && SIZES.some((s) => s.id === size)) state.size = size;

  const title = query.get('caption');
  if (title !== null) state.title = title;
  const subtitle = query.get('subtitle');
  if (subtitle !== null) state.subtitle = subtitle;

  // Load the requested sample photos, in order, then rebuild the panels so
  // each panel shows a different crop (or a different photo).
  const names = (query.get('photos') ?? query.get('photo') ?? 'pier')
    .split(',')
    .map((n) => n.trim())
    .filter(Boolean)
    .slice(0, 4);
  state.photos = [];
  for (const name of names) {
    try {
      state.photos.push(await loadImage(`samples/${name}.jpg`));
    } catch {
      // A missing sample leaves the panel empty rather than failing the shot.
    }
  }
  state.panels = defaultPanels(state.layout, state.photos.length);

  // Keep the shot controls in sync with the state the URL asked for.
  const titleInput = document.getElementById('title');
  if (titleInput) titleInput.value = state.title;
  const subInput = document.getElementById('subtitle');
  if (subInput) subInput.value = state.subtitle;

  redraw();
}
