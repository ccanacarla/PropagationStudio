import { geometryBBox, mergeBBoxes, segmentsFromGeometry, bboxesOverlap, sharedSegmentLength } from './geometry.js';

export function buildSharedBorderAdjacency(regions, tolerance=null){
  const items=[...regions.values()];
  const bounds=mergeBBoxes(items.map(r=>geometryBBox(r.geometry)));
  const diag=Math.hypot(bounds.maxX-bounds.minX,bounds.maxY-bounds.minY)||1;
  const tol=tolerance==null?diag*1e-7:Math.max(0,Number(tolerance));
  const minShared=Math.max(tol*5,diag*1e-10);
  const cache=new Map(items.map(r=>[r.id,{bbox:geometryBBox(r.geometry),segments:segmentsFromGeometry(r.geometry)}]));
  const adj=new Map(items.map(r=>[r.id,new Set()]));
  for(let i=0;i<items.length;i++)for(let j=i+1;j<items.length;j++){
    const a=items[i],b=items[j],ca=cache.get(a.id),cb=cache.get(b.id);if(!bboxesOverlap(ca.bbox,cb.bbox,tol))continue;
    let shared=0,hit=false;
    for(const sa of ca.segments){
      const sab={minX:Math.min(sa.a.x,sa.b.x),minY:Math.min(sa.a.y,sa.b.y),maxX:Math.max(sa.a.x,sa.b.x),maxY:Math.max(sa.a.y,sa.b.y)};
      for(const sb of cb.segments){
        const sbb={minX:Math.min(sb.a.x,sb.b.x),minY:Math.min(sb.a.y,sb.b.y),maxX:Math.max(sb.a.x,sb.b.x),maxY:Math.max(sb.a.y,sb.b.y)};
        if(!bboxesOverlap(sab,sbb,tol))continue;shared+=sharedSegmentLength(sa,sb,tol);if(shared>minShared){hit=true;break;}
      }
      if(hit)break;
    }
    if(hit){adj.get(a.id).add(b.id);adj.get(b.id).add(a.id);}
  }
  return {adjacency:adj,tolerance:tol};
}

export function buildNearestAdjacency(regions,k=4){
  const items=[...regions.values()];const n=Math.max(1,Math.min(items.length-1,Math.floor(Number(k)||4)));const adj=new Map(items.map(r=>[r.id,new Set()]));
  for(const a of items){const nearest=items.filter(b=>b.id!==a.id).map(b=>({id:b.id,d:Math.hypot((b.spatialX??0)-(a.spatialX??0),(b.spatialY??0)-(a.spatialY??0))})).sort((x,y)=>x.d-y.d).slice(0,n);for(const b of nearest){adj.get(a.id).add(b.id);adj.get(b.id).add(a.id);}}
  return {adjacency:adj,tolerance:null};
}

export function applyAdjacencyToRegions(regions,adjacency){
  const next=new Map();for(const[id,r]of regions)next.set(id,{...r,neighbors:[...(adjacency.get(id)||[]) ]});return next;
}

export function adjacencyStats(regions){const degrees=[...regions.values()].map(r=>(r.neighbors||[]).length);return{regions:degrees.length,isolated:degrees.filter(d=>d===0).length,minDegree:degrees.length?Math.min(...degrees):0,maxDegree:degrees.length?Math.max(...degrees):0,meanDegree:degrees.length?degrees.reduce((a,b)=>a+b,0)/degrees.length:0};}
