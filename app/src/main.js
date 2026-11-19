// Wires Vice Cover Studio: state, controls, preview, PNG export.
// A `?shot=` query sets up a fixed scene for a screenshot instead
// (./shots.js). `?verify=export` renders all three export sizes in memory
// and reports their pixel sizes and PNG byte counts into #verify, so a
// headless run can prove the export path without a download.
import { drawCover, renderExport, defaultPanels, defaultState, LAYOUTS, GRADES, SIZES } from './cover.js';
import { runShot } from './shots.js';

const canvas = document.getElementById('cover');
const statusEl = document.getElementById('status');
const noteEl = document.getElementById('preview-note');
const errorsEl = document.getElementById('errors');
const verifyEl = document.getElementById('verify');

window.__errors = [];
window.addEventListener('error', (e) => {
  window.__errors.push(String(e.message || e.error));
  if (errorsEl) {
    errorsEl.hidden = false;
    errorsEl.textContent = `errors: ${window.__errors.join(' | ')}`;
  }
});

const state = defaultState();
let selectedPanel = 0;
let shotMode = '';

function loadImage(url) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error(`could not load ${url}`));
    img.src = url;
  });
}

function previewSize() {
  const size = SIZES.find((s) => s.id === state.size) ?? SIZES[0];
  // A cover shot renders at full export resolution; the browser scales it
  // to the window, so the screenshot shows the cover at its real pixels.
  if (shotMode === 'cover') return { w: size.w, h: size.h };
  const scale = 960 / Math.max(size.w, size.h);
  return { w: Math.round(size.w * scale), h: Math.round(size.h * scale) };
}

function redraw() {
  const { w, h } = previewSize();
  if (canvas.width !== w || canvas.height !== h) {
    canvas.width = w;
    canvas.height = h;
  }
  drawCover(canvas, state);
  const size = SIZES.find((s) => s.id === state.size) ?? SIZES[0];
  noteEl.textContent = `Preview ${size.label} · ${state.photos.length} photo${state.photos.length === 1 ? '' : 's'} · ${LAYOUTS[state.layout].name} · ${GRADES[state.grade].name}`;
}

function setStatus(text) {
  statusEl.textContent = text;
}

// --- choice buttons -------------------------------------------------------

function buildChoices(el, entries, current, onPick) {
  el.innerHTML = '';
  Object.entries(entries).forEach(([id, def]) => {
    const b = document.createElement('button');
    b.type = 'button';
    b.textContent = def.name ?? def.label ?? id;
    b.setAttribute('aria-pressed', String(id === current));
    b.addEventListener('click', () => onPick(id));
    el.appendChild(b);
  });
}

function refreshChoices() {
  buildChoices(document.getElementById('layouts'), LAYOUTS, state.layout, (id) => {
    state.layout = id;
    state.panels = defaultPanels(id, state.photos.length);
    selectedPanel = 0;
    syncPanelControls();
    refreshChoices();
    redraw();
  });
  buildChoices(document.getElementById('grades'), GRADES, state.grade, (id) => {
    state.grade = id;
    refreshChoices();
    redraw();
  });
  buildChoices(document.getElementById('sizes'), SIZES, state.size, (id) => {
    state.size = id;
    refreshChoices();
    redraw();
  });
}

// --- photos ---------------------------------------------------------------

function refreshThumbs() {
  const thumbs = document.getElementById('thumbs');
  thumbs.innerHTML = '';
  if (state.photos.length === 0) {
    const span = document.createElement('span');
    span.className = 'empty';
    span.textContent = 'No photo yet — upload one or try a sample.';
    thumbs.appendChild(span);
    return;
  }
  state.photos.forEach((img, i) => {
    const t = document.createElement('img');
    t.src = img.src;
    t.alt = `Photo ${i + 1}`;
    t.title = `Photo ${i + 1} — click to use it in the selected panel`;
    t.addEventListener('click', () => {
      state.panels[selectedPanel].photo = i;
      syncPanelControls();
      redraw();
    });
    thumbs.appendChild(t);
  });
}

async function addPhotoFiles(files) {
  const remaining = 4 - state.photos.length;
  const picked = [...files].slice(0, Math.max(0, remaining));
  for (const file of picked) {
    try {
      const img = await loadImage(URL.createObjectURL(file));
      state.photos.push(img);
    } catch {
      setStatus(`Could not read ${file.name}.`);
    }
  }
  if (picked.length === 0 && files.length > 0) setStatus('Four photos maximum.');
  state.panels = defaultPanels(state.layout, state.photos.length);
  selectedPanel = 0;
  refreshThumbs();
  syncPanelControls();
  redraw();
}

async function loadSample(name) {
  try {
    const img = await loadImage(`samples/${name}.jpg`);
    if (state.photos.length >= 4) state.photos.shift();
    state.photos.push(img);
    state.panels = defaultPanels(state.layout, state.photos.length);
    refreshThumbs();
    syncPanelControls();
    redraw();
  } catch {
    setStatus(`Sample ${name} failed to load.`);
  }
}

// --- panel controls ---------------------------------------------------------

function syncPanelControls() {
  const layout = LAYOUTS[state.layout];
  const sel = document.getElementById('panel-select');
  sel.innerHTML = '';
  layout.panels.forEach((_, i) => {
    const o = document.createElement('option');
    o.value = String(i);
    o.textContent = `Panel ${i + 1} of ${layout.panels.length}`;
    sel.appendChild(o);
  });
  sel.value = String(Math.min(selectedPanel, layout.panels.length - 1));

  const photoSel = document.getElementById('panel-photo');
  photoSel.innerHTML = '';
  const none = document.createElement('option');
  none.value = '-1';
  none.textContent = 'Empty';
  photoSel.appendChild(none);
  state.photos.forEach((_, i) => {
    const o = document.createElement('option');
    o.value = String(i);
    o.textContent = `Photo ${i + 1}`;
    photoSel.appendChild(o);
  });
  const panel = state.panels[selectedPanel] ?? { photo: -1, zoom: 1.15, dx: 0, dy: 0 };
  photoSel.value = String(panel.photo);
  const zoom = document.getElementById('panel-zoom');
  zoom.value = String(panel.zoom);
  document.getElementById('zoom-val').textContent = `${Number(panel.zoom).toFixed(2)}×`;
  document.getElementById('panel-dx').value = String(panel.dx);
  document.getElementById('panel-dy').value = String(panel.dy);
}

function panelAtPoint(clientX, clientY) {
  const r = canvas.getBoundingClientRect();
  const fx = (clientX - r.left) / r.width;
  const fy = (clientY - r.top) / r.height;
  const layout = LAYOUTS[state.layout];
  // Last matching panel wins, so tilted / overlapping panels pick the top one.
  let hit = -1;
  layout.panels.forEach((def, i) => {
    if (def.poly) {
      // Point-in-polygon for the diagonal split: above the diagonal or below it.
      const above = fy < 1 - fx;
      if ((i === 0 && above) || (i === 1 && !above)) hit = i;
      return;
    }
    if (fx >= def.x && fx <= def.x + def.w && fy >= def.y && fy <= def.y + def.h) hit = i;
  });
  return hit;
}

// --- export ---------------------------------------------------------------

function downloadBlob(blob, filename) {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 5000);
}

function exportPng(sizeId) {
  return new Promise((resolve) => {
    const off = renderExport(state, sizeId);
    off.toBlob((blob) => {
      if (!blob) {
        setStatus(`Export ${sizeId} failed.`);
        resolve(null);
        return;
      }
      downloadBlob(blob, `vice-cover-${sizeId}.png`);
      setStatus(`Saved vice-cover-${sizeId}.png (${blob.size.toLocaleString()} bytes).`);
      resolve({ size: sizeId, w: off.width, h: off.height, bytes: blob.size });
    }, 'image/png');
  });
}

async function exportAll() {
  const results = [];
  for (const s of SIZES) {
    const r = await exportPng(s.id);
    if (r) results.push(r);
  }
  return results;
}

// Exposed for headless verification: renders a size and reports its pixels.
window.__exportPNG = async (sizeId) => {
  const off = renderExport(state, sizeId);
  const blob = await new Promise((resolve) => off.toBlob(resolve, 'image/png'));
  return { size: sizeId, w: off.width, h: off.height, bytes: blob ? blob.size : 0 };
};

// --- wiring ---------------------------------------------------------------

document.getElementById('photos').addEventListener('change', (e) => {
  addPhotoFiles(e.target.files);
  e.target.value = '';
});
document.getElementById('sample-boulevard').addEventListener('click', () => loadSample('boulevard'));
document.getElementById('sample-pier').addEventListener('click', () => loadSample('pier'));
document.getElementById('clear-photos').addEventListener('click', () => {
  state.photos = [];
  state.panels = defaultPanels(state.layout, 0);
  selectedPanel = 0;
  refreshThumbs();
  syncPanelControls();
  redraw();
});

document.getElementById('title').addEventListener('input', (e) => {
  state.title = e.target.value;
  redraw();
});
document.getElementById('subtitle').addEventListener('input', (e) => {
  state.subtitle = e.target.value;
  redraw();
});
document.getElementById('opt-gradient').addEventListener('change', (e) => {
  state.titleStyle.gradient = e.target.checked;
  redraw();
});
document.getElementById('opt-outline').addEventListener('change', (e) => {
  state.titleStyle.outline = e.target.checked;
  redraw();
});
document.getElementById('opt-shadow').addEventListener('change', (e) => {
  state.titleStyle.shadow = e.target.checked;
  redraw();
});
document.getElementById('align').addEventListener('change', (e) => {
  state.titleStyle.align = e.target.value;
  redraw();
});
document.getElementById('opt-grain').addEventListener('change', (e) => {
  state.grain = e.target.checked;
  redraw();
});
document.getElementById('opt-vignette').addEventListener('change', (e) => {
  state.vignette = e.target.checked;
  redraw();
});

document.getElementById('panel-select').addEventListener('change', (e) => {
  selectedPanel = Number(e.target.value);
  syncPanelControls();
});
document.getElementById('panel-photo').addEventListener('change', (e) => {
  state.panels[selectedPanel].photo = Number(e.target.value);
  redraw();
});
document.getElementById('panel-zoom').addEventListener('input', (e) => {
  state.panels[selectedPanel].zoom = Number(e.target.value);
  document.getElementById('zoom-val').textContent = `${Number(e.target.value).toFixed(2)}×`;
  redraw();
});
document.getElementById('panel-dx').addEventListener('input', (e) => {
  state.panels[selectedPanel].dx = Number(e.target.value);
  redraw();
});
document.getElementById('panel-dy').addEventListener('input', (e) => {
  state.panels[selectedPanel].dy = Number(e.target.value);
  redraw();
});

canvas.addEventListener('click', (e) => {
  const hit = panelAtPoint(e.clientX, e.clientY);
  if (hit >= 0) {
    selectedPanel = hit;
    syncPanelControls();
  }
});

document.getElementById('export-1080x1080').addEventListener('click', () => exportPng('1080x1080'));
document.getElementById('export-1080x1350').addEventListener('click', () => exportPng('1080x1350'));
document.getElementById('export-1920x1080').addEventListener('click', () => exportPng('1920x1080'));
document.getElementById('export-all').addEventListener('click', exportAll);

// --- boot -----------------------------------------------------------------

async function verifyExports() {
  const results = [];
  for (const s of SIZES) {
    const r = await window.__exportPNG(s.id);
    results.push(r);
  }
  verifyEl.hidden = false;
  verifyEl.textContent = JSON.stringify(results);
  return results;
}

refreshChoices();
refreshThumbs();
syncPanelControls();

const query = new URLSearchParams(location.search);
shotMode = query.get('shot') ?? '';
if (shotMode) {
  try {
    await document.fonts.load('100px Anton');
    await document.fonts.ready;
  } catch {
    // Anton falls back to a bold system sans; the cover still draws.
  }
  await runShot(shotMode, query, state, loadImage, redraw);
  // The shot may have changed layout / grade / size and loaded photos after
  // the first paint, so rebuild the controls to match before the screenshot.
  refreshChoices();
  refreshThumbs();
  syncPanelControls();
  redraw();
  if (query.get('verify') === 'export') await verifyExports();
  requestAnimationFrame(() => requestAnimationFrame(() => {
    window.__shotReady = true;
  }));
} else {
  redraw();
}
