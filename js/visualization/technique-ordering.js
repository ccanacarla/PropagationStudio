const sgn = x => (x > 0 ? 1 : x < 0 ? -1 : 0);

function gilbertGenerate(x, y, ax, ay, bx, by, out) {
  const w = Math.abs(ax + ay), h = Math.abs(bx + by);
  const dax = sgn(ax), day = sgn(ay), dbx = sgn(bx), dby = sgn(by);
  if (h === 1) { for (let i = 0; i < w; i++) { out.push([x, y]); x += dax; y += day; } return; }
  if (w === 1) { for (let i = 0; i < h; i++) { out.push([x, y]); x += dbx; y += dby; } return; }
  let ax2 = Math.floor(ax / 2), ay2 = Math.floor(ay / 2), bx2 = Math.floor(bx / 2), by2 = Math.floor(by / 2);
  const w2 = Math.abs(ax2 + ay2), h2 = Math.abs(bx2 + by2);
  if (2 * w > 3 * h) {
    if (w2 % 2 && w > 2) { ax2 += dax; ay2 += day; }
    gilbertGenerate(x, y, ax2, ay2, bx, by, out);
    gilbertGenerate(x + ax2, y + ay2, ax - ax2, ay - ay2, bx, by, out);
  } else {
    if (h2 % 2 && h > 2) { bx2 += dbx; by2 += dby; }
    gilbertGenerate(x, y, bx2, by2, ax2, ay2, out);
    gilbertGenerate(x + bx2, y + by2, ax, ay, bx - bx2, by - by2, out);
    gilbertGenerate(x + (ax - dax) + (bx2 - dbx), y + (ay - day) + (by2 - dby), -bx2, -by2, -(ax - ax2), -(ay - ay2), out);
  }
}

export function hilbertOrder(regions, grid = {}) {
  const rows = Math.max(1, Number(grid.rows) || Math.max(...regions.map(r => Number(r.row) || 1)));
  const cols = Math.max(1, Number(grid.columns) || Math.max(...regions.map(r => Number(r.column) || 1)));
  const byCell = new Map(regions.map(r => [`${Number(r.column) - 1},${Number(r.row) - 1}`, r.id]));
  const coords = [];
  // Generalized Gilbert/Hilbert order works for rectangular Studio grids too.
  if (cols >= rows) gilbertGenerate(0, 0, cols, 0, 0, rows, coords);
  else gilbertGenerate(0, 0, 0, rows, cols, 0, coords);
  const ordered = coords.map(([x, y]) => byCell.get(`${x},${y}`)).filter(Boolean);
  return ordered.length === regions.length ? ordered : regions.map(r => r.id);
}

function pointOf(region) {
  const dc = region.displayCentroid;
  const x = Number(dc?.x ?? region.spatialX ?? region.column ?? 0);
  const y = Number(dc?.y ?? region.spatialY ?? region.row ?? 0);
  return [Number.isFinite(x) ? x : 0, Number.isFinite(y) ? y : 0];
}

function centroid(points) {
  const n = Math.max(1, points.length);
  return [points.reduce((s,p)=>s+p[0],0)/n, points.reduce((s,p)=>s+p[1],0)/n];
}

function wardCost(a,b) {
  const [ax,ay]=centroid(a.points), [bx,by]=centroid(b.points);
  return ((a.points.length*b.points.length)/(a.points.length+b.points.length))*((ax-bx)**2+(ay-by)**2);
}

function greedySpatialOrder(regions) {
  if (!regions.length) return [];
  const remaining = new Map(regions.map(r => [r.id, pointOf(r)]));
  const start = [...remaining].sort((a,b)=>a[1][0]-b[1][0] || a[1][1]-b[1][1])[0];
  const out=[start[0]]; let current=start[1]; remaining.delete(start[0]);
  while (remaining.size) {
    let bestId=null,bestPoint=null,best=Infinity;
    for (const [id,p] of remaining) { const d=(p[0]-current[0])**2+(p[1]-current[1])**2; if(d<best){best=d;bestId=id;bestPoint=p;} }
    out.push(bestId); remaining.delete(bestId); current=bestPoint;
  }
  return out;
}

export function ahcWardOrder(regions) {
  // Exact reference algorithm for the study-sized maps. Large imported maps
  // use a bounded nearest-neighbour fallback so the browser does not lock up.
  if (regions.length > 180) return greedySpatialOrder(regions);
  let clusters = regions.map(r => ({ ids:[r.id], points:[pointOf(r)] }));
  while (clusters.length > 1) {
    let bi=0,bj=1,bc=Infinity;
    for(let i=0;i<clusters.length;i++) for(let j=i+1;j<clusters.length;j++) {
      const c=wardCost(clusters[i],clusters[j]); if(c<bc){bc=c;bi=i;bj=j;}
    }
    const merged={ids:[...clusters[bi].ids,...clusters[bj].ids],points:[...clusters[bi].points,...clusters[bj].points]};
    clusters=clusters.filter((_,i)=>i!==bi&&i!==bj); clusters.push(merged);
  }
  return clusters[0]?.ids || [];
}

export function projectionOrder(stimulus) {
  return stimulus?.scenario === 'grid' ? hilbertOrder(stimulus.regions, stimulus.grid) : ahcWardOrder(stimulus?.regions || []);
}
