import { SPATIAL_MODES } from '../constants.js';
import { buildTechniqueStimulus } from '../visualization/technique-data.js';
import { projectionOrder } from '../visualization/technique-ordering.js';
import { geometryBBox, mergeBBoxes, geometryPolygons, geometryCentroid } from '../spatial/map/geometry.js';
import { ComparativeViewer } from '../visualization/comparative-viewer.js';

const PORTRAIT = { width: 1240, height: 1754, pdfWidth: 595.28, pdfHeight: 841.89 };
const LANDSCAPE = { width: 1754, height: 1240, pdfWidth: 841.89, pdfHeight: 595.28 };
const MARGIN = 64;
const TEXT = '#0f172a';
const MUTED = '#64748b';
const LIGHT = '#e2e8f0';
const PANEL = '#f8fafc';
const ACCENT = '#2563eb';
const BLUES = [[0,247,251,255],[.125,222,235,247],[.25,198,219,239],[.375,158,202,225],[.5,107,174,214],[.625,66,146,198],[.75,33,113,181],[.875,8,81,156],[1,8,48,107]];

const hex = n => Math.round(n).toString(16).padStart(2, '0');
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const pct = value => `${Math.round((Number(value) || 0) * 100)}%`;
const fmt = value => Number.isFinite(Number(value)) ? String(Number(value)) : '—';

function blues(t) {
  const v = clamp(Number(t) || 0, 0, 1);
  for (let i = 0; i < BLUES.length - 1; i++) {
    const [t0,r0,g0,b0] = BLUES[i], [t1,r1,g1,b1] = BLUES[i + 1];
    if (v >= t0 && v <= t1) {
      const f = (v - t0) / (t1 - t0 || 1);
      return `#${hex(r0 + (r1-r0)*f)}${hex(g0 + (g1-g0)*f)}${hex(b0 + (b1-b0)*f)}`;
    }
  }
  const [,r,g,b] = BLUES.at(-1);
  return `#${hex(r)}${hex(g)}${hex(b)}`;
}
function valueColor(v) { return blues(.12 + .88 * clamp((Number(v) || 0) / 100, 0, 1)); }

function createCanvas(layout = PORTRAIT) {
  const canvas = document.createElement('canvas');
  canvas.width = layout.width;
  canvas.height = layout.height;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.textBaseline = 'top';
  return { canvas, ctx, layout };
}

function setFont(ctx, size, weight = 400) { ctx.font = `${weight} ${size}px system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif`; }
function line(ctx, x1, y1, x2, y2, color = LIGHT, width = 1) { ctx.strokeStyle = color; ctx.lineWidth = width; ctx.beginPath(); ctx.moveTo(x1,y1); ctx.lineTo(x2,y2); ctx.stroke(); }
function fillRoundRect(ctx, x, y, w, h, r, fill, stroke = null) {
  const rr = Math.min(r, w/2, h/2);
  ctx.beginPath(); ctx.moveTo(x+rr,y); ctx.arcTo(x+w,y,x+w,y+h,rr); ctx.arcTo(x+w,y+h,x,y+h,rr); ctx.arcTo(x,y+h,x,y,rr); ctx.arcTo(x,y,x+w,y,rr); ctx.closePath();
  if (fill) { ctx.fillStyle = fill; ctx.fill(); }
  if (stroke) { ctx.strokeStyle = stroke; ctx.lineWidth = 1; ctx.stroke(); }
}

function wrapLines(ctx, text, maxWidth) {
  const paras = String(text ?? '').replace(/\r/g, '').split('\n');
  const lines = [];
  for (const para of paras) {
    if (!para) { lines.push(''); continue; }
    const words = para.split(/\s+/);
    let current = '';
    for (const word of words) {
      const next = current ? `${current} ${word}` : word;
      if (ctx.measureText(next).width <= maxWidth || !current) current = next;
      else { lines.push(current); current = word; }
    }
    if (current) lines.push(current);
  }
  return lines;
}

function drawWrapped(ctx, text, x, y, maxWidth, lineHeight = 30, options = {}) {
  setFont(ctx, options.size || 24, options.weight || 400);
  ctx.fillStyle = options.color || TEXT;
  const lines = wrapLines(ctx, text, maxWidth);
  const maxLines = options.maxLines || Infinity;
  const visible = lines.slice(0, maxLines);
  if (lines.length > maxLines && visible.length) visible[visible.length - 1] = `${visible[visible.length - 1].replace(/…?$/, '')}…`;
  visible.forEach((l, i) => ctx.fillText(l, x, y + i * lineHeight));
  return y + visible.length * lineHeight;
}

function pageHeader(ctx, layout, projectName, runName, section) {
  ctx.fillStyle = TEXT; setFont(ctx, 22, 700); ctx.fillText(projectName || 'Propagation Studio', MARGIN, 34);
  ctx.fillStyle = MUTED; setFont(ctx, 18, 500); ctx.textAlign = 'right'; ctx.fillText(runName || '', layout.width - MARGIN, 38); ctx.textAlign = 'left';
  line(ctx, MARGIN, 72, layout.width - MARGIN, 72, LIGHT, 2);
  ctx.fillStyle = TEXT; setFont(ctx, 40, 750); ctx.fillText(section, MARGIN, 94);
}
function pageFooter(ctx, layout, label) {
  line(ctx, MARGIN, layout.height - 54, layout.width - MARGIN, layout.height - 54, LIGHT, 1);
  ctx.fillStyle = MUTED; setFont(ctx, 15, 500); ctx.fillText(label, MARGIN, layout.height - 39);
  ctx.textAlign = 'right'; ctx.fillText('Propagation Studio', layout.width - MARGIN, layout.height - 39); ctx.textAlign = 'left';
}

function modeLabel(run) {
  const mode = run?.space?.mode;
  if (mode === SPATIAL_MODES.SYNTHETIC_MAP) return 'Mapa sintético';
  if (mode === SPATIAL_MODES.GEOJSON) return 'GeoJSON';
  return 'Grid regular';
}
function spaceSize(run) {
  if (run?.space?.mode === SPATIAL_MODES.GRID) return `${run.grid?.rows ?? '—'} × ${run.grid?.columns ?? '—'} (${(run.regions || []).length} regiões)`;
  return `${(run?.regions || []).length} regiões`;
}
function createdLabel(run) {
  const d = run?.createdAt && !Number.isNaN(Date.parse(run.createdAt)) ? new Date(run.createdAt) : null;
  return d ? d.toLocaleString('pt-BR') : '—';
}
function statusLabel(run) { return run?.status === 'approved' ? 'Aprovada' : run?.status === 'rejected' ? 'Rejeitada' : 'Em análise'; }
function regionLabel(run, id) {
  const r = (run?.regions || []).find(item => item?.id === id);
  if (!r) return id || '—';
  const name = r.name || r.id;
  return name === r.id ? r.id : `${name} (${r.id})`;
}

export function describeRun(run) {
  const cfg = run?.simulationConfig || {}, p = run?.propagation || {}, direction = p.direction || {};
  const origins = (p.origins || []).map((o, i) => `Origem ${i + 1}: ${regionLabel(run, o.regionId)} · início t=${o.startTime ?? 0} · infectados=${o.infectedCount ?? '—'} · duração=${o.duration ?? '—'}${o.enabled === false ? ' · desativada' : ''}`);
  const focuses = (p.focuses || []).map((o, i) => `Foco ${i + 1}: ${regionLabel(run, o.regionId)} · início t=${o.startTime ?? '—'} · infectados=${o.infectedCount ?? '—'} · duração=${o.duration ?? '—'}${o.enabled === false ? ' · desativado' : ''}`);
  const jumps = (p.jumps || []).map((j, i) => `Salto ${i + 1}: ${regionLabel(run, j.sourceRegionId)} → ${regionLabel(run, j.targetRegionId)} · t=${j.startTime ?? '—'} · p=${fmt(j.probability)} · infectados=${j.infectedCount ?? '—'}${j.recurring ? ` · recorrente a cada ${j.interval ?? '—'}` : ''}${j.enabled === false ? ' · desativado' : ''}`);
  const barriers = (p.vaccinationBarriers || []).map((b, i) => `Bloqueio ${i + 1}: ${regionLabel(run, b.regionId)} · vacinação=${Math.round(Number(b.vaccinationCoverage) || 0)}%${b.enabled === false ? ' · desativado' : ''}`);
  const explicitPaths = (p.paths || []).map((path, i) => `Caminho ${i + 1}: ${(path.regionIds || []).map(id => regionLabel(run, id)).join(' → ') || regionLabel(run, path.sourceRegionId)}${path.enabled === false ? ' · desativado' : ''}`);
  const paths = explicitPaths.length ? explicitPaths : ((p.pathRegions || []).length ? [`Caminho legado: ${(p.pathRegions || []).map(item => regionLabel(run, item.regionId)).join(' → ')}`] : []);
  const directionText = direction.enabled === false ? 'Desativada' : `${direction.direction || 'radial'} · perfil ${direction.directionProfile || '—'} · força ${fmt(direction.directionStrength)}`;
  const geo = run?.space?.geojson || {}, synthetic = run?.space?.synthetic || {}, grid = run?.grid || {};
  const spaceLines = [
    `Tipo: ${modeLabel(run)}`,
    `Tamanho: ${spaceSize(run)}`,
    ...(run?.space?.mode === SPATIAL_MODES.GRID ? [`Vizinhança: ${grid.neighborhood || '—'} · borda: ${grid.borderMode || '—'} · população padrão: ${grid.defaultPopulation ?? '—'}`] : []),
    ...(run?.space?.mode === SPATIAL_MODES.SYNTHETIC_MAP ? [`Semente espacial: ${synthetic.spatialSeed ?? '—'} · irregularidade: ${synthetic.irregularity ?? '—'} · população padrão: ${synthetic.defaultPopulation ?? '—'}`] : []),
    ...(run?.space?.mode === SPATIAL_MODES.GEOJSON ? [`Arquivo: ${geo.sourceName || run.space?.sourceLabel || '—'} · população padrão: ${geo.defaultPopulation ?? '—'} · topologia: ${geo.topology?.method || '—'}`] : [])
  ];
  const simLines = [
    `Seed: ${run?.seed ?? cfg.seed ?? '—'} · passos: ${cfg.timeSteps ?? Math.max(0, (run?.history?.length || 1) - 1)} · unidade temporal: ${cfg.temporalUnit || '—'}`,
    `β=${fmt(cfg.beta)} · γ=${fmt(cfg.gamma)} · ν=${fmt(cfg.nu)} · mobilidade=${fmt(cfg.mobility)}`,
    `Peso local=${fmt(cfg.localTransmissionWeight)} · peso espacial=${fmt(cfg.spatialTransmissionWeight)} · ruído=${fmt(cfg.parameterNoise)}`,
    `Vacinação inicial=${fmt(cfg.initialVaccinationPct)}% · variação=${fmt(cfg.initialVaccinationVariationPct)}%`
  ];
  const pathMultiplier = p.pathSettings?.susceptibilityMultiplier;
  const propagationLines = [
    `Direção: ${directionText}`,
    `Origens: ${origins.length} · focos: ${focuses.length} · saltos: ${jumps.length} · bloqueios: ${barriers.length} · caminhos: ${paths.length || ((p.pathRegions || []).length ? 1 : 0)}`,
    ...(pathMultiplier != null ? [`Multiplicador de suscetibilidade em caminhos: ×${fmt(pathMultiplier)}`] : [])
  ];
  const s = run?.summary || {};
  const summaryLines = [
    `Regiões atingidas: ${s.reachedRegions ?? '—'}/${s.totalRegions ?? (run?.regions || []).length} · cobertura espacial: ${s.attackReach != null ? pct(s.attackReach) : '—'}`,
    `Duração com infectados: ${s.duration != null ? `t=${s.duration}` : '—'} · saltos executados: ${s.executedJumps ?? '—'}`,
    `Pico regional: ${s.peakRegion?.infected ?? '—'} infectados em ${regionLabel(run, s.peakRegion?.regionId)}${s.peakRegion?.time != null ? ` (t=${s.peakRegion.time})` : ''}`
  ];
  return { spaceLines, simLines, propagationLines, origins, focuses, jumps, barriers, paths, summaryLines };
}

function drawCover(project, runs) {
  const { canvas, ctx, layout } = createCanvas(PORTRAIT);
  ctx.fillStyle = ACCENT; ctx.fillRect(0, 0, 18, layout.height);
  ctx.fillStyle = TEXT; setFont(ctx, 58, 800); ctx.fillText('Relatório de execuções', 96, 150);
  ctx.fillStyle = MUTED; setFont(ctx, 28, 500); ctx.fillText(project?.name || 'Propagation Studio', 98, 232);
  fillRoundRect(ctx, 96, 322, layout.width - 192, 120, 18, PANEL, LIGHT);
  ctx.fillStyle = TEXT; setFont(ctx, 28, 750); ctx.fillText(`${runs.length} execução${runs.length === 1 ? '' : 'ões'}`, 128, 352);
  ctx.fillStyle = MUTED; setFont(ctx, 20, 500); ctx.fillText(`Gerado em ${new Date().toLocaleString('pt-BR')}`, 128, 397);
  ctx.fillStyle = TEXT; setFont(ctx, 25, 700); ctx.fillText('Conteúdo', 96, 520);
  ctx.fillStyle = MUTED; setFont(ctx, 20, 400); ctx.fillText('Configuração, eventos, observações e visualizações estáticas de cada execução.', 96, 564);
  let y = 650;
  for (let i = 0; i < runs.length; i++) {
    if (y > layout.height - 150) break;
    const run = runs[i];
    ctx.fillStyle = TEXT; setFont(ctx, 22, 700); ctx.fillText(`${i + 1}. ${run.name || run.id}`, 106, y);
    ctx.fillStyle = MUTED; setFont(ctx, 18, 400); ctx.fillText(`${modeLabel(run)} · ${spaceSize(run)} · ${createdLabel(run)}`, 106, y + 34);
    y += 78;
  }
  if (runs.length > 12) { ctx.fillStyle = MUTED; setFont(ctx, 18, 500); ctx.fillText(`+ ${runs.length - 12} execuções adicionais`, 106, y); }
  pageFooter(ctx, layout, 'Relatório consolidado');
  return { canvas, layout };
}

function infoBlocks(run) {
  const d = describeRun(run);
  return [
    { title: 'Identificação', lines: [`Execução: ${run.name || run.id}`, `ID: ${run.id}`, `Criada em: ${createdLabel(run)} · status: ${statusLabel(run)}`] },
    { title: 'Espaço', lines: d.spaceLines },
    { title: 'Parâmetros da simulação', lines: d.simLines },
    { title: 'Propagação', lines: d.propagationLines },
    { title: 'Origens', lines: d.origins.length ? d.origins : ['Nenhuma origem registrada.'] },
    { title: 'Focos', lines: d.focuses.length ? d.focuses : ['Nenhum foco registrado.'] },
    { title: 'Saltos', lines: d.jumps.length ? d.jumps : ['Nenhum salto registrado.'] },
    { title: 'Bloqueios vacinais', lines: d.barriers.length ? d.barriers : ['Nenhum bloqueio registrado.'] },
    { title: 'Caminhos', lines: d.paths.length ? d.paths : ['Nenhum caminho registrado.'] },
    { title: 'Resumo da execução', lines: d.summaryLines },
    { title: 'Observações', lines: [run.notes?.trim() || 'Nenhuma observação anotada para esta execução.'] }
  ];
}

function drawInfoPages(project, run, runIndex) {
  const pages = [];
  let page = createCanvas(PORTRAIT), { ctx, layout } = page, y;
  const newPage = continuation => {
    if (pages.length || continuation) pages.push(page);
    page = createCanvas(PORTRAIT); ctx = page.ctx; layout = page.layout;
    pageHeader(ctx, layout, project?.name, run.name || run.id, continuation ? 'Configuração e observações (continuação)' : 'Configuração e observações');
    y = 172;
  };
  pageHeader(ctx, layout, project?.name, run.name || run.id, 'Configuração e observações'); y = 172;
  const maxY = layout.height - 92;
  for (const block of infoBlocks(run)) {
    setFont(ctx, 25, 750);
    const titleH = 42;
    const allLines = [];
    for (const raw of block.lines) {
      setFont(ctx, 20, 400);
      const wrapped = wrapLines(ctx, raw, layout.width - MARGIN * 2 - 34);
      allLines.push(...wrapped.map((text, idx) => ({ text, bullet: idx === 0 })));
    }
    let lineIndex = 0;
    let firstChunk = true;
    while (lineIndex < allLines.length || firstChunk) {
      if (y + titleH + 46 > maxY) { pageFooter(ctx, layout, `Execução ${runIndex + 1}`); pages.push(page); page = createCanvas(PORTRAIT); ctx = page.ctx; layout = page.layout; pageHeader(ctx, layout, project?.name, run.name || run.id, 'Configuração e observações (continuação)'); y = 172; }
      if (firstChunk) { ctx.fillStyle = TEXT; setFont(ctx, 25, 750); ctx.fillText(block.title, MARGIN, y); y += 42; firstChunk = false; }
      if (!allLines.length) { y += 20; break; }
      while (lineIndex < allLines.length) {
        if (y + 31 > maxY) break;
        const item = allLines[lineIndex++];
        ctx.fillStyle = item.bullet ? ACCENT : MUTED; ctx.beginPath(); ctx.arc(MARGIN + 6, y + 10, item.bullet ? 4 : 2, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = TEXT; setFont(ctx, 20, 400); ctx.fillText(item.text, MARGIN + 24, y); y += 31;
      }
      if (lineIndex < allLines.length) { pageFooter(ctx, layout, `Execução ${runIndex + 1}`); pages.push(page); page = createCanvas(PORTRAIT); ctx = page.ctx; layout = page.layout; pageHeader(ctx, layout, project?.name, run.name || run.id, `${block.title} (continuação)`); y = 172; }
    }
    y += 18;
  }
  pageFooter(ctx, layout, `Execução ${runIndex + 1}`); pages.push(page);
  return pages;
}

function stimulusBBox(stimulus) {
  const boxes = stimulus.regions.filter(r => r.geometry).map(r => geometryBBox(r.geometry));
  return boxes.length ? mergeBBoxes(boxes) : { minX: 0, minY: 0, maxX: 1, maxY: 1 };
}

function drawRegionMap(ctx, stimulus, values, x, y, w, h, options = {}) {
  const neutral = !!options.neutral;
  ctx.save();
  ctx.fillStyle = '#ffffff'; ctx.fillRect(x, y, w, h);
  ctx.strokeStyle = '#cbd5e1'; ctx.lineWidth = Math.max(.6, Math.min(2, w / 500));
  if (stimulus.scenario === 'grid') {
    const rows = Math.max(1, Number(stimulus.grid.rows) || 1), cols = Math.max(1, Number(stimulus.grid.columns) || 1);
    const cell = Math.min(w / cols, h / rows), ox = x + (w - cell * cols) / 2, oy = y + (h - cell * rows) / 2;
    for (const r of stimulus.regions) {
      const rx = ox + ((Number(r.column) || 1) - 1) * cell, ry = oy + ((Number(r.row) || 1) - 1) * cell;
      ctx.fillStyle = neutral ? '#f8fafc' : valueColor(values?.[r.id] || 0); ctx.fillRect(rx, ry, cell, cell); ctx.strokeRect(rx, ry, cell, cell);
    }
  } else {
    const b = stimulusBBox(stimulus), bw = Math.max(1e-12, b.maxX - b.minX), bh = Math.max(1e-12, b.maxY - b.minY), flip = stimulus.spatialMode === SPATIAL_MODES.GEOJSON;
    const scale = Math.min(w / bw, h / bh), ox = x + (w - bw * scale) / 2, oy = y + (h - bh * scale) / 2;
    const point = (px, py) => [ox + (Number(px) - b.minX) * scale, oy + (flip ? b.maxY - Number(py) : Number(py) - b.minY) * scale];
    for (const r of stimulus.regions) {
      ctx.beginPath();
      for (const poly of geometryPolygons(r.geometry)) for (const ring of poly || []) {
        if (!ring?.length) continue;
        const [x0,y0] = point(ring[0][0], ring[0][1]); ctx.moveTo(x0,y0);
        for (let i = 1; i < ring.length; i++) { const [px,py] = point(ring[i][0], ring[i][1]); ctx.lineTo(px,py); }
        ctx.closePath();
      }
      ctx.fillStyle = neutral ? '#f8fafc' : valueColor(values?.[r.id] || 0); ctx.fill('evenodd'); ctx.stroke();
    }
  }
  ctx.restore();
}

function valuesAt(stimulus, index) { const out = {}; for (const r of stimulus.regions) out[r.id] = stimulus.series[r.id]?.[index] || 0; return out; }

function legend(ctx, x, y, w) {
  const steps = 80, h = 18;
  for (let i = 0; i < steps; i++) { ctx.fillStyle = valueColor(i / (steps - 1) * 100); ctx.fillRect(x + i * w / steps, y, w / steps + 1, h); }
  ctx.strokeStyle = '#94a3b8'; ctx.strokeRect(x, y, w, h);
  ctx.fillStyle = MUTED; setFont(ctx, 15, 500); ctx.fillText('0%', x, y + 25); ctx.textAlign = 'right'; ctx.fillText('100% infectados', x + w, y + 25); ctx.textAlign = 'left';
}



function nextFrame(count = 1) {
  return new Promise(resolve => {
    const step = remaining => remaining <= 0 ? resolve() : requestAnimationFrame(() => step(remaining - 1));
    step(count);
  });
}

function createOffscreenTechniqueRoot(width = 1320, height = 760) {
  const host = document.createElement('div');
  host.className = 'studio-layout visualization-workspace';
  host.style.position = 'fixed';
  host.style.left = '-100000px';
  host.style.top = '0';
  host.style.width = `${Math.max(960, Math.round(width))}px`;
  host.style.height = `${Math.max(560, Math.round(height))}px`;
  host.style.opacity = '1';
  host.style.pointerEvents = 'none';
  host.style.zIndex = '-1';
  host.style.background = '#ffffff';

  const workspace = document.createElement('div');
  workspace.className = 'workspace';
  workspace.style.width = '100%';
  workspace.style.height = '100%';
  const card = document.createElement('div');
  card.className = 'canvas-card';
  card.style.width = '100%';
  card.style.height = '100%';
  const stage = document.createElement('div');
  stage.className = 'canvas-stage';
  stage.style.width = '100%';
  stage.style.height = '100%';
  const container = document.createElement('div');
  container.id = 'technique-view';
  container.className = 'technique-view';
  container.hidden = false;
  container.style.width = '100%';
  container.style.height = '100%';

  stage.appendChild(container);
  card.appendChild(stage);
  workspace.appendChild(card);
  host.appendChild(workspace);
  document.body.appendChild(host);
  return { host, container };
}

function firstTechniqueTime(run) {
  const stimulus = buildTechniqueStimulus(run);
  return stimulus?.frameTimes?.[0] ?? 1;
}

async function renderTechniqueSnapshotHtml(run, mode, viewerOptions = {}) {
  if (typeof document === 'undefined') throw new Error('A exportação do relatório requer um navegador.');
  const width = Math.max(960, Math.round(Number(viewerOptions.width) || 1320));
  const height = Math.max(560, Math.round(Number(viewerOptions.height) || 760));
  const { host, container } = createOffscreenTechniqueRoot(width, height);
  const fakeState = {
    currentRun: () => run,
    currentTimeStep: viewerOptions.currentTimeStep ?? firstTechniqueTime(run),
    isPlaying: false
  };
  const viewer = new ComparativeViewer(container, fakeState, {
    onPlayPause: () => {},
    onTimeChange: () => {},
    onRegionClick: () => {}
  });
  try {
    if (mode === 'small_multiples') viewer.smallMultipleSize = Math.max(90, Math.min(320, Number(viewerOptions.smallMultipleSize) || 170));
    viewer.setMode(mode);
    await nextFrame(4);
    if (mode === 'glyph') {
      viewer.layoutGlyphs(viewer.getStimulus());
      viewer.updateGlyph(viewer.getStimulus(), Number.isFinite(Number(viewerOptions.glyphTimeIndex)) ? Number(viewerOptions.glyphTimeIndex) : viewer.glyphTimeIndex, false);
      await nextFrame(2);
    }

    const clone = container.cloneNode(true);
    clone.style.width = `${width}px`;
    if (mode === 'small_multiples') {
      clone.style.height = 'auto';
      clone.style.overflow = 'visible';
      const grid = clone.querySelector('.pe-small-grid');
      if (grid) {
        grid.style.maxHeight = 'none';
        grid.style.overflow = 'visible';
        const panels = [...grid.querySelectorAll('.pe-small-panel')];
        const cardSize = Math.max(90, Math.min(320, Number(viewerOptions.smallMultipleSize) || 170));
        const cols = Math.max(2, Math.floor(width / (cardSize + 18)));
        const rows = Math.max(2, Math.floor(860 / (cardSize * .78 + 18)));
        const perPage = Math.max(4, Math.min(24, cols * rows));
        const pageCount = Math.max(1, Math.ceil(panels.length / perPage));
        const pages = [];
        for (let pageIndex = 0; pageIndex < pageCount; pageIndex++) {
          const pageClone = clone.cloneNode(true);
          const pageGrid = pageClone.querySelector('.pe-small-grid');
          const pagePanels = [...pageGrid.querySelectorAll('.pe-small-panel')];
          pagePanels.forEach((panel, index) => {
            if (index < pageIndex * perPage || index >= (pageIndex + 1) * perPage) panel.remove();
          });
          const detail = pageClone.querySelector('.technique-heading > div > span');
          if (detail && pageCount > 1) detail.textContent = `${panels.length} instantes · todos exibidos no relatório · parte ${pageIndex + 1}/${pageCount}`;
          pages.push(pageClone.outerHTML);
        }
        return pages;
      }
      return [clone.outerHTML];
    }
    clone.style.height = `${height}px`;
    clone.style.overflow = 'hidden';
    return [clone.outerHTML];
  } finally {
    viewer.resizeObserver?.disconnect();
    host.remove();
  }
}

function htmlEscape(value) {
  return String(value ?? '').replace(/[&<>"']/g, char => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#039;' }[char]));
}

function infoBlockHtml(title, lines) {
  const items = (lines?.length ? lines : ['—']).map(line => `<li>${htmlEscape(line)}</li>`).join('');
  return `<section class="report-info-block"><h3>${htmlEscape(title)}</h3><ul>${items}</ul></section>`;
}

function runInfoHtml(run, runIndex) {
  const d = describeRun(run);
  const blocks = [
    ['Identificação', [`Execução: ${run.name || run.id}`, `ID: ${run.id}`, `Criada em: ${createdLabel(run)} · status: ${statusLabel(run)}`]],
    ['Espaço', d.spaceLines],
    ['Parâmetros da simulação', d.simLines],
    ['Propagação', d.propagationLines],
    ['Origens', d.origins.length ? d.origins : ['Nenhuma origem registrada.']],
    ['Focos', d.focuses.length ? d.focuses : ['Nenhum foco registrado.']],
    ['Saltos', d.jumps.length ? d.jumps : ['Nenhum salto registrado.']],
    ['Bloqueios vacinais', d.barriers.length ? d.barriers : ['Nenhum bloqueio registrado.']],
    ['Caminhos', d.paths.length ? d.paths : ['Nenhum caminho registrado.']],
    ['Resumo da execução', d.summaryLines],
    ['Observações', [run.notes?.trim() || 'Nenhuma observação anotada para esta execução.']]
  ];
  return `<section class="report-run-info report-page"><div class="report-kicker">Execução ${runIndex + 1}</div><h1>${htmlEscape(run.name || run.id)}</h1><div class="report-info-grid">${blocks.map(([title, lines]) => infoBlockHtml(title, lines)).join('')}</div></section>`;
}

function techniqueSectionHtml(run, mode, title, snapshotHtml) {
  return `<section class="report-technique report-page" data-mode="${htmlEscape(mode)}"><div class="report-technique-head"><div><span>${htmlEscape(run.name || run.id)}</span><h2>${htmlEscape(title)}</h2></div><div class="visualization-signal"><span>Variável</span><strong>Infectados (%)</strong><div class="visualization-fixed-legend"><span>0%</span><i></i><span>100%</span></div></div></div><div class="report-screen-frame"><div class="report-screen-scale"><div class="studio-layout visualization-workspace report-studio-shell"><main class="workspace"><div class="canvas-card"><div class="canvas-stage">${snapshotHtml}</div></div></main></div></div></div></section>`;
}

function reportDocumentHtml(project, runs, techniqueSections) {
  const base = document.baseURI;
  const mainCss = new URL('./css/main.css', base).href;
  const layoutCss = new URL('./css/layout.css', base).href;
  const componentsCss = new URL('./css/components.css', base).href;
  const runIndex = runs.map((run, i) => `<li><strong>${i + 1}. ${htmlEscape(run.name || run.id)}</strong><span>${htmlEscape(modeLabel(run))} · ${htmlEscape(spaceSize(run))}</span></li>`).join('');
  return `<!DOCTYPE html><html lang="pt-BR"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${htmlEscape(project?.name || 'Propagation Studio')} · Relatório</title><link rel="stylesheet" href="${mainCss}"><link rel="stylesheet" href="${layoutCss}"><link rel="stylesheet" href="${componentsCss}"><style>
    @page{size:A4 landscape;margin:9mm}
    *{box-sizing:border-box}
    html,body{margin:0;padding:0;background:#fff;color:#0f172a;font-family:system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;-webkit-print-color-adjust:exact;print-color-adjust:exact}
    body{padding:0}
    .report-page{break-before:page;page-break-before:always;position:relative;background:#fff}
    .report-cover{min-height:180mm;padding:18mm 16mm;display:flex;flex-direction:column;justify-content:center;break-after:page;page-break-after:always}
    .report-cover h1{font-size:34px;margin:0 0 8px}.report-cover p{color:#64748b;margin:0 0 28px;font-size:16px}.report-cover ol{display:grid;grid-template-columns:1fr 1fr;gap:10px 28px;margin:0;padding-left:24px}.report-cover li{padding:7px 0}.report-cover li span{display:block;color:#64748b;font-size:11px;margin-top:2px}
    .report-run-info{padding:4mm 2mm}.report-kicker{font-size:11px;text-transform:uppercase;letter-spacing:.08em;color:#2563eb;font-weight:800}.report-run-info h1{font-size:25px;margin:3px 0 12px}.report-info-grid{columns:2;column-gap:18px}.report-info-block{break-inside:avoid;margin:0 0 10px;border:1px solid #e2e8f0;border-radius:8px;padding:9px 11px}.report-info-block h3{margin:0 0 5px;font-size:12px}.report-info-block ul{margin:0;padding-left:17px}.report-info-block li{font-size:10px;line-height:1.38;margin:2px 0;color:#334155}
    .report-technique{padding:2mm 0}.report-technique-head{display:flex;align-items:flex-end;justify-content:space-between;gap:18px;margin-bottom:8px}.report-technique-head>div>span{font-size:10px;color:#64748b}.report-technique-head h2{font-size:20px;margin:2px 0 0}.report-technique-head .visualization-signal{display:flex;align-items:center;gap:7px;font-size:9px}.report-technique-head .visualization-fixed-legend{width:210px}
    .report-screen-frame{width:100%;overflow:visible;border:1px solid #cbd5e1;border-radius:9px;background:#fff;padding:6px}
    .report-screen-scale{width:1320px;zoom:.73;transform-origin:top left}
    .report-studio-shell{width:1320px!important;height:auto!important;min-height:0!important;display:block!important;background:#fff!important}
    .report-studio-shell .workspace{width:100%!important;height:auto!important;min-height:0!important;padding:0!important;background:#fff!important}
    .report-studio-shell .canvas-card{width:100%!important;height:auto!important;min-height:0!important;border:0!important;box-shadow:none!important}
    .report-studio-shell .canvas-stage{width:100%!important;height:auto!important;min-height:0!important;overflow:visible!important;background:#fff!important}
    .report-screen-scale .technique-view{background:#fff;color:#0f172a}
    .report-technique[data-mode="small_multiples"] .report-screen-frame{border:none;padding:0}
    .report-technique[data-mode="small_multiples"] .report-screen-scale{zoom:.73}
    .report-technique[data-mode="small_multiples"] .pe-small-grid{max-height:none!important;overflow:visible!important;break-inside:auto}
    .report-technique[data-mode="small_multiples"] .pe-small-panel{break-inside:avoid;page-break-inside:avoid}
    .report-technique[data-mode="projection1d"] .pe-projection-scroll{overflow:visible!important}
    .report-technique input[type=range],.report-technique button{pointer-events:none}
    @media print{.report-page:first-of-type{break-before:auto;page-break-before:auto}.report-screen-frame{box-shadow:none}}
  </style></head><body><section class="report-cover"><div class="report-kicker">Propagation Studio</div><h1>Relatório de execuções</h1><p>${htmlEscape(project?.name || 'Propagation Studio')} · ${runs.length} execução${runs.length === 1 ? '' : 'ões'} · gerado em ${htmlEscape(new Date().toLocaleString('pt-BR'))}</p><ol>${runIndex}</ol></section>${techniqueSections.join('')}</body></html>`;
}


const DIRECTION_REPORT_LABELS = {
  radial: ['◎', 'radial'],
  west_to_east: ['→', 'Oeste → Leste'],
  east_to_west: ['←', 'Leste → Oeste'],
  north_to_south: ['↓', 'Norte → Sul'],
  south_to_north: ['↑', 'Sul → Norte'],
  northeast: ['↗', 'Sudoeste → Nordeste'],
  southeast: ['↘', 'Noroeste → Sudeste'],
  northwest: ['↖', 'Sudeste → Noroeste'],
  southwest: ['↙', 'Nordeste → Sudoeste']
};

function activeItems(items) {
  return (Array.isArray(items) ? items : []).filter(item => item?.enabled !== false);
}

function reportDirection(run) {
  const direction = run?.propagation?.direction || {};
  if (direction.enabled === false) return { icon: '◎', label: 'desativada / radial' };
  const [icon, label] = DIRECTION_REPORT_LABELS[direction.direction] || ['', direction.direction || '—'];
  return { icon, label };
}

function reportRegionName(run, id) {
  const region = (run?.regions || []).find(item => item?.id === id);
  return region?.name && region.name !== id ? `${region.name} (${id})` : (id || '—');
}

function listRegionIds(run, items, key = 'regionId') {
  const ids = activeItems(items).map(item => item?.[key]).filter(Boolean);
  return ids.length ? ids.join(', ') : '—';
}

function reportCount(items) {
  const source = Array.isArray(items) ? items : [];
  const active = activeItems(source).length;
  const disabled = source.length - active;
  return disabled ? `${active} ativos · ${disabled} desativados` : String(active);
}

function regionMap(run) {
  return new Map((run?.regions || []).map(region => [region.id, region]));
}

function pathSequences(run) {
  const propagation = run?.propagation || {};
  const explicit = activeItems(propagation.paths)
    .map(path => (path.regionIds || []).filter(Boolean))
    .filter(ids => ids.length);
  if (explicit.length) return explicit;
  const legacy = activeItems(propagation.pathRegions).map(item => item.regionId).filter(Boolean);
  return legacy.length ? [legacy] : [];
}

function svgEscape(value) {
  return htmlEscape(value);
}

function gridMiniSvg(run, width = 190, height = 190) {
  const rows = Math.max(1, Number(run?.grid?.rows) || 1);
  const columns = Math.max(1, Number(run?.grid?.columns) || 1);
  const pad = 7;
  const cell = Math.min((width - pad * 2) / columns, (height - pad * 2) / rows);
  const gridW = cell * columns, gridH = cell * rows;
  const ox = (width - gridW) / 2, oy = (height - gridH) / 2;
  const byId = regionMap(run);
  const barriers = new Map(activeItems(run?.propagation?.vaccinationBarriers).map(item => [item.regionId, Number(item.vaccinationCoverage) || 0]));
  const paths = pathSequences(run);
  const pathIds = new Set(paths.flat());
  const origins = activeItems(run?.propagation?.origins);
  const focuses = activeItems(run?.propagation?.focuses);
  const jumps = activeItems(run?.propagation?.jumps);
  const center = id => {
    const r = byId.get(id);
    if (!r) return null;
    const row = Number(r.row), column = Number(r.column);
    if (!Number.isFinite(row) || !Number.isFinite(column)) return null;
    return [ox + (column - .5) * cell, oy + (row - .5) * cell];
  };
  const parts = [`<svg class="report-mini-space" viewBox="0 0 ${width} ${height}" role="img" aria-label="Configuração espacial da execução">`];
  for (let row = 1; row <= rows; row++) {
    for (let column = 1; column <= columns; column++) {
      const region = [...byId.values()].find(item => Number(item.row) === row && Number(item.column) === column);
      const id = region?.id;
      const coverage = id ? barriers.get(id) : null;
      const isPath = id && pathIds.has(id);
      let fill = '#ffffff';
      if (isPath) fill = '#fff1bd';
      if (coverage != null) fill = coverage >= 99.5 ? '#d9dee5' : '#f3ead8';
      const x = ox + (column - 1) * cell, y = oy + (row - 1) * cell;
      parts.push(`<rect x="${x}" y="${y}" width="${cell}" height="${cell}" fill="${fill}" stroke="#aeb9c5" stroke-width="0.75"/>`);
      if (coverage != null) {
        const mark = coverage >= 99.5 ? '×' : `${Math.round(coverage)}`;
        parts.push(`<text x="${x + cell * .14}" y="${y + cell * .28}" font-size="${Math.max(5.5, cell * .22)}" fill="#6b7280" font-family="system-ui,sans-serif">${mark}</text>`);
      }
    }
  }
  for (const ids of paths) {
    const points = ids.map(center).filter(Boolean);
    if (points.length >= 2) parts.push(`<polyline points="${points.map(p => p.join(',')).join(' ')}" fill="none" stroke="#c77b00" stroke-width="${Math.max(2.2, cell * .12)}" stroke-linecap="round" stroke-linejoin="round"/>`);
  }
  for (const jump of jumps) {
    const a = center(jump.sourceRegionId), b = center(jump.targetRegionId);
    if (a && b) parts.push(`<line x1="${a[0]}" y1="${a[1]}" x2="${b[0]}" y2="${b[1]}" stroke="#7c3aed" stroke-width="${Math.max(1.8, cell * .09)}" stroke-dasharray="5 4"/>`);
  }
  for (const origin of origins) {
    const p = center(origin.regionId); if (!p) continue;
    parts.push(`<circle cx="${p[0]}" cy="${p[1]}" r="${Math.max(4, cell * .28)}" fill="#111827"/>`);
  }
  for (const focus of focuses) {
    const p = center(focus.regionId); if (!p) continue;
    const r = Math.max(4, cell * .27);
    parts.push(`<circle cx="${p[0]}" cy="${p[1]}" r="${r}" fill="#ffffff" stroke="#2563eb" stroke-width="${Math.max(2, cell * .1)}"/><circle cx="${p[0]}" cy="${p[1]}" r="${Math.max(1.5, r * .28)}" fill="#2563eb"/>`);
  }
  parts.push('</svg>');
  return parts.join('');
}

function mapMiniSvg(run, width = 190, height = 190) {
  const regions = (run?.regions || []).filter(region => region?.geometry);
  if (!regions.length) return `<div class="report-mini-empty">Sem geometria disponível</div>`;
  const boxes = regions.map(region => geometryBBox(region.geometry));
  const bbox = mergeBBoxes(boxes);
  const bw = Math.max(1e-12, bbox.maxX - bbox.minX), bh = Math.max(1e-12, bbox.maxY - bbox.minY);
  const pad = 8, scale = Math.min((width - pad * 2) / bw, (height - pad * 2) / bh);
  const ox = (width - bw * scale) / 2, oy = (height - bh * scale) / 2;
  const flip = run?.space?.mode === SPATIAL_MODES.GEOJSON;
  const point = (x, y) => [ox + (Number(x) - bbox.minX) * scale, oy + (flip ? bbox.maxY - Number(y) : Number(y) - bbox.minY) * scale];
  const barriers = new Map(activeItems(run?.propagation?.vaccinationBarriers).map(item => [item.regionId, Number(item.vaccinationCoverage) || 0]));
  const paths = pathSequences(run), pathIds = new Set(paths.flat());
  const byId = regionMap(run);
  const centroid = id => {
    const region = byId.get(id); if (!region) return null;
    const c = region.geometry ? geometryCentroid(region.geometry) : region.displayCentroid;
    return c ? point(c.x, c.y) : null;
  };
  const parts = [`<svg class="report-mini-space" viewBox="0 0 ${width} ${height}" role="img" aria-label="Configuração espacial da execução">`];
  for (const region of regions) {
    let d = '';
    for (const polygon of geometryPolygons(region.geometry)) for (const ring of polygon || []) {
      if (!ring?.length) continue;
      const [x0, y0] = point(ring[0][0], ring[0][1]); d += `M${x0.toFixed(2)},${y0.toFixed(2)}`;
      for (let i = 1; i < ring.length; i++) { const [x, y] = point(ring[i][0], ring[i][1]); d += `L${x.toFixed(2)},${y.toFixed(2)}`; }
      d += 'Z';
    }
    const coverage = barriers.get(region.id), isPath = pathIds.has(region.id);
    let fill = '#ffffff';
    if (isPath) fill = '#fff1bd';
    if (coverage != null) fill = coverage >= 99.5 ? '#d9dee5' : '#f3ead8';
    parts.push(`<path d="${d}" fill="${fill}" stroke="#aeb9c5" stroke-width="0.8" fill-rule="evenodd"/>`);
    if (coverage != null) {
      const c = centroid(region.id); if (c) parts.push(`<text x="${c[0]}" y="${c[1]}" text-anchor="middle" dominant-baseline="central" font-size="7" fill="#6b7280" font-family="system-ui,sans-serif">${coverage >= 99.5 ? '×' : Math.round(coverage)}</text>`);
    }
  }
  for (const ids of paths) {
    const points = ids.map(centroid).filter(Boolean);
    if (points.length >= 2) parts.push(`<polyline points="${points.map(p => p.map(v => v.toFixed(2)).join(',')).join(' ')}" fill="none" stroke="#c77b00" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/>`);
  }
  for (const jump of activeItems(run?.propagation?.jumps)) {
    const a = centroid(jump.sourceRegionId), b = centroid(jump.targetRegionId);
    if (a && b) parts.push(`<line x1="${a[0]}" y1="${a[1]}" x2="${b[0]}" y2="${b[1]}" stroke="#7c3aed" stroke-width="2" stroke-dasharray="5 4"/>`);
  }
  for (const origin of activeItems(run?.propagation?.origins)) {
    const p = centroid(origin.regionId); if (p) parts.push(`<circle cx="${p[0]}" cy="${p[1]}" r="5" fill="#111827"/>`);
  }
  for (const focus of activeItems(run?.propagation?.focuses)) {
    const p = centroid(focus.regionId); if (p) parts.push(`<circle cx="${p[0]}" cy="${p[1]}" r="5" fill="#fff" stroke="#2563eb" stroke-width="2.5"/><circle cx="${p[0]}" cy="${p[1]}" r="1.6" fill="#2563eb"/>`);
  }
  parts.push('</svg>');
  return parts.join('');
}

export function runConfigurationMiniature(run) {
  return run?.space?.mode === SPATIAL_MODES.GRID ? gridMiniSvg(run) : mapMiniSvg(run);
}

function reportNotes(run) {
  const notes = String(run?.notes || '').trim();
  return notes ? `<p class="report-run-notes"><strong>Observações:</strong> ${htmlEscape(notes).replace(/\n/g, '<br>')}</p>` : '';
}

function reportRunCardHtml(run, index) {
  const p = run?.propagation || {}, cfg = run?.simulationConfig || {}, direction = reportDirection(run);
  const origins = activeItems(p.origins), focuses = activeItems(p.focuses), jumps = activeItems(p.jumps);
  const paths = pathSequences(run), barriers = activeItems(p.vaccinationBarriers);
  const originIds = origins.map(item => item.regionId).filter(Boolean).join(', ') || '—';
  const focusIds = focuses.map(item => item.regionId).filter(Boolean).join(', ') || '—';
  const status = statusLabel(run);
  const sizeText = run?.space?.mode === SPATIAL_MODES.GRID
    ? `${run.grid?.rows ?? '—'}×${run.grid?.columns ?? '—'}`
    : `${(run?.regions || []).length} regiões`;
  const steps = cfg.timeSteps ?? Math.max(0, (run?.history?.length || 1) - 1);
  const eventLine = [
    `${paths.length} caminho${paths.length === 1 ? '' : 's'}`,
    `${barriers.length} bloqueio${barriers.length === 1 ? '' : 's'}`,
    focuses.length ? `${focuses.length} foco${focuses.length === 1 ? '' : 's'}` : null,
    jumps.length ? `${jumps.length} salto${jumps.length === 1 ? '' : 's'}` : null
  ].filter(Boolean).join(' · ');
  return `<article class="report-run-card">
    <header class="report-run-card-head"><h2>${htmlEscape(run.name || `Execução ${index + 1}`)}</h2><span class="report-status ${htmlEscape(run?.status || 'review')}">${htmlEscape(status)}</span></header>
    <div class="report-run-card-body">
      <div class="report-mini-wrap">${runConfigurationMiniature(run)}</div>
      <div class="report-run-details">
        <p><strong>Espaço:</strong> ${htmlEscape(modeLabel(run))} · ${htmlEscape(sizeText)} · ${htmlEscape(steps)} passos</p>
        <p><strong>Direção:</strong> <span class="direction-symbol">${htmlEscape(direction.icon)}</span> ${htmlEscape(direction.label)}</p>
        <p><strong>Origens:</strong> ${htmlEscape(originIds)}</p>
        ${focuses.length ? `<p><strong>Focos:</strong> ${htmlEscape(focusIds)}</p>` : ''}
        <p><strong>Estrutura:</strong> ${htmlEscape(eventLine || 'sem caminhos, bloqueios, focos ou saltos')}</p>
        <p class="report-params"><strong>Simulação:</strong> β=${htmlEscape(fmt(cfg.beta))} · γ=${htmlEscape(fmt(cfg.gamma))} · ν=${htmlEscape(fmt(cfg.nu))} · mob=${htmlEscape(fmt(cfg.mobility))} · seed=${htmlEscape(run?.seed ?? cfg.seed ?? '—')}</p>
        ${reportNotes(run)}
      </div>
    </div>
  </article>`;
}

export function configurationReportDocumentHtml(project, runs, options = {}) {
  const baseHref = options.baseHref || '';
  const cards = (runs || []).map((run, index) => reportRunCardHtml(run, index)).join('');
  const generated = options.generatedAt || new Date().toLocaleString('pt-BR');
  const projectName = project?.name || 'Propagation Studio';
  return `<!DOCTYPE html><html lang="pt-BR"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${htmlEscape(projectName)} · Relatório de execuções</title>${baseHref ? `<base href="${htmlEscape(baseHref)}">` : ''}<style>
    @page{size:A4 portrait;margin:9mm}
    *{box-sizing:border-box}
    :root{color-scheme:light}
    html,body{margin:0;background:#fff;color:#111827;font-family:system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;-webkit-print-color-adjust:exact;print-color-adjust:exact}
    body{padding:24px}
    .report-toolbar{position:sticky;top:0;z-index:10;display:flex;align-items:center;justify-content:space-between;gap:16px;margin:-24px -24px 24px;padding:12px 24px;background:rgba(255,255,255,.96);border-bottom:1px solid #e5e7eb;backdrop-filter:blur(10px)}
    .report-toolbar strong{font-size:14px}.report-toolbar span{display:block;color:#64748b;font-size:11px;margin-top:2px}.report-toolbar button{border:0;border-radius:8px;background:#111827;color:#fff;font:600 13px system-ui;padding:9px 14px;cursor:pointer}
    .report-header{max-width:1420px;margin:0 auto 18px}.report-header h1{margin:0;font-size:24px}.report-header p{margin:5px 0 0;color:#64748b;font-size:12px}
    .report-legend{display:flex;flex-wrap:wrap;gap:12px;margin-top:12px;font-size:10px;color:#475569}.report-legend span{display:inline-flex;align-items:center;gap:5px}.legend-dot{width:9px;height:9px;border-radius:50%;display:inline-block;background:#111827}.legend-focus{width:10px;height:10px;border:2px solid #2563eb;border-radius:50%;display:inline-block}.legend-path{width:22px;height:5px;background:#fff1bd;border-top:2px solid #c77b00;display:inline-block}.legend-block{width:11px;height:11px;background:#d9dee5;color:#6b7280;display:inline-flex;align-items:center;justify-content:center;font-size:9px}.legend-jump{width:22px;border-top:2px dashed #7c3aed;display:inline-block}
    .report-grid{max-width:1420px;margin:0 auto;display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:20px 28px;align-items:start}
    .report-run-card{break-inside:avoid;page-break-inside:avoid;border-top:1px solid transparent;padding-top:2px;min-width:0}
    .report-run-card-head{display:flex;align-items:center;justify-content:space-between;gap:10px;margin-bottom:8px}.report-run-card h2{font-family:Georgia,"Times New Roman",serif;font-size:18px;line-height:1.15;margin:0;font-weight:700}.report-status{font-size:8px;text-transform:uppercase;letter-spacing:.06em;padding:3px 6px;border-radius:999px;background:#f1f5f9;color:#64748b;white-space:nowrap}.report-status.approved{background:#dcfce7;color:#166534}.report-status.rejected{background:#fee2e2;color:#991b1b}
    .report-run-card-body{display:grid;grid-template-columns:190px minmax(0,1fr);gap:14px;align-items:start}.report-mini-wrap{width:190px;height:190px}.report-mini-space{display:block;width:190px;height:190px;background:#fff}.report-mini-empty{width:190px;height:190px;border:1px solid #cbd5e1;display:flex;align-items:center;justify-content:center;color:#94a3b8;font-size:10px;text-align:center;padding:10px}
    .report-run-details{min-width:0;padding-top:3px}.report-run-details p{font-size:11px;line-height:1.32;margin:0 0 6px;color:#1f2937;overflow-wrap:anywhere}.report-run-details strong{font-weight:700}.direction-symbol{display:inline-block;min-width:14px;font-size:14px}.report-run-details .report-params{font-size:9.5px;color:#64748b}.report-run-notes{margin-top:9px!important;padding-top:8px;border-top:1px solid #e5e7eb;color:#64748b!important;font-size:9.5px!important;line-height:1.4!important}
    .report-footer{max-width:1420px;margin:24px auto 0;padding-top:10px;border-top:1px solid #e5e7eb;color:#94a3b8;font-size:9px;text-align:right}
    @media(max-width:900px){.report-grid{grid-template-columns:1fr}.report-run-card-body{grid-template-columns:170px 1fr}.report-mini-wrap,.report-mini-space,.report-mini-empty{width:170px;height:170px}}
    @media print{body{padding:0}.report-toolbar{display:none}.report-header{margin-bottom:5mm}.report-grid{gap:5mm 7mm;grid-template-columns:repeat(2,minmax(0,1fr))}.report-run-card-head{margin-bottom:2mm}.report-run-card h2{font-size:11pt}.report-run-card-body{grid-template-columns:35mm minmax(0,1fr);gap:3mm}.report-mini-wrap,.report-mini-space,.report-mini-empty{width:35mm;height:35mm}.report-run-details{padding-top:0}.report-run-details p{font-size:7.2pt;line-height:1.25;margin:0 0 1.2mm}.report-run-details .report-params,.report-run-notes{font-size:6.4pt!important}.report-status{font-size:5.5pt}.report-legend{font-size:6.5pt}.report-header h1{font-size:15pt}.report-header p{font-size:7pt}.report-footer{font-size:6pt;margin-top:5mm}.report-run-card{padding-bottom:1mm}}
  </style></head><body>
    <div class="report-toolbar"><div><strong>Relatório visual das execuções</strong><span>Revise a configuração e use o botão ao lado para salvar como PDF.</span></div><button type="button" onclick="window.print()">Imprimir / Salvar PDF</button></div>
    <header class="report-header"><h1>${htmlEscape(projectName)} · relatório de execuções</h1><p>${(runs || []).length} execução${(runs || []).length === 1 ? '' : 'ões'} · gerado em ${htmlEscape(generated)}</p><div class="report-legend"><span><i class="legend-dot"></i> Origem</span><span><i class="legend-focus"></i> Foco</span><span><i class="legend-path"></i> Caminho suscetível</span><span><i class="legend-block">×</i> Bloqueio total; número = parcial (%)</span><span><i class="legend-jump"></i> Salto</span></div></header>
    <main class="report-grid">${cards}</main>
    <footer class="report-footer">Propagation Studio · snapshots independentes de cada execução</footer>
  </body></html>`;
}

async function waitForPrintStyles(targetWindow) {
  try { await targetWindow.document.fonts?.ready; } catch {}
  await new Promise(resolve => setTimeout(resolve, 450));
}

async function canvasToJpegPage(page) {
  const blob = await new Promise((resolve, reject) => page.canvas.toBlob(b => b ? resolve(b) : reject(new Error('Falha ao rasterizar página do relatório.')), 'image/jpeg', .88));
  return { jpegBytes: new Uint8Array(await blob.arrayBuffer()), widthPx: page.canvas.width, heightPx: page.canvas.height, pdfWidth: page.layout.pdfWidth, pdfHeight: page.layout.pdfHeight };
}

const enc = new TextEncoder();
const ascii = text => enc.encode(text);
const concat = chunks => { const length=chunks.reduce((s,c)=>s+c.length,0), out=new Uint8Array(length); let off=0; for(const c of chunks){out.set(c,off);off+=c.length;} return out; };

/** Build a minimal PDF whose pages are JPEG images. Kept dependency-free so the Studio works offline. */
export function assemblePdf(pages) {
  if (!Array.isArray(pages) || !pages.length) throw new Error('Nenhuma página foi gerada para o PDF.');
  const chunks=[], offsets=[], push = bytes => chunks.push(bytes instanceof Uint8Array ? bytes : ascii(bytes));
  let offset=0; const append=bytes=>{const b=bytes instanceof Uint8Array?bytes:ascii(bytes);chunks.push(b);offset+=b.length;};
  append('%PDF-1.4\n% Propagation Studio\n');
  const addObject=(id,parts)=>{offsets[id]=offset;append(`${id} 0 obj\n`);for(const part of parts)append(part);append('\nendobj\n');};
  const kids=pages.map((_,i)=>`${3+i*3} 0 R`).join(' ');
  addObject(1,[`<< /Type /Catalog /Pages 2 0 R >>`]);
  addObject(2,[`<< /Type /Pages /Count ${pages.length} /Kids [${kids}] >>`]);
  pages.forEach((page,i)=>{
    const pageId=3+i*3,imageId=pageId+1,contentId=pageId+2,pw=Number(page.pdfWidth)||595.28,ph=Number(page.pdfHeight)||841.89;
    addObject(pageId,[`<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${pw.toFixed(2)} ${ph.toFixed(2)}] /Resources << /ProcSet [/PDF /ImageC] /XObject << /Im0 ${imageId} 0 R >> >> /Contents ${contentId} 0 R >>`]);
    offsets[imageId]=offset; append(`${imageId} 0 obj\n<< /Type /XObject /Subtype /Image /Width ${page.widthPx} /Height ${page.heightPx} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${page.jpegBytes.length} >>\nstream\n`); append(page.jpegBytes); append('\nendstream\nendobj\n');
    const stream=`q\n${pw.toFixed(2)} 0 0 ${ph.toFixed(2)} 0 0 cm\n/Im0 Do\nQ\n`,streamBytes=ascii(stream);
    offsets[contentId]=offset; append(`${contentId} 0 obj\n<< /Length ${streamBytes.length} >>\nstream\n`); append(streamBytes); append('endstream\nendobj\n');
  });
  const xrefOffset=offset,total=2+pages.length*3; append(`xref\n0 ${total+1}\n0000000000 65535 f \n`);
  for(let i=1;i<=total;i++)append(`${String(offsets[i]||0).padStart(10,'0')} 00000 n \n`);
  append(`trailer\n<< /Size ${total+1} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF\n`);
  return new Blob(chunks,{type:'application/pdf'});
}

export async function generateRunsPdf({ project, runs, onProgress = null }) {
  if (!Array.isArray(runs) || !runs.length) throw new Error('Não há execuções para incluir no relatório.');
  if (typeof window === 'undefined' || typeof document === 'undefined') throw new Error('O relatório precisa ser aberto no navegador.');

  onProgress?.({ current: 0, total: runs.length, phase: 'render' });
  const reportWindow = window.open('', '_blank');
  if (!reportWindow) throw new Error('O navegador bloqueou a janela do relatório. Permita pop-ups para este site e tente novamente.');
  try {
    const html = configurationReportDocumentHtml(project, runs, { baseHref: document.baseURI });
    reportWindow.document.open();
    reportWindow.document.write(html);
    reportWindow.document.close();
    onProgress?.({ current: runs.length, total: runs.length, phase: 'pdf' });
    try { await reportWindow.document.fonts?.ready; } catch {}
    reportWindow.focus();
    return { reportWindow };
  } catch (error) {
    try { reportWindow.close(); } catch {}
    throw error;
  }
}

