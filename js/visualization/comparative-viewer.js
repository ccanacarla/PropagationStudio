import { SPATIAL_MODES } from '../constants.js';
import { geometryBBox, mergeBBoxes, geometryPolygons } from '../spatial/map/geometry.js';
import { buildTechniqueStimulus } from './technique-data.js';
import { projectionOrder } from './technique-ordering.js';

const SVG_NS='http://www.w3.org/2000/svg';
const MIN_COLOR_T=.12;
const BLUES=[[0,247,251,255],[.125,222,235,247],[.25,198,219,239],[.375,158,202,225],[.5,107,174,214],[.625,66,146,198],[.75,33,113,181],[.875,8,81,156],[1,8,48,107]];
const hex=n=>Math.round(n).toString(16).padStart(2,'0');
function blues(t){const v=Math.max(0,Math.min(1,t));for(let i=0;i<BLUES.length-1;i++){const [t0,r0,g0,b0]=BLUES[i],[t1,r1,g1,b1]=BLUES[i+1];if(v>=t0&&v<=t1){const f=(v-t0)/(t1-t0||1);return`#${hex(r0+(r1-r0)*f)}${hex(g0+(g1-g0)*f)}${hex(b0+(b1-b0)*f)}`;}}const [,r,g,b]=BLUES.at(-1);return`#${hex(r)}${hex(g)}${hex(b)}`;}
function valueColor(v){const t=Math.max(0,Math.min(1,(Number(v)||0)/100));return blues(MIN_COLOR_T+(1-MIN_COLOR_T)*t);}
function escapeAttr(s){return String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[c]));}

function createShape(svg, region, stimulus, values, opts={}) {
  const { neutral=false, onClick }=opts;
  let shape;
  if(stimulus.scenario==='grid'){
    shape=document.createElementNS(SVG_NS,'rect');
    shape.setAttribute('x',String((Number(region.column)||1)-1));shape.setAttribute('y',String((Number(region.row)||1)-1));shape.setAttribute('width','1');shape.setAttribute('height','1');
  }else{
    shape=document.createElementNS(SVG_NS,'path');
    const boxes=stimulus._boxes || (stimulus._boxes=[...stimulus.regions].filter(r=>r.geometry).map(r=>geometryBBox(r.geometry)));
    const b=stimulus._bbox || (stimulus._bbox=mergeBBoxes(boxes));
    const bw=Math.max(1e-12,b.maxX-b.minX),bh=Math.max(1e-12,b.maxY-b.minY),flip=stimulus.spatialMode===SPATIAL_MODES.GEOJSON;
    const pp=(x,y)=>{const nx=(Number(x)-b.minX)/bw*100,ny=flip?(b.maxY-Number(y))/bh*100:(Number(y)-b.minY)/bh*100;return[nx,ny];};
    let d='';for(const poly of geometryPolygons(region.geometry))for(const ring of poly||[]){if(!ring?.length)continue;const [x0,y0]=pp(ring[0][0],ring[0][1]);d+=`M${x0},${y0}`;for(let i=1;i<ring.length;i++){const [x,y]=pp(ring[i][0],ring[i][1]);d+=`L${x},${y}`;}d+='Z';}
    shape.setAttribute('d',d);shape.setAttribute('fill-rule','evenodd');
  }
  shape.classList.add('tech-region-shape');shape.dataset.regionId=region.id;shape.setAttribute('fill',neutral?'none':valueColor(values?.[region.id]||0));
  if(onClick){shape.classList.add('clickable');shape.addEventListener('click',()=>onClick(region.id));}
  const title=document.createElementNS(SVG_NS,'title');title.textContent=region.name||region.id;shape.appendChild(title);svg.appendChild(shape);return shape;
}

function renderRegionMap(container, stimulus, values={}, opts={}){
  container.innerHTML='';const svg=document.createElementNS(SVG_NS,'svg');
  if(stimulus.scenario==='grid'){svg.setAttribute('viewBox',`0 0 ${Math.max(1,Number(stimulus.grid.columns)||1)} ${Math.max(1,Number(stimulus.grid.rows)||1)}`);}else svg.setAttribute('viewBox','0 0 100 100');
  svg.setAttribute('preserveAspectRatio','xMidYMid meet');svg.classList.add('tech-region-map-svg');
  for(const r of stimulus.regions)createShape(svg,r,stimulus,values,opts);container.appendChild(svg);return svg;
}
function updateMapColors(container,values){container.querySelectorAll('.tech-region-shape').forEach(el=>{const id=el.dataset.regionId;el.setAttribute('fill',valueColor(values[id]||0));});}
function neutralMap(container){container.querySelectorAll('.tech-region-shape').forEach(el=>el.setAttribute('fill','none'));}
function valuesAt(stimulus,index){const out={};for(const r of stimulus.regions)out[r.id]=stimulus.series[r.id]?.[index]||0;return out;}
function regionPoint(r){return [Number(r.displayCentroid?.x??r.spatialX??r.column??0)||0,Number(r.displayCentroid?.y??r.spatialY??r.row??0)||0];}
function adjacentDistances(order,regions){const byId=new Map(regions.map(r=>[r.id,r]));const ds=[];for(let i=0;i<order.length;i++){if(i===0){ds.push(0);continue;}const a=regionPoint(byId.get(order[i-1])||{}),b=regionPoint(byId.get(order[i])||{});ds.push(Math.hypot(a[0]-b[0],a[1]-b[1]));}return ds;}

export class ComparativeViewer{
  constructor(container,state,actions={}){this.container=container;this.state=state;this.actions=actions;this.mode='scenario';this.runId=null;this.stimulus=null;this.animationMap=null;this.smallMultipleSize=170;}
  setMode(mode){this.mode=mode;this.render(true);}
  invalidate(){this.runId=null;this.stimulus=null;}
  getStimulus(){const run=this.state.currentRun?.();if(!run)return null;if(this.runId!==run.id||!this.stimulus){this.runId=run.id;this.stimulus=buildTechniqueStimulus(run);}return this.stimulus;}
  render(force=false){if(this.mode==='scenario')return;const stimulus=this.getStimulus();if(!stimulus){this.container.innerHTML='<div class="technique-empty">Execute ou selecione uma execução para usar esta visualização.</div>';return;}if(force||this.container.dataset.mode!==this.mode||this.container.dataset.runId!==stimulus.runId){this.container.dataset.mode=this.mode;this.container.dataset.runId=stimulus.runId;if(this.mode==='animation')this.renderAnimation(stimulus);if(this.mode==='small_multiples')this.renderSmallMultiples(stimulus);if(this.mode==='projection1d')this.renderProjection(stimulus);}else if(this.mode==='animation')this.updateAnimation(stimulus);}
  renderHeader(title,detail='',controls=''){return`<div class="technique-heading"><div><div class="technique-title-line"><strong>${escapeAttr(title)}</strong>${controls}</div>${detail?`<span>${escapeAttr(detail)}</span>`:''}</div></div>`;}
  stepIndex(stimulus){const t=Number(this.state.currentTimeStep)||0;let idx=stimulus.frameTimes.indexOf(t);if(idx<0)idx=0;return Math.max(0,Math.min(stimulus.timeSteps-1,idx));}
  renderAnimation(stimulus){
    this.container.innerHTML=`${this.renderHeader('Animação','Explore a propagação passo a passo.')}<div class="pe-animation-viz"><div class="pe-animation-map"></div><div class="pe-animation-controls" aria-label="Controles da animação"><button type="button" class="btn ghost" data-tech-action="first" title="Primeiro instante">|◀</button><button type="button" class="btn ghost" data-tech-action="back" title="Instante anterior">◀</button><button type="button" class="btn ghost primary-tech" data-tech-action="play" title="Reproduzir ou pausar">▶</button><button type="button" class="btn ghost" data-tech-action="forward" title="Próximo instante">▶</button><button type="button" class="btn ghost" data-tech-action="last" title="Último instante">▶|</button><input type="range" min="0" max="${Math.max(0,stimulus.timeSteps-1)}" value="0" class="pe-animation-scrubber" aria-label="Instante da animação"><span class="pe-animation-step">t = ${stimulus.frameTimes[0]??0}</span></div></div>`;
    this.animationMap=this.container.querySelector('.pe-animation-map');
    renderRegionMap(this.animationMap,stimulus,valuesAt(stimulus,this.stepIndex(stimulus)),{onClick:id=>this.actions.onRegionClick?.(id)});
    const go=index=>{const i=Math.max(0,Math.min(stimulus.timeSteps-1,index));this.actions.onTimeChange?.(stimulus.frameTimes[i]??0);};
    this.container.querySelector('[data-tech-action="first"]').addEventListener('click',()=>go(0));
    this.container.querySelector('[data-tech-action="back"]').addEventListener('click',()=>go(this.stepIndex(stimulus)-1));
    this.container.querySelector('[data-tech-action="play"]').addEventListener('click',()=>this.actions.onPlayPause?.());
    this.container.querySelector('[data-tech-action="forward"]').addEventListener('click',()=>go(this.stepIndex(stimulus)+1));
    this.container.querySelector('[data-tech-action="last"]').addEventListener('click',()=>go(stimulus.timeSteps-1));
    this.container.querySelector('.pe-animation-scrubber').addEventListener('input',e=>go(Number(e.target.value)));
    this.updateAnimation(stimulus);
  }
  updateAnimation(stimulus){
    if(!this.animationMap||!this.container.isConnected)return;
    const i=this.stepIndex(stimulus);updateMapColors(this.animationMap,valuesAt(stimulus,i));
    const slider=this.container.querySelector('.pe-animation-scrubber'),label=this.container.querySelector('.pe-animation-step'),play=this.container.querySelector('[data-tech-action="play"]'),first=this.container.querySelector('[data-tech-action="first"]'),back=this.container.querySelector('[data-tech-action="back"]'),forward=this.container.querySelector('[data-tech-action="forward"]'),last=this.container.querySelector('[data-tech-action="last"]');
    if(slider)slider.value=String(i);if(label)label.textContent=`t = ${stimulus.frameTimes[i]??i}`;if(play)play.textContent=this.state.isPlaying?'❚❚':'▶';
    const atStart=i<=0,atEnd=i>=stimulus.timeSteps-1;if(first)first.disabled=atStart;if(back)back.disabled=atStart;if(forward)forward.disabled=atEnd;if(last)last.disabled=atEnd;
  }
  renderSmallMultiples(stimulus){
    const sizeControls=`<label class="small-multiple-size" title="Ajustar o tamanho dos quadros"><span>Tamanho</span><input type="range" min="90" max="320" step="10" value="${this.smallMultipleSize}" data-small-size-slider aria-label="Tamanho dos quadros do Small multiples"><output data-small-size-output>${this.smallMultipleSize}px</output></label>`;
    const panels=stimulus.frameTimes.map((t,i)=>`<div class="pe-small-panel"><div class="pe-small-map" data-index="${i}"></div><span>t = ${t}</span></div>`).join('');
    this.container.innerHTML=`${this.renderHeader('Small multiples',`${stimulus.timeSteps} instantes · todos exibidos`,sizeControls)}<div class="pe-small-grid" style="--small-card-size:${this.smallMultipleSize}px">${panels}</div>`;
    const slider=this.container.querySelector('[data-small-size-slider]'),output=this.container.querySelector('[data-small-size-output]'),grid=this.container.querySelector('.pe-small-grid');
    slider?.addEventListener('input',()=>{this.smallMultipleSize=Math.max(90,Math.min(320,Number(slider.value)||170));grid?.style.setProperty('--small-card-size',`${this.smallMultipleSize}px`);if(output)output.textContent=`${this.smallMultipleSize}px`;});
    requestAnimationFrame(()=>{stimulus.frameTimes.forEach((t,i)=>{const el=this.container.querySelector(`.pe-small-map[data-index="${i}"]`);if(el)renderRegionMap(el,stimulus,valuesAt(stimulus,i),{onClick:id=>this.actions.onRegionClick?.(id,t)});});});
  }
  renderProjection(stimulus){
    const order=projectionOrder(stimulus),dist=adjacentDistances(order,stimulus.regions),maxDist=Math.max(...dist,1e-9);
    this.container.innerHTML=`${this.renderHeader('Projeção 1D + mapa',stimulus.scenario==='grid'?'Ordenação Gilbert/Hilbert':'Ordenação espacial AHC Ward')}<div class="pe-projection"><div class="pe-projection-axis">Tempo ↓ · Espaço (ordenado por proximidade) →</div><p class="pe-projection-readout">Passe o mouse ou toque em uma célula. Clique para fixar a seleção.</p><div class="pe-projection-row"><div class="pe-time-axis"></div><div class="pe-projection-scroll"><div class="pe-distance-bar"></div><div class="pe-matrix"></div></div></div><p class="pe-distance-caption">Distância entre regiões consecutivas na matriz — mais escuro = mais distantes no espaço real.</p><p class="pe-fragmentation-hint">A matriz pode fragmentar vizinhos reais por causa da ordenação 1D. O mini-mapa abaixo mostra a posição espacial original.</p><div class="pe-projection-minimap"></div></div>`;
    const matrix=this.container.querySelector('.pe-matrix'),grid=document.createElement('div');grid.className='pe-matrix-grid';grid.style.gridTemplateColumns=`repeat(${order.length}, minmax(3px,1fr))`;grid.style.gridTemplateRows=`repeat(${stimulus.timeSteps}, minmax(3px,1fr))`;for(let ti=0;ti<stimulus.timeSteps;ti++)for(const id of order){const cell=document.createElement('div');cell.className='pe-matrix-cell';cell.dataset.regionId=id;cell.dataset.timeIndex=String(ti);cell.style.background=valueColor(stimulus.series[id]?.[ti]||0);grid.appendChild(cell);}matrix.appendChild(grid);
    const dbar=this.container.querySelector('.pe-distance-bar'),dgrid=document.createElement('div');dgrid.className='pe-distance-grid';dgrid.style.gridTemplateColumns=`repeat(${order.length}, minmax(3px,1fr))`;for(const d of dist){const c=document.createElement('span');c.style.background=`rgba(15,23,42,${.08+.82*(d/maxDist)})`;dgrid.appendChild(c);}dbar.appendChild(dgrid);
    const axis=this.container.querySelector('.pe-time-axis');const ticks=new Set([0,stimulus.timeSteps-1]);for(let i=4;i<stimulus.timeSteps;i+=5)ticks.add(i);for(const i of [...ticks].sort((a,b)=>a-b)){const el=document.createElement('span');el.style.top=`${((i+.5)/Math.max(1,stimulus.timeSteps))*100}%`;el.textContent=String(stimulus.frameTimes[i]??i);axis.appendChild(el);}
    const minimap=this.container.querySelector('.pe-projection-minimap');renderRegionMap(minimap,stimulus,{}, {neutral:true,onClick:id=>this.actions.onRegionClick?.(id)});
    const readout=this.container.querySelector('.pe-projection-readout'),labelById=new Map(stimulus.regions.map(r=>[r.id,r.name||r.id]));let selectedCell=null;
    const clearVisual=()=>{grid.querySelectorAll('.linked-hover,.neighbor-hover,.selected-cell').forEach(e=>e.classList.remove('linked-hover','neighbor-hover','selected-cell'));minimap.querySelectorAll('.linked-hover,.neighbor-hover').forEach(e=>e.classList.remove('linked-hover','neighbor-hover'));neutralMap(minimap);readout.textContent='Passe o mouse ou toque em uma célula. Clique para fixar a seleção.';};
    const highlight=(cell,persistent=false)=>{clearVisual();const id=cell.dataset.regionId,ti=Number(cell.dataset.timeIndex),neighbors=stimulus.neighborGraph[id]||[];grid.querySelectorAll(`[data-region-id="${CSS.escape(id)}"]`).forEach(e=>e.classList.add('linked-hover'));for(const n of neighbors)grid.querySelectorAll(`[data-region-id="${CSS.escape(n)}"]`).forEach(e=>e.classList.add('neighbor-hover'));if(persistent)cell.classList.add('selected-cell');const mapShape=minimap.querySelector(`[data-region-id="${CSS.escape(id)}"]`);if(mapShape){mapShape.classList.add('linked-hover');mapShape.setAttribute('fill',valueColor(stimulus.series[id]?.[ti]||0));}for(const n of neighbors)minimap.querySelector(`[data-region-id="${CSS.escape(n)}"]`)?.classList.add('neighbor-hover');readout.textContent=`t = ${stimulus.frameTimes[ti]??ti} · ${labelById.get(id)||id} = ${stimulus.series[id]?.[ti]||0}% infectados${persistent?' · seleção fixada':''}`;};
    grid.addEventListener('pointerover',e=>{const cell=e.target.closest('.pe-matrix-cell');if(cell)highlight(cell,false);});
    grid.addEventListener('pointerleave',()=>{if(selectedCell)highlight(selectedCell,true);else clearVisual();});
    grid.addEventListener('click',e=>{const cell=e.target.closest('.pe-matrix-cell');if(cell){selectedCell=cell;highlight(cell,true);const ti=Number(cell.dataset.timeIndex);this.actions.onRegionClick?.(cell.dataset.regionId,stimulus.frameTimes[ti]??ti);}});
  }
  legendHtml(){return'';}
}
