import { buildAdjacencyMap } from './adjacency.js';
import { calculateDirectionalWeight } from '../simulation/directional-weights.js';
import { barrierCoverageMap } from '../simulation/initial-conditions.js';

function adjacencyFor(spaceConfig, regions){
  if((spaceConfig?.mode||'grid')==='grid'){
    const grid=spaceConfig.grid||spaceConfig;return buildAdjacencyMap(grid.rows,grid.columns,grid.neighborhood,grid.borderMode);
  }
  const map=new Map();for(const[id,r]of regions)map.set(id,(r.neighbors||[]).map(n=>typeof n==='string'?{id:n}:n));return map;
}

/** Ordinary spatial transmission graph shared by grid and polygon maps.
 * The denominator is computed before removing blocked targets. Therefore a
 * 100% vaccinated region removes its share of spatial mobility instead of
 * redistributing that share to other neighbors.
 */
export function buildWeightedEdges(spaceConfig,regions,propagation={}){
  const adjacency=adjacencyFor(spaceConfig,regions),direction=propagation.direction?.enabled===false?'radial':(propagation.direction?.direction||'radial'),directionOptions=propagation.direction||{},blocked=barrierCoverageMap(propagation),edges=[],incomingMap=new Map(),outgoingMap=new Map();
  for(const[sourceId,neighbors]of adjacency.entries()){
    const source=regions.get(sourceId);if(!source)continue;const sourceBlocked=(blocked.get(sourceId)??0)>=100||source.vaccinated>=source.population;
    const candidates=[];
    for(const neighbor of neighbors){const targetId=neighbor.id||neighbor,target=regions.get(targetId);if(!target)continue;const raw=Math.max(0,calculateDirectionalWeight(source,target,direction,directionOptions,1)),targetBlocked=(blocked.get(targetId)??0)>=100||target.vaccinated>=target.population;candidates.push({targetId,raw,targetBlocked});}
    const denominator=candidates.reduce((s,c)=>s+c.raw,0)||1,list=[];
    for(const c of candidates){const effectiveWeight=(sourceBlocked||c.targetBlocked)?0:c.raw/denominator;const edge={id:`E_${sourceId}_${c.targetId}`,sourceRegionId:sourceId,targetRegionId:c.targetId,type:'adjacent',baseWeight:1,multiplier:sourceBlocked||c.targetBlocked?0:1,effectiveWeight,normalizedWeight:effectiveWeight,enabled:effectiveWeight>0,blockedByVaccination:sourceBlocked||c.targetBlocked};edges.push(edge);list.push({id:c.targetId,rawWeight:c.raw,weight:effectiveWeight});if(effectiveWeight>0){if(!incomingMap.has(c.targetId))incomingMap.set(c.targetId,[]);incomingMap.get(c.targetId).push({id:sourceId,weight:effectiveWeight,rawWeight:c.raw});}}
    outgoingMap.set(sourceId,list);
  }
  return{edges,outgoingMap,incomingMap};
}
