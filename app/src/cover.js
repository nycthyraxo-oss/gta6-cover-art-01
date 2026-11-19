// Cover engine for Vice Cover Studio.
//
// A cover is drawn onto any 2D canvas from a plain state object:
//   { layout, grade, size, title, subtitle, titleStyle, grain, vignette,
//     photos: [HTMLImageElement...], panels: [{photo, zoom, dx, dy}...] }
// `photos[i]` is an image (or null); `panels[j].photo` is an index into
// photos, or -1 for an empty panel. Everything is deterministic: the film
// grain comes from a fixed-seed generator, so the same state always draws
// the same pixels. No network, no fonts outside app/fonts/.

export const SIZES = [
  { id: '1080x1080', label: '1080 × 1080', w: 1080, h: 1080 },
  { id: '1080x1350', label: '1080 × 1350', w: 1080, h: 1350 },
  { id: '1920x1080', label: '1920 × 1080', w: 1920, h: 1080 },
];

// Panel rects are fractions of the cover (x, y, w, h). `rot` tilts a panel
// around its centre; `poly` clips to a polygon instead of a rectangle;
// `bleed` draws the panel edge to edge with no gutter.
export const LAYOUTS = {
  hero: {
    name: 'Hero + Three',
    panels: [
      { x: 0, y: 0, w: 0.62, h: 1 },
      { x: 0.62, y: 0, w: 0.38, h: 0.3333 },
      { x: 0.62, y: 0.3333, w: 0.38, h: 0.3333 },
      { x: 0.62, y: 0.6666, w: 0.38, h: 0.3334 },
    ],
  },
  grid4: {
    name: '4-Panel Grid',
    panels: [
      { x: 0, y: 0, w: 0.5, h: 0.5 },
      { x: 0.5, y: 0, w: 0.5, h: 0.5 },
      { x: 0, y: 0.5, w: 0.5, h: 0.5 },
      { x: 0.5, y: 0.5, w: 0.5, h: 0.5 },
    ],
  },
  fullbleed: {
    name: 'Full Bleed',
    bleed: true,
    panels: [{ x: 0, y: 0, w: 1, h: 1 }],
  },
  strip: {
    name: 'Tilted Snapshots',
    panels: [
      { x: 0.015, y: 0.07, w: 0.31, h: 0.86, rot: -5 },
      { x: 0.345, y: 0.02, w: 0.31, h: 0.92, rot: 1.5 },
      { x: 0.675, y: 0.07, w: 0.31, h: 0.86, rot: 5 },
    ],
  },
  grid9: {
    name: '9-Panel Grid',
    panels: [
      { x: 0, y: 0, w: 1 / 3, h: 1 / 3 },
      { x: 1 / 3, y: 0, w: 1 / 3, h: 1 / 3 },
      { x: 2 / 3, y: 0, w: 1 / 3, h: 1 / 3 },
      { x: 0, y: 1 / 3, w: 1 / 3, h: 1 / 3 },
      { x: 1 / 3, y: 1 / 3, w: 1 / 3, h: 1 / 3 },
      { x: 2 / 3, y: 1 / 3, w: 1 / 3, h: 1 / 3 },
      { x: 0, y: 2 / 3, w: 1 / 3, h: 1 / 3 },
      { x: 1 / 3, y: 2 / 3, w: 1 / 3, h: 1 / 3 },
      { x: 2 / 3, y: 2 / 3, w: 1 / 3, h: 1 / 3 },
    ],
  },
  diagonal: {
    name: 'Diagonal Split',
    panels: [
      { x: 0, y: 0, w: 1, h: 1, poly: [[0, 0], [1, 0], [0, 1]] },
      { x: 0, y: 0, w: 1, h: 1, poly: [[1, 0], [1, 1], [0, 1]] },
    ],
  },
};

export const GRADES = {
  sunset: {
    name: 'Vice Sunset',
    title: ['#ffe259', '#ff7e5f', '#ff2e88'],
    scrim: 'rgba(16, 4, 26, 0.55)',
  },
  neon: {
    name: 'Neon Night',
    title: ['#7df9ff', '#ff71ce', '#b967ff'],
    scrim: 'rgba(4, 8, 26, 0.55)',
  },
  magenta: {
    name: 'Duotone Magenta',
    title: ['#ffd6f2', '#ff2e88', '#a100ff'],
    scrim: 'rgba(26, 2, 30, 0.55)',
  },
  halftone: {
    name: 'Comic Halftone',
    title: ['#ffffff', '#ffd76a', '#ff5e3a'],
    scrim: 'rgba(10, 10, 18, 0.55)',
  },
  gold: {
    name: 'Gold Foil',
    title: ['#fff6c9', '#ffd76a', '#c8860a'],
    scrim: 'rgba(24, 14, 2, 0.55)',
  },
};

export const BG = '#160a20';

// Default per-panel crop for a layout slot: with one photo, every panel
// shows a different crop of it, so a single photo still fills the poster.
export function defaultPanels(layoutId, photoCount) {
  const layout = LAYOUTS[layoutId] ?? LAYOUTS.hero;
  return layout.panels.map((_, i) => {
    const col = i % 3;
    const row = Math.floor(i / 3) % 3;
    return {
      photo: photoCount > 0 ? i % photoCount : -1,
      zoom: 1.15 + (i % 3) * 0.12,
      dx: photoCount > 0 ? (col - 1) * 0.45 : 0,
      dy: photoCount > 0 ? (row - 1) * 0.45 : 0,
    };
  });
}

export function defaultState() {
  return {
    layout: 'hero',
    grade: 'sunset',
    size: '1920x1080',
    title: 'VICE CITY',
    subtitle: 'A SUNSET HEIST IN THE NEON HEAT',
    titleStyle: { gradient: true, outline: true, shadow: true, align: 'center' },
    grain: true,
    vignette: true,
    photos: [],
    panels: defaultPanels('hero', 0),
  };
}

// --- deterministic noise -------------------------------------------------

function mulberry32(seed) {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

let grainTile = null;
function getGrainTile() {
  if (grainTile) return grainTile;
  const tile = document.createElement('canvas');
  tile.width = 160;
  tile.height = 160;
  const tctx = tile.getContext('2d');
  const img = tctx.createImageData(160, 160);
  const rand = mulberry32(20261119);
  for (let i = 0; i < img.data.length; i += 4) {
    const v = Math.floor(rand() * 255);
    img.data[i] = v;
    img.data[i + 1] = v;
    img.data[i + 2] = v;
    img.data[i + 3] = 22;
  }
  tctx.putImageData(img, 0, 0);
  grainTile = tile;
  return tile;
}

let dotTile = null;
function getDotTile() {
  if (dotTile) return dotTile;
  const tile = document.createElement('canvas');
  tile.width = 10;
  tile.height = 10;
  const tctx = tile.getContext('2d');
  tctx.fillStyle = '#000000';
  tctx.beginPath();
  tctx.arc(5, 5, 2.6, 0, Math.PI * 2);
  tctx.fill();
  dotTile = tile;
  return tile;
}

// --- panel geometry -------------------------------------------------------

function panelRect(def, w, h, gutter, bleed) {
  const inset = bleed ? 0 : gutter / 2;
  return {
    x: def.x * w + inset,
    y: def.y * h + inset,
    w: def.w * w - inset * 2,
    h: def.h * h - inset * 2,
  };
}

// Begin the clip path for a panel (rectangle, rotated rectangle, polygon).
function tracePanel(ctx, def, rect) {
  ctx.beginPath();
  if (def.poly) {
    // Polygon points are fractions of the whole cover.
    def.poly.forEach(([px, py], i) => {
      const x = px * ctx.canvas.width;
      const y = py * ctx.canvas.height;
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    });
    ctx.closePath();
    return;
  }
  if (def.rot) {
    const cx = rect.x + rect.w / 2;
    const cy = rect.y + rect.h / 2;
    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate((def.rot * Math.PI) / 180);
    ctx.rect(-rect.w / 2, -rect.h / 2, rect.w, rect.h);
    ctx.restore();
    return;
  }
  ctx.rect(rect.x, rect.y, rect.w, rect.h);
}

function drawPhotoInto(ctx, img, rect, panel, rotDeg) {
  const iw = img.naturalWidth || img.width;
  const ih = img.naturalHeight || img.height;
  const zoom = panel.zoom || 1;
  const base = Math.max(rect.w / iw, rect.h / ih) * zoom;
  const pad = rotDeg ? 1.3 : 1;
  const dw = iw * base * pad;
  const dh = ih * base * pad;
  const overflowX = Math.max(0, (dw - rect.w) / 2);
  const overflowY = Math.max(0, (dh - rect.h) / 2);
  const cx = rect.x + rect.w / 2 + (panel.dx || 0) * overflowX;
  const cy = rect.y + rect.h / 2 + (panel.dy || 0) * overflowY;
  ctx.save();
  ctx.translate(cx, cy);
  if (rotDeg) ctx.rotate((rotDeg * Math.PI) / 180);
  ctx.drawImage(img, -dw / 2, -dh / 2, dw, dh);
  ctx.restore();
}

// --- colour grades --------------------------------------------------------

function applyGrade(ctx, gradeId, rect) {
  const { x, y, w, h } = rect;
  ctx.save();
  ctx.beginPath();
  ctx.rect(x, y, w, h);
  ctx.clip();
  if (gradeId === 'sunset') {
    const g = ctx.createLinearGradient(0, y, 0, y + h);
    g.addColorStop(0, 'rgba(255, 140, 60, 0.10)');
    g.addColorStop(0.6, 'rgba(255, 80, 120, 0.18)');
    g.addColorStop(1, 'rgba(160, 20, 110, 0.42)');
    ctx.fillStyle = g;
    ctx.fillRect(x, y, w, h);
    ctx.globalCompositeOperation = 'soft-light';
    ctx.fillStyle = 'rgba(255, 154, 61, 0.55)';
    ctx.fillRect(x, y, w, h);
  } else if (gradeId === 'neon') {
    const g = ctx.createLinearGradient(x, y, x + w, y + h);
    g.addColorStop(0, 'rgba(0, 229, 255, 0.34)');
    g.addColorStop(0.55, 'rgba(120, 40, 255, 0.22)');
    g.addColorStop(1, 'rgba(255, 0, 128, 0.38)');
    ctx.globalCompositeOperation = 'overlay';
    ctx.fillStyle = g;
    ctx.fillRect(x, y, w, h);
    ctx.globalCompositeOperation = 'multiply';
    const m = ctx.createLinearGradient(0, y, 0, y + h);
    m.addColorStop(0, 'rgba(0, 0, 0, 0)');
    m.addColorStop(1, 'rgba(10, 0, 30, 0.45)');
    ctx.fillStyle = m;
    ctx.fillRect(x, y, w, h);
  } else if (gradeId === 'magenta') {
    ctx.globalCompositeOperation = 'color';
    ctx.globalAlpha = 0.85;
    ctx.fillStyle = '#e0218a';
    ctx.fillRect(x, y, w, h);
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = 'multiply';
    const m = ctx.createLinearGradient(0, y, 0, y + h);
    m.addColorStop(0, 'rgba(0, 0, 0, 0)');
    m.addColorStop(1, 'rgba(30, 0, 40, 0.5)');
    ctx.fillStyle = m;
    ctx.fillRect(x, y, w, h);
  } else if (gradeId === 'halftone') {
    ctx.globalCompositeOperation = 'overlay';
    ctx.globalAlpha = 0.14;
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(x, y, w, h);
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = 'soft-light';
    ctx.fillStyle = 'rgba(255, 46, 136, 0.45)';
    ctx.fillRect(x, y, w, h);
    ctx.globalCompositeOperation = 'multiply';
    ctx.globalAlpha = 0.2;
    ctx.fillStyle = ctx.createPattern(getDotTile(), 'repeat');
    ctx.fillRect(x, y, w, h);
    ctx.globalAlpha = 1;
  } else if (gradeId === 'gold') {
    const g = ctx.createLinearGradient(0, y, 0, y + h);
    g.addColorStop(0, 'rgba(255, 214, 106, 0.5)');
    g.addColorStop(1, 'rgba(184, 106, 0, 0.55)');
    ctx.globalCompositeOperation = 'soft-light';
    ctx.fillStyle = g;
    ctx.fillRect(x, y, w, h);
    ctx.globalCompositeOperation = 'overlay';
    ctx.globalAlpha = 0.28;
    ctx.fillStyle = '#ffb700';
    ctx.fillRect(x, y, w, h);
    ctx.globalAlpha = 1;
  }
  ctx.restore();
}

// --- the cover ------------------------------------------------------------

export function drawCover(canvas, state) {
  const ctx = canvas.getContext('2d');
  const w = canvas.width;
  const h = canvas.height;
  const layout = LAYOUTS[state.layout] ?? LAYOUTS.hero;
  const grade = GRADES[state.grade] ?? GRADES.sunset;
  const gutter = Math.max(4, Math.round(Math.min(w, h) * 0.008));

  ctx.save();
  ctx.clearRect(0, 0, w, h);
  ctx.fillStyle = BG;
  ctx.fillRect(0, 0, w, h);

  // Panels.
  layout.panels.forEach((def, i) => {
    const rect = panelRect(def, w, h, gutter, layout.bleed);
    const panel = state.panels[i] ?? { photo: -1, zoom: 1.15, dx: 0, dy: 0 };
    const img = panel.photo >= 0 ? state.photos[panel.photo] : null;

    ctx.save();
    tracePanel(ctx, def, rect);
    ctx.clip();
    if (img) {
      drawPhotoInto(ctx, img, rect, panel, def.rot || 0);
    } else {
      const g = ctx.createLinearGradient(rect.x, rect.y, rect.x, rect.y + rect.h);
      g.addColorStop(0, '#3a1c52');
      g.addColorStop(1, '#1c0b2a');
      ctx.fillStyle = g;
      ctx.fillRect(rect.x, rect.y, rect.w, rect.h);
      ctx.fillStyle = 'rgba(255, 255, 255, 0.45)';
      ctx.font = `700 ${Math.max(12, rect.h * 0.045)}px system-ui, sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('ADD PHOTO', rect.x + rect.w / 2, rect.y + rect.h / 2);
    }
    ctx.restore();

    // Grade overlay, clipped to the same panel shape.
    ctx.save();
    tracePanel(ctx, def, rect);
    ctx.clip();
    applyGrade(ctx, state.grade, rect);
    ctx.restore();

    // Panel edge.
    if (!layout.bleed) {
      ctx.save();
      tracePanel(ctx, def, rect);
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.22)';
      ctx.lineWidth = Math.max(1, gutter * 0.28);
      ctx.stroke();
      ctx.restore();
    }
  });

  // Diagonal split needs its dividing band drawn over the seam.
  if (state.layout === 'diagonal') {
    ctx.save();
    ctx.strokeStyle = BG;
    ctx.lineWidth = gutter * 1.6;
    ctx.beginPath();
    ctx.moveTo(w, 0);
    ctx.lineTo(0, h);
    ctx.stroke();
    ctx.restore();
  }

  // Retro sun, top right, drawn as plain vector shapes (original art).
  const sunR = Math.min(w, h) * 0.085;
  const sunX = w - sunR * 1.5;
  const sunY = sunR * 1.5;
  ctx.save();
  ctx.beginPath();
  ctx.arc(sunX, sunY, sunR, 0, Math.PI * 2);
  ctx.clip();
  const sg = ctx.createLinearGradient(sunX, sunY - sunR, sunX, sunY + sunR);
  sg.addColorStop(0, '#ffe259');
  sg.addColorStop(1, '#ff2e88');
  ctx.fillStyle = sg;
  ctx.fillRect(sunX - sunR, sunY - sunR, sunR * 2, sunR * 2);
  ctx.fillStyle = BG;
  for (let i = 0; i < 3; i += 1) {
    const sy = sunY + sunR * (0.1 + i * 0.28);
    ctx.fillRect(sunX - sunR, sy, sunR * 2, sunR * 0.07);
  }
  ctx.restore();

  // Caption band: scrim + title + subtitle along the foot.
  const titleText = (state.title || '').trim().toUpperCase();
  const subText = (state.subtitle || '').trim();
  const bandH = h * 0.26;
  const bandTop = h - bandH;
  const scrim = ctx.createLinearGradient(0, bandTop - h * 0.06, 0, h);
  scrim.addColorStop(0, 'rgba(16, 4, 26, 0)');
  scrim.addColorStop(0.45, grade.scrim);
  scrim.addColorStop(1, 'rgba(10, 2, 18, 0.92)');
  ctx.fillStyle = scrim;
  ctx.fillRect(0, bandTop - h * 0.06, w, bandH + h * 0.06);

  const align = state.titleStyle?.align ?? 'center';
  const tx = align === 'left' ? w * 0.06 : align === 'right' ? w * 0.94 : w / 2;
  ctx.textAlign = align;
  ctx.textBaseline = 'alphabetic';

  if (titleText) {
    let size = h * 0.135;
    const setFont = (s) => {
      ctx.font = `${s}px Anton, 'Arial Black', sans-serif`;
    };
    setFont(size);
    const maxW = w * 0.9;
    while (ctx.measureText(titleText).width > maxW && size > 14) {
      size -= 2;
      setFont(size);
    }
    const ty = h - h * 0.085;
    ctx.save();
    if (state.titleStyle?.shadow !== false) {
      ctx.shadowColor = 'rgba(0, 0, 0, 0.55)';
      ctx.shadowBlur = size * 0.12;
      ctx.shadowOffsetY = size * 0.04;
    }
    if (state.titleStyle?.gradient !== false) {
      const tg = ctx.createLinearGradient(0, ty - size, 0, ty + size * 0.15);
      grade.title.forEach((c, i) => tg.addColorStop(i / (grade.title.length - 1), c));
      ctx.fillStyle = tg;
    } else {
      ctx.fillStyle = '#ffffff';
    }
    if (state.titleStyle?.outline !== false) {
      ctx.lineJoin = 'round';
      ctx.strokeStyle = '#14041f';
      ctx.lineWidth = Math.max(2, size * 0.07);
      ctx.strokeText(titleText, tx, ty);
    }
    ctx.fillText(titleText, tx, ty);
    ctx.restore();
  }

  if (subText) {
    const subSize = Math.max(13, h * 0.032);
    ctx.font = `700 ${subSize}px system-ui, sans-serif`;
    try {
      ctx.letterSpacing = `${Math.max(2, subSize * 0.12)}px`;
    } catch {
      // Older canvas implementations ignore letterSpacing; spacing stays tight.
    }
    ctx.fillStyle = 'rgba(255, 255, 255, 0.92)';
    ctx.fillText(subText.toUpperCase(), tx, h - h * 0.028);
    try {
      ctx.letterSpacing = '0px';
    } catch {
      // No-op on engines without the property.
    }
  }

  // Frame.
  ctx.save();
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.28)';
  ctx.lineWidth = Math.max(2, Math.min(w, h) * 0.004);
  ctx.strokeRect(ctx.lineWidth / 2, ctx.lineWidth / 2, w - ctx.lineWidth, h - ctx.lineWidth);
  ctx.restore();

  // Vignette, then grain.
  if (state.vignette !== false) {
    const vg = ctx.createRadialGradient(
      w / 2, h / 2, Math.min(w, h) * 0.42,
      w / 2, h / 2, Math.max(w, h) * 0.75,
    );
    vg.addColorStop(0, 'rgba(0, 0, 0, 0)');
    vg.addColorStop(1, 'rgba(0, 0, 0, 0.38)');
    ctx.fillStyle = vg;
    ctx.fillRect(0, 0, w, h);
  }
  if (state.grain !== false) {
    ctx.save();
    ctx.globalCompositeOperation = 'overlay';
    ctx.globalAlpha = 0.5;
    ctx.fillStyle = ctx.createPattern(getGrainTile(), 'repeat');
    ctx.fillRect(0, 0, w, h);
    ctx.restore();
  }
  ctx.restore();
}

// Renders the same state at export resolution on a fresh canvas.
export function renderExport(state, sizeId) {
  const size = SIZES.find((s) => s.id === sizeId) ?? SIZES[0];
  const canvas = document.createElement('canvas');
  canvas.width = size.w;
  canvas.height = size.h;
  drawCover(canvas, state);
  return canvas;
}
