import { NEIGHBORHOOD_TYPES, BORDER_MODES } from '../constants.js';

export function getNeighbors(row, column, rows, columns, neighborhoodType = NEIGHBORHOOD_TYPES.MOORE, borderMode = BORDER_MODES.NORMAL) {
  const offsets = neighborhoodType === NEIGHBORHOOD_TYPES.VON_NEUMANN
    ? [[-1,0],[1,0],[0,-1],[0,1]]
    : [[-1,0],[1,0],[0,-1],[0,1],[-1,-1],[-1,1],[1,-1],[1,1]];
  const result = [];
  const seen = new Set();
  for (const [dr, dc] of offsets) {
    let r = row + dr; let c = column + dc;
    if (borderMode === BORDER_MODES.TOROIDAL) {
      r = ((r - 1 + rows) % rows) + 1;
      c = ((c - 1 + columns) % columns) + 1;
    }
    if (r < 1 || r > rows || c < 1 || c > columns) continue;
    const id = `R_${r}_${c}`;
    if (id !== `R_${row}_${column}` && !seen.has(id)) { seen.add(id); result.push({ row: r, column: c, id }); }
  }
  return result;
}

export function buildAdjacencyMap(rows, columns, neighborhoodType, borderMode) {
  const map = new Map();
  for (let r = 1; r <= rows; r++) for (let c = 1; c <= columns; c++) map.set(`R_${r}_${c}`, getNeighbors(r, c, rows, columns, neighborhoodType, borderMode));
  return map;
}

export function areAdjacent(sourceId, targetId, gridConfig) {
  const source = parseRegionId(sourceId);
  if (!source) return false;
  return getNeighbors(source.row, source.column, gridConfig.rows, gridConfig.columns, gridConfig.neighborhood, gridConfig.borderMode).some(n => n.id === targetId);
}

export function parseRegionId(id) {
  const match = /^R_(\d+)_(\d+)$/.exec(String(id || ''));
  return match ? { row: Number(match[1]), column: Number(match[2]) } : null;
}
