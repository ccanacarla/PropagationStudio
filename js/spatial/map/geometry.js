export function geometryPolygons(geometry) {
  if (!geometry) return [];
  if (geometry.type === 'Polygon') return [geometry.coordinates || []];
  if (geometry.type === 'MultiPolygon') return geometry.coordinates || [];
  return [];
}

export function outerRings(geometry) {
  return geometryPolygons(geometry).map(p => p?.[0]).filter(r => Array.isArray(r) && r.length >= 3);
}

export function geometryBBox(geometry) {
  let minX=Infinity,minY=Infinity,maxX=-Infinity,maxY=-Infinity;
  for (const polygon of geometryPolygons(geometry)) {
    for (const ring of polygon || []) for (const p of ring || []) {
      const x=Number(p?.[0]), y=Number(p?.[1]);
      if (!Number.isFinite(x)||!Number.isFinite(y)) continue;
      if(x<minX)minX=x;if(x>maxX)maxX=x;if(y<minY)minY=y;if(y>maxY)maxY=y;
    }
  }
  return Number.isFinite(minX)?{minX,minY,maxX,maxY}:{minX:0,minY:0,maxX:1,maxY:1};
}

export function mergeBBoxes(boxes) {
  if (!boxes?.length) return {minX:0,minY:0,maxX:1,maxY:1};
  return boxes.reduce((a,b)=>({minX:Math.min(a.minX,b.minX),minY:Math.min(a.minY,b.minY),maxX:Math.max(a.maxX,b.maxX),maxY:Math.max(a.maxY,b.maxY)}),{minX:Infinity,minY:Infinity,maxX:-Infinity,maxY:-Infinity});
}

function ringAreaCentroid(ring) {
  if (!ring?.length) return {area:0,x:0,y:0};
  let twiceArea=0,cx=0,cy=0;
  for(let i=0;i<ring.length-1;i++){
    const [x1,y1]=ring[i], [x2,y2]=ring[i+1];
    const cross=x1*y2-x2*y1;twiceArea+=cross;cx+=(x1+x2)*cross;cy+=(y1+y2)*cross;
  }
  if(Math.abs(twiceArea)<1e-12){const pts=ring.slice(0,-1);const n=Math.max(1,pts.length);return{area:0,x:pts.reduce((s,p)=>s+Number(p[0]||0),0)/n,y:pts.reduce((s,p)=>s+Number(p[1]||0),0)/n};}
  return {area:twiceArea/2,x:cx/(3*twiceArea),y:cy/(3*twiceArea)};
}

export function geometryCentroid(geometry) {
  let total=0,cx=0,cy=0;
  for (const poly of geometryPolygons(geometry)) {
    if(!poly?.length)continue;
    const outer=ringAreaCentroid(poly[0]);
    const weight=Math.abs(outer.area)||1; total+=weight;cx+=outer.x*weight;cy+=outer.y*weight;
  }
  if(total>0)return{x:cx/total,y:cy/total};
  const b=geometryBBox(geometry);return{x:(b.minX+b.maxX)/2,y:(b.minY+b.maxY)/2};
}

export function pointInRing(x,y,ring){
  let inside=false;
  for(let i=0,j=ring.length-1;i<ring.length;j=i++){
    const xi=Number(ring[i][0]),yi=Number(ring[i][1]),xj=Number(ring[j][0]),yj=Number(ring[j][1]);
    const hit=((yi>y)!==(yj>y))&&(x<(xj-xi)*(y-yi)/(yj-yi+1e-30)+xi);if(hit)inside=!inside;
  }
  return inside;
}

export function pointInGeometry(x,y,geometry){
  for(const poly of geometryPolygons(geometry)){
    const outer=poly?.[0];if(!outer||!pointInRing(x,y,outer))continue;
    let inHole=false;for(let h=1;h<poly.length;h++)if(pointInRing(x,y,poly[h])){inHole=true;break;}
    if(!inHole)return true;
  }
  return false;
}

export function segmentsFromGeometry(geometry){
  const out=[];
  for(const ring of outerRings(geometry))for(let i=0;i<ring.length-1;i++){
    const a={x:Number(ring[i][0]),y:Number(ring[i][1])},b={x:Number(ring[i+1][0]),y:Number(ring[i+1][1])};
    if(Number.isFinite(a.x)&&Number.isFinite(a.y)&&Number.isFinite(b.x)&&Number.isFinite(b.y)&&Math.hypot(b.x-a.x,b.y-a.y)>0)out.push({a,b});
  }
  return out;
}

export function bboxesOverlap(a,b,tol=0){return a.minX<=b.maxX+tol&&a.maxX+tol>=b.minX&&a.minY<=b.maxY+tol&&a.maxY+tol>=b.minY;}

export function sharedSegmentLength(s1,s2,tol=1e-9){
  const ax=s1.a.x,ay=s1.a.y,bx=s1.b.x,by=s1.b.y,cx=s2.a.x,cy=s2.a.y,dx=s2.b.x,dy=s2.b.y;
  const vx=bx-ax,vy=by-ay,len=Math.hypot(vx,vy);if(len<=tol)return 0;
  const ux=vx/len,uy=vy/len;
  const lineDist=(x,y)=>Math.abs((x-ax)*uy-(y-ay)*ux);
  if(lineDist(cx,cy)>tol||lineDist(dx,dy)>tol)return 0;
  const proj=(x,y)=>(x-ax)*ux+(y-ay)*uy;
  const p1=proj(cx,cy),p2=proj(dx,dy);const lo=Math.max(0,Math.min(p1,p2)),hi=Math.min(len,Math.max(p1,p2));
  return Math.max(0,hi-lo);
}
