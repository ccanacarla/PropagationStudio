import { geoJSONFromRegions } from '../spatial/map/geojson.js';

const esc = v => {
  const s = v == null ? '' : String(v);
  return /[",\n]/.test(s) ? `"${s.replaceAll('"', '""')}"` : s;
};

const isObject = value => value != null && typeof value === 'object' && !Array.isArray(value);
const plainClone = value => value == null ? value : structuredClone(value);

export function downloadBlob(filename, blob) {
  const url = URL.createObjectURL(blob), a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 800);
}

export function downloadText(filename, text, type = 'text/plain;charset=utf-8') {
  downloadBlob(filename, new Blob([text], { type }));
}

function frameEntries(frame) {
  if (frame instanceof Map) return [...frame.entries()];
  if (Array.isArray(frame)) {
    if (frame.every(row => Array.isArray(row) && row.length >= 2)) {
      return frame.map(([regionId, value]) => [String(regionId), isObject(value) ? value : {}]);
    }
    return frame
      .filter(row => isObject(row))
      .map(row => [String(row.regionId ?? row.id ?? ''), row])
      .filter(([regionId]) => regionId);
  }
  if (isObject(frame)) {
    return Object.entries(frame).map(([regionId, value]) => [String(regionId), isObject(value) ? value : {}]);
  }
  return [];
}

function mapFrame(frame) {
  return frameEntries(frame).map(([regionId, region]) => ({ ...plainClone(region), regionId }));
}

function historyFrames(history) {
  if (Array.isArray(history)) return history;
  if (!isObject(history)) return [];
  return Object.keys(history)
    .sort((a, b) => {
      const na = Number(a), nb = Number(b);
      return Number.isFinite(na) && Number.isFinite(nb) ? na - nb : String(a).localeCompare(String(b));
    })
    .map(key => history[key]);
}

function deserializeFrame(frame) {
  const entries = frameEntries(frame);
  return new Map(entries.map(([regionId, region]) => {
    const restored = { ...plainClone(region) };
    delete restored.regionId;
    return [regionId, restored];
  }));
}

function normalizeRegions(regions) {
  if (regions instanceof Map) return [...regions.values()].map(r => plainClone(r));
  if (Array.isArray(regions)) return regions.filter(isObject).map(r => plainClone(r));
  if (isObject(regions)) {
    return Object.entries(regions).map(([id, region]) => ({ id: region?.id ?? id, ...(plainClone(region) || {}) }));
  }
  return [];
}

export function serializeRun(run = {}) {
  return {
    ...run,
    history: historyFrames(run.history).map(mapFrame),
    regions: normalizeRegions(run.regions),
    eventLog: Array.isArray(run.eventLog) ? run.eventLog : [],
    edges: Array.isArray(run.edges) ? run.edges : []
  };
}

export function deserializeRun(run = {}, fallbacks = {}) {
  if (!isObject(run)) throw new TypeError('Execução inválida: o registro precisa ser um objeto.');

  const fallbackId = String(fallbacks.fallbackId || 'run-imported');
  const id = String(run.id || fallbackId);
  const simulationConfig = { ...(fallbacks.simulationConfig || {}), ...(isObject(run.simulationConfig) ? run.simulationConfig : {}) };
  const grid = { ...(fallbacks.grid || {}), ...(isObject(run.grid) ? run.grid : {}) };
  const space = { ...(fallbacks.space || {}), ...(isObject(run.space) ? run.space : {}) };
  const propagation = { ...(fallbacks.propagation || {}), ...(isObject(run.propagation) ? run.propagation : {}) };
  const regions = normalizeRegions(run.regions);
  const history = historyFrames(run.history).map(deserializeFrame);
  const allowedStatus = new Set(['review', 'approved', 'rejected']);

  return {
    ...run,
    id,
    name: String(run.name || fallbacks.name || id),
    status: allowedStatus.has(run.status) ? run.status : 'review',
    notes: String(run.notes || ''),
    seed: run.seed ?? simulationConfig.seed ?? null,
    space,
    grid,
    simulationConfig,
    propagation,
    regions,
    history,
    eventLog: Array.isArray(run.eventLog) ? plainClone(run.eventLog) : [],
    edges: Array.isArray(run.edges) ? plainClone(run.edges) : [],
    summary: isObject(run.summary) ? plainClone(run.summary) : null
  };
}

export function deserializeRuns(rawRuns, fallbacks = {}) {
  const source = Array.isArray(rawRuns) ? rawRuns : [];
  const runs = [], errors = [], seenIds = new Set();

  source.forEach((raw, index) => {
    try {
      const run = deserializeRun(raw, { ...fallbacks, fallbackId: `run-imported-${index + 1}`, name: `Execução ${index + 1}` });
      const baseId = run.id || `run-imported-${index + 1}`;
      let uniqueId = baseId, suffix = 2;
      while (seenIds.has(uniqueId)) uniqueId = `${baseId}-${suffix++}`;
      if (uniqueId !== run.id) run.id = uniqueId;
      seenIds.add(run.id);
      runs.push(run);
    } catch (error) {
      errors.push({ index, message: error instanceof Error ? error.message : String(error) });
    }
  });

  return { runs, errors };
}

export function projectPayload(state, includeRuns = true) {
  return {
    schemaVersion: '4.4.0',
    project: { ...state.project, schemaVersion: '4.4.0' },
    space: state.space,
    grid: state.grid,
    simulationConfig: state.simulationConfig,
    propagation: state.propagation,
    regions: [...state.regions.values()],
    analysisOptions: state.analysisOptions,
    dirty: state.dirty,
    selectedRunId: state.selectedRunId ?? null,
    currentTimeStep: Number(state.currentTimeStep) || 0,
    runs: includeRuns ? state.runs.map(serializeRun) : []
  };
}

export function projectJSON(state, includeRuns = true) {
  return JSON.stringify(projectPayload(state, includeRuns), null, 2);
}

export function runJSON(run) {
  return JSON.stringify(serializeRun(run), null, 2);
}

export function temporalCSV(run) {
  const h = ['run_id', 'spatial_mode', 'seed', 'time', 'region_id', 'region_name', 'population', 'susceptible', 'infected', 'recovered', 'vaccinated', 'path_susceptibility_multiplier', 'barrier_vaccination_pct', 'new_infections', 'new_recoveries', 'new_vaccinations', 'local_infections', 'imported_infections', 'active_origin', 'origin_id', 'active_focus', 'focus_id', 'received_jump', 'jump_id'];
  const rows = [h.join(',')], names = new Map((run.regions || []).map(r => [r.id, r.name]));
  (run.history || []).forEach((frame, t) => {
    for (const [id, r] of frameEntries(frame)) rows.push([run.id, run.space?.mode || 'grid', run.seed, t, id, names.get(id) || id, r.population, r.susceptible, r.infected, r.recovered, r.vaccinated, r.pathSusceptibilityMultiplier ?? 1, r.barrierVaccinationPct ?? '', r.newInfections || 0, r.newRecoveries || 0, r.newVaccinations || 0, r.localInfections || 0, r.importedInfections || 0, r.activeOrigin ? 1 : 0, r.activeOriginId || '', r.activeFocus ? 1 : 0, r.activeFocusId || '', r.receivedJump ? 1 : 0, r.receivedJumpId || ''].map(esc).join(','));
  });
  return rows.join('\n');
}

export function eventsCSV(run) {
  const keys = ['time', 'type', 'originId', 'focusId', 'jumpId', 'regionId', 'sourceRegionId', 'targetRegionId', 'infectedCount', 'infectedIntroduced', 'reason'];
  const rows = [keys.join(',')];
  for (const e of run.eventLog || []) rows.push(keys.map(k => esc(e[k])).join(','));
  return rows.join('\n');
}

export function edgesCSV(run) {
  const keys = ['id', 'sourceRegionId', 'targetRegionId', 'type', 'baseWeight', 'multiplier', 'effectiveWeight', 'normalizedWeight', 'enabled', 'blockedByVaccination'];
  const rows = [keys.join(',')];
  for (const e of run.edges || []) rows.push(keys.map(k => esc(e[k])).join(','));
  return rows.join('\n');
}

export function regionsCSV(run) {
  const keys = ['region_id', 'region_name', 'spatial_mode', 'population', 'initial_susceptible', 'initial_infected', 'initial_recovered', 'initial_vaccinated', 'initial_vaccinated_pct', 'path_susceptibility_multiplier', 'barrier_vaccination_pct', 'arrival_time', 'peak_time', 'peak_infected'];
  const rows = [keys.join(',')], summary = run.summary || {}, regionMap = new Map((run.regions || []).map(r => [r.id, r]));
  const firstFrame = run.history?.[0] instanceof Map ? run.history[0] : deserializeFrame(run.history?.[0]);
  for (const id of regionMap.keys()) {
    const arrival = summary.arrivals?.[id], p = summary.regionPeaks?.[id] || {}, base = firstFrame?.get(id), meta = regionMap.get(id);
    rows.push([id, meta?.name || id, run.space?.mode || 'grid', base?.population || meta?.population || '', base?.susceptible ?? '', base?.infected ?? '', base?.recovered ?? '', base?.vaccinated ?? '', base?.population ? ((100 * base.vaccinated / base.population).toFixed(3)) : '', base?.pathSusceptibilityMultiplier ?? 1, base?.barrierVaccinationPct ?? '', arrival ?? '', p.time ?? '', p.infected ?? ''].map(esc).join(','));
  }
  return rows.join('\n');
}

export function regionsGeoJSON(run) {
  const regions = new Map((run.regions || []).map(r => [r.id, r]));
  if (![...regions.values()].some(r => r.geometry)) return null;
  const props = {};
  for (const [id, r] of regions) {
    const p = run.summary?.regionPeaks?.[id] || {};
    props[id] = {
      arrival_time: run.summary?.arrivals?.[id] ?? null,
      peak_time: p.time ?? null,
      peak_infected: p.infected ?? null,
      initial_vaccinated_pct: r.population ? 100 * r.vaccinated / r.population : 0,
      path_susceptibility_multiplier: r.pathSusceptibilityMultiplier ?? 1,
      barrier_vaccination_pct: r.barrierVaccinationPct ?? null
    };
  }
  return JSON.stringify(geoJSONFromRegions(regions, props), null, 2);
}
