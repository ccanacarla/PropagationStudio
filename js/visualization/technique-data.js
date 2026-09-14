import { SPATIAL_MODES } from '../constants.js';

const clampPct = value => Math.max(0, Math.min(100, Number.isFinite(value) ? value : 0));

function frameMap(frame) {
  if (frame instanceof Map) return frame;
  if (Array.isArray(frame)) {
    if (frame.every(row => Array.isArray(row) && row.length >= 2)) return new Map(frame);
    return new Map(frame.filter(Boolean).map(row => [String(row.regionId ?? row.id ?? ''), row]).filter(([id]) => id));
  }
  if (frame && typeof frame === 'object') return new Map(Object.entries(frame));
  return new Map();
}

function gridNeighborGraph(regions, grid = {}) {
  const rows = Math.max(1, Number(grid.rows) || 1), cols = Math.max(1, Number(grid.columns) || 1);
  const moore = String(grid.neighborhood || 'moore') !== 'von_neumann';
  const toroidal = String(grid.borderMode || 'normal') === 'toroidal';
  const byCell = new Map(regions.map(r => [`${r.row},${r.column}`, r.id]));
  const offsets = moore
    ? [[-1,-1],[-1,0],[-1,1],[0,-1],[0,1],[1,-1],[1,0],[1,1]]
    : [[-1,0],[0,-1],[0,1],[1,0]];
  const graph = {};
  for (const r of regions) {
    const ids = new Set();
    for (const [dr, dc] of offsets) {
      let rr = Number(r.row) + dr, cc = Number(r.column) + dc;
      if (toroidal) {
        rr = ((rr - 1 + rows) % rows) + 1;
        cc = ((cc - 1 + cols) % cols) + 1;
      }
      const id = byCell.get(`${rr},${cc}`);
      if (id && id !== r.id) ids.add(id);
    }
    graph[r.id] = [...ids];
  }
  return graph;
}

function mapNeighborGraph(regions, run) {
  const graph = Object.fromEntries(regions.map(r => [r.id, [...new Set(r.neighbors || [])]]));
  if (Object.values(graph).some(ids => ids.length)) return graph;
  for (const edge of run?.edges || []) {
    if (!edge?.sourceRegionId || !edge?.targetRegionId || edge.type === 'jump') continue;
    if (!graph[edge.sourceRegionId]) graph[edge.sourceRegionId] = [];
    if (!graph[edge.targetRegionId]) graph[edge.targetRegionId] = [];
    if (!graph[edge.sourceRegionId].includes(edge.targetRegionId)) graph[edge.sourceRegionId].push(edge.targetRegionId);
    if (!graph[edge.targetRegionId].includes(edge.sourceRegionId)) graph[edge.targetRegionId].push(edge.sourceRegionId);
  }
  return graph;
}

/**
 * Adapts a Propagation Studio run to the same conceptual input used by
 * plot-evalution: one spatial layout + one 0..100 signal series per region.
 * Frame 0 is intentionally omitted, matching the evaluation prototype,
 * whose visual sequence starts at the first simulated transition (t=1).
 */
export function buildTechniqueStimulus(run) {
  if (!run || !Array.isArray(run.regions) || !Array.isArray(run.history) || !run.history.length) return null;
  const regions = run.regions.filter(r => r?.id).map(r => ({ ...r }));
  const allFrames = run.history.map(frameMap);
  const firstTime = allFrames.length > 1 ? 1 : 0;
  const frames = allFrames.slice(firstTime);
  const frameTimes = frames.map((_, i) => i + firstTime);
  const series = {};
  for (const region of regions) {
    series[region.id] = frames.map(frame => {
      const r = frame.get(region.id) || region;
      const population = Math.max(1, Number(r.population ?? region.population) || 1);
      return Math.round(clampPct((Number(r.infected) || 0) / population * 100));
    });
  }
  const scenario = run.space?.mode === SPATIAL_MODES.GRID ? 'grid' : 'map';
  const neighborGraph = scenario === 'grid' ? gridNeighborGraph(regions, run.grid) : mapNeighborGraph(regions, run);
  return {
    runId: run.id,
    runName: run.name || run.id,
    scenario,
    spatialMode: run.space?.mode || SPATIAL_MODES.GRID,
    grid: run.grid || {},
    regions,
    timeSteps: frames.length,
    frameTimes,
    series,
    neighborGraph,
    signalLabel: 'I / população (%)',
    maxValue: 100
  };
}
