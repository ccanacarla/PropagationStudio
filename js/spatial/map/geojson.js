import { SPATIAL_DEFAULTS } from '../../constants.js';
import { geometryBBox, geometryCentroid, geometryPolygons } from './geometry.js';
import { buildSharedBorderAdjacency, buildNearestAdjacency, applyAdjacencyToRegions, adjacencyStats } from './adjacency.js';

const candidate=(keys,patterns)=>keys.find(k=>patterns.some(p=>p.test(k)))||'';
export function validateGeoJSON(data){
  if(!data||data.type!=='FeatureCollection'||!Array.isArray(data.features))throw new Error('O arquivo deve ser uma GeoJSON FeatureCollection.');
  const valid=[],invalid=[];const keys=new Set();
  data.features.forEach((f,i)=>{const ok=f?.type==='Feature'&&['Polygon','MultiPolygon'].includes(f.geometry?.type)&&geometryPolygons(f.geometry).length>0;if(ok){valid.push(f);Object.keys(f.properties||{}).forEach(k=>keys.add(k));}else invalid.push(i+1);});
  if(!valid.length)throw new Error('Nenhuma Feature Polygon ou MultiPolygon válida foi encontrada.');
  return{features:valid,invalidFeatureIndexes:invalid,propertyKeys:[...keys].sort()};
}

export function inferGeoJSONFields(propertyKeys=[]){return{
  idProperty:candidate(propertyKeys,[/^id$/i,/codigo/i,/c[oó]d/i,/geocode/i,/code/i]),
  nameProperty:candidate(propertyKeys,[/^name$/i,/nome/i,/nm_/i,/label/i]),
  populationProperty:candidate(propertyKeys,[/pop/i,/habit/i])
};}

function safeId(value,index,used){let base=String(value??'').trim().replace(/\s+/g,'_').replace(/[^\p{L}\p{N}_-]/gu,'');if(!base)base=`GEO_${String(index+1).padStart(4,'0')}`;let id=base,n=2;while(used.has(id))id=`${base}_${n++}`;used.add(id);return id;}

export function normalizeGeoJSON(data,mapping={},options={}){
  const {features}=validateGeoJSON(data),used=new Set(),regions=new Map(),fallbackPop=Math.max(1,Math.round(Number(options.defaultPopulation)||SPATIAL_DEFAULTS.DEFAULT_POPULATION));
  features.forEach((f,i)=>{const props=f.properties||{},id=safeId(mapping.idProperty?props[mapping.idProperty]:f.id,i,used),name=String(mapping.nameProperty?props[mapping.nameProperty]:(props.name??props.nome??id)),rawPop=mapping.populationProperty?Number(props[mapping.populationProperty]):NaN,population=Number.isFinite(rawPop)&&rawPop>0?Math.round(rawPop):fallbackPop,c=geometryCentroid(f.geometry),bbox=geometryBBox(f.geometry);regions.set(id,{id,name,population,susceptible:population,infected:0,recovered:0,vaccinated:0,geometry:structuredClone(f.geometry),bbox,spatialX:c.x,spatialY:-c.y,displayCentroid:{x:c.x,y:c.y},sourceProperties:structuredClone(props),initialConditionMode:'seeded',localParameters:{betaMultiplier:1,gammaMultiplier:1,vaccinationMultiplier:1,mobilityMultiplier:1,susceptibilityMultiplier:1}});});
  return regions;
}

export function buildGeoJSONTopology(regions,options={}){
  const method=options.method||'shared_border';let result;
  if(method==='nearest')result=buildNearestAdjacency(regions,Math.max(1,Math.min(12,Number(options.nearestK)||4)));else result=buildSharedBorderAdjacency(regions,options.tolerance===''||options.tolerance==null?null:Number(options.tolerance));
  const next=applyAdjacencyToRegions(regions,result.adjacency);return{regions:next,stats:adjacencyStats(next),tolerance:result.tolerance,method};
}

export function geoJSONFromRegions(regions,propertiesById={}){
  return{type:'FeatureCollection',features:[...regions.values()].filter(r=>r.geometry).map(r=>({type:'Feature',properties:{...(r.sourceProperties||{}),region_id:r.id,region_name:r.name,population:r.population,...(propertiesById[r.id]||{})},geometry:structuredClone(r.geometry)}))};
}
