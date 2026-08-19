import { Mulberry32 } from '../../simulation/random.js';
import { SPATIAL_DEFAULTS, SYNTHETIC_MAP_DEFAULTS } from '../../constants.js';
import { geometryCentroid } from './geometry.js';
import { buildSharedBorderAdjacency, applyAdjacencyToRegions } from './adjacency.js';

function clipHalfPlane(poly,A,B,C){
  const out=[];if(!poly.length)return out;const inside=p=>A*p[0]+B*p[1]<=C+1e-12;
  const intersect=(p,q)=>{const fp=A*p[0]+B*p[1]-C,fq=A*q[0]+B*q[1]-C,t=fp/(fp-fq||1e-30);return[p[0]+(q[0]-p[0])*t,p[1]+(q[1]-p[1])*t];};
  for(let i=0;i<poly.length;i++){const p=poly[i],q=poly[(i+1)%poly.length],pin=inside(p),qin=inside(q);if(pin&&qin)out.push(q);else if(pin&&!qin)out.push(intersect(p,q));else if(!pin&&qin){out.push(intersect(p,q));out.push(q);}}
  return out;
}

function voronoiCell(point,points){
  let poly=[[0,0],[1,0],[1,1],[0,1]];
  for(const other of points){if(other===point)continue;const A=2*(other.x-point.x),B=2*(other.y-point.y),C=other.x*other.x+other.y*other.y-point.x*point.x-point.y*point.y;poly=clipHalfPlane(poly,A,B,C);if(!poly.length)break;}
  if(poly.length&& (poly[0][0]!==poly.at(-1)[0]||poly[0][1]!==poly.at(-1)[1]))poly.push([...poly[0]]);return poly;
}

function seededPoints(count,seed,irregularity=0.8){
  const prng=new Mulberry32(Number(seed)||1),pts=[];const minD=0.48/Math.sqrt(Math.max(2,count));let attempts=0;
  while(pts.length<count&&attempts<count*500){attempts++;const margin=.025;const x=margin+prng.next()*(1-2*margin),y=margin+prng.next()*(1-2*margin);if(pts.every(p=>Math.hypot(p.x-x,p.y-y)>=minD))pts.push({x,y});}
  while(pts.length<count)pts.push({x:prng.next(),y:prng.next()});
  if(irregularity<1){const cols=Math.ceil(Math.sqrt(count)),rows=Math.ceil(count/cols);for(let i=0;i<pts.length;i++){const c=i%cols,r=Math.floor(i/cols),gx=(c+.5)/cols,gy=(r+.5)/rows;pts[i].x=gx+(pts[i].x-gx)*irregularity;pts[i].y=gy+(pts[i].y-gy)*irregularity;}}
  return pts;
}

export function createSyntheticMap(config={}){
  const count=Math.max(SYNTHETIC_MAP_DEFAULTS.MIN_REGIONS,Math.min(SYNTHETIC_MAP_DEFAULTS.MAX_REGIONS,Math.floor(Number(config.regionCount)||SYNTHETIC_MAP_DEFAULTS.REGION_COUNT))),seed=Number(config.spatialSeed)||SYNTHETIC_MAP_DEFAULTS.SPATIAL_SEED,irregularity=Math.max(0,Math.min(1,Number(config.irregularity??SYNTHETIC_MAP_DEFAULTS.IRREGULARITY))),population=Math.max(1,Math.round(Number(config.defaultPopulation)||SPATIAL_DEFAULTS.DEFAULT_POPULATION));
  const points=seededPoints(count,seed,irregularity),regions=new Map();
  points.forEach((p,i)=>{const ring=voronoiCell(p,points),geometry={type:'Polygon',coordinates:[ring]},c=geometryCentroid(geometry),id=`M_${String(i+1).padStart(3,'0')}`;regions.set(id,{id,name:`Região ${i+1}`,population,susceptible:population,infected:0,recovered:0,vaccinated:0,geometry,spatialX:c.x,spatialY:c.y,sourceProperties:{},initialConditionMode:'seeded',localParameters:{betaMultiplier:1,gammaMultiplier:1,vaccinationMultiplier:1,mobilityMultiplier:1,susceptibilityMultiplier:1}});});
  const {adjacency}=buildSharedBorderAdjacency(regions,1e-8);return applyAdjacencyToRegions(regions,adjacency);
}
