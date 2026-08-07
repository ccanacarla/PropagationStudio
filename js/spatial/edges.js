import { buildAdjacencyMap } from './adjacency.js';
import { calculateDirectionalWeight } from '../simulation/directional-weights.js';

/**
 * Spatial edges represent geographic adjacency and direction only.
 * In schema 4.2, paths and blocks are regional properties:
 * - pathRegions increase the target region susceptibility;
 * - vaccinationBarriers increase the target region vaccinated compartment.
 */
export function buildWeightedEdges(grid, regions, propagation = {}) {
  const adjacency = buildAdjacencyMap(grid.rows, grid.columns, grid.neighborhood, grid.borderMode);
  const direction = propagation.direction?.enabled === false ? 'radial' : (propagation.direction?.direction || 'radial');
  const directionOptions = propagation.direction || {};
  const edges = [];
  const outgoingMap = new Map();
  const incomingMap = new Map();

  for (const [sourceId, neighbors] of adjacency.entries()) {
    const source = regions.get(sourceId);
    if (!source) continue;
    const candidates = [];
    for (const neighbor of neighbors) {
      const target = regions.get(neighbor.id);
      if (!target) continue;
      const baseWeight = 1;
      const effectiveWeight = Math.max(0, calculateDirectionalWeight(source, target, direction, directionOptions, baseWeight));
      candidates.push({ id: neighbor.id, baseWeight, effectiveWeight });
    }
    const total = candidates.reduce((sum, c) => sum + c.effectiveWeight, 0);
    const outgoing = candidates.map(c => ({ id: c.id, rawWeight: c.effectiveWeight, weight: total > 0 ? c.effectiveWeight / total : 0 }));
    outgoingMap.set(sourceId, outgoing);
    for (const c of candidates) {
      edges.push({
        id:`E_${sourceId}_${c.id}`,
        sourceRegionId:sourceId,
        targetRegionId:c.id,
        type:'adjacent',
        baseWeight:c.baseWeight,
        multiplier:1,
        effectiveWeight:c.effectiveWeight,
        normalizedWeight:total > 0 ? c.effectiveWeight / total : 0,
        enabled:c.effectiveWeight>0
      });
    }
  }

  for (const [sourceId, list] of outgoingMap) {
    for (const edge of list) {
      if (edge.weight <= 0) continue;
      if (!incomingMap.has(edge.id)) incomingMap.set(edge.id, []);
      incomingMap.get(edge.id).push({ id: sourceId, weight: edge.weight, rawWeight: edge.rawWeight });
    }
  }
  return { edges, outgoingMap, incomingMap };
}
