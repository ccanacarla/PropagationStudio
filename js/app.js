import { state, defaultPropagation } from './state.js';
import { INTERACTION_MODES, DIRECTION_OPTIONS } from './constants.js';
import { areAdjacent } from './spatial/adjacency.js';
import { runSIRVSimulation } from './simulation/sirv.js';
import { buildInitialRegions } from './simulation/initial-conditions.js';
import { analyzeRun } from './analytics/summary.js';
import { GridRenderer } from './visualization/grid-renderer.js';
import { SimulationCharts } from './visualization/charts.js';
import { AnimationController } from './visualization/animation.js';
import { downloadText, projectJSON, runJSON, temporalCSV, eventsCSV, edgesCSV, regionsCSV, deserializeRun } from './export/files.js';

const $=s=>document.querySelector(s); const $$=s=>[...document.querySelectorAll(s)];
const num=(id,fallback=0)=>{const v=Number($(id).value);return Number.isFinite(v)?v:fallback;};
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[c]));
const clone=x=>structuredClone(x);
const MODE_INFO={
  select:['Selecionar','Clique em uma região para inspecionar.'],
  add_origin:['Adicionar origem','Clique em uma região. Você pode adicionar várias origens.'],
  add_focus:['Adicionar foco','Clique em qualquer região para programar um foco independente.'],
  add_jump:['Adicionar salto','Selecione a região de origem do salto e depois uma região não adjacente.'],
  add_barrier:['Bloqueio vacinal','Clique em regiões para aumentar sua vacinação inicial. Com 100%, a região fica sem suscetíveis.'],
  add_preferred:['Caminho suscetível','Clique em uma sequência de regiões adjacentes. As regiões marcadas ficam mais suscetíveis à infecção.'],
  erase:['Apagar','Clique em uma região para remover eventos e conexões associados a ela.']
};

const migratePropagation=(input={})=>{
  const base=defaultPropagation();
  const next={...base,...input,direction:{...base.direction,...(input.direction||{})},pathSettings:{...base.pathSettings,...(input.pathSettings||{})},barrierSettings:{...base.barrierSettings,...(input.barrierSettings||{})}};
  next.origins=Array.isArray(input.origins)?input.origins:[];
  next.focuses=Array.isArray(input.focuses)?input.focuses:[];
  next.jumps=Array.isArray(input.jumps)?input.jumps:[];
  next.vaccinationBarriers=Array.isArray(input.vaccinationBarriers)?input.vaccinationBarriers:[];
  next.pathRegions=Array.isArray(input.pathRegions)?input.pathRegions:[];
  if(!next.vaccinationBarriers.length&&Array.isArray(input.barriers)){
    const seen=new Set();
    for(const b of input.barriers){for(const regionId of [b.sourceRegionId,b.targetRegionId]){if(!regionId||seen.has(regionId))continue;seen.add(regionId);const blocked=1-Math.max(0,Math.min(1,Number(b.multiplier??0)));next.vaccinationBarriers.push({id:`migrated-barrier-${regionId}`,regionId,vaccinationCoverage:Math.round(blocked*100),enabled:b.enabled!==false});}}
  }
  if(!next.pathRegions.length&&Array.isArray(input.preferredPaths)){
    const map=new Map();
    for(const p of input.preferredPaths){for(const regionId of [p.sourceRegionId,p.targetRegionId]){if(!regionId)continue;const mult=Math.max(1,Number(p.multiplier??2));map.set(regionId,Math.max(map.get(regionId)||1,mult));}}
    next.pathRegions=[...map].map(([regionId,susceptibilityMultiplier],i)=>({id:`migrated-path-${i+1}`,regionId,susceptibilityMultiplier,enabled:true}));
  }
  delete next.barriers;delete next.preferredPaths;
  return next;
};

class App{
  constructor(){
    this.renderer=new GridRenderer($('#grid-canvas'),state,id=>this.handleGridClick(id),id=>this.handleHover(id));
    this.charts=new SimulationCharts($('#global-chart'),$('#region-chart'));
    this.animation=new AnimationController(state);
    this.populateDirections(); this.bind(); this.syncControls(); this.renderAll();
    state.subscribe((type,data)=>this.onState(type,data));
  }
  populateDirections(){const sel=$('#direction-key');sel.innerHTML=DIRECTION_OPTIONS.map(([v,l])=>`<option value="${v}">${l}</option>`).join('');}
  bind(){
    $('#project-name').addEventListener('change',e=>{state.project.name=e.target.value.trim()||'Novo cenário';state.touch('PROJECT_NAME');});
    $('#btn-new-project').addEventListener('click',()=>{if(confirm('Criar um novo projeto? O projeto atual deve ser salvo antes se você quiser mantê-lo.')){this.animation.pause();state.newProject();this.syncControls();this.renderAll();this.toast('success','Novo projeto','Um cenário vazio foi criado.');}});
    $('#btn-save-project').addEventListener('click',()=>downloadText(`${this.safeName(state.project.name)}.json`,projectJSON(state,true),'application/json;charset=utf-8'));
    $('#btn-import-project').addEventListener('click',()=>$('#project-file').click());
    $('#project-file').addEventListener('change',e=>this.importProject(e.target.files?.[0]));
    $$('.property-tab').forEach(b=>b.addEventListener('click',()=>state.setPanel(b.dataset.panel)));
    $$('.tool').forEach(b=>b.addEventListener('click',()=>state.setMode(b.dataset.mode)));
    $('#btn-cancel-mode').addEventListener('click',()=>state.setMode(INTERACTION_MODES.SELECT));
    $$('.comp-tab').forEach(b=>b.addEventListener('click',()=>state.setCompartment(b.dataset.comp)));
    $('#btn-zoom-in').addEventListener('click',()=>this.setZoom(this.renderer.setZoom(this.renderer.zoom+.2)));
    $('#btn-zoom-out').addEventListener('click',()=>this.setZoom(this.renderer.setZoom(this.renderer.zoom-.2)));
    $('#btn-fit-grid').addEventListener('click',()=>this.setZoom(this.renderer.fit()));
    $('#btn-toggle-bottom').addEventListener('click',()=>{const p=$('#bottom-panel');p.classList.toggle('collapsed');$('#btn-toggle-bottom').textContent=p.classList.contains('collapsed')?'Expandir':'Recolher';setTimeout(()=>this.renderer.resize(),0);});
    $$('.bottom-tab').forEach(b=>b.addEventListener('click',()=>{$$('.bottom-tab').forEach(x=>x.classList.toggle('active',x===b));$$('.bottom-content').forEach(x=>x.classList.toggle('active',x.dataset.bottomContent===b.dataset.bottom));setTimeout(()=>this.charts.draw(),0);}));
    $('#btn-reset').addEventListener('click',()=>this.animation.reset());$('#btn-step-back').addEventListener('click',()=>this.animation.step(-1));$('#btn-play-pause').addEventListener('click',()=>this.animation.toggle());$('#btn-step-forward').addEventListener('click',()=>this.animation.step(1));
    $('#time-slider').addEventListener('input',e=>{this.animation.pause();state.setTimeStep(Number(e.target.value));});
    $('#playback-speed').addEventListener('input',e=>{state.playbackSpeed=Number(e.target.value)||180;});
    $('#grid-random-pop').addEventListener('change',()=>this.togglePopulationFields());
    $('#btn-apply-grid').addEventListener('click',()=>this.applyGrid());
    this.bindSimulationInputs(); this.bindDirectionInputs();
    $('#path-susceptibility-default').addEventListener('change',e=>state.updatePropagationSettings('path',{susceptibilityMultiplier:Math.max(1,Number(e.target.value)||1)}));
    $('#barrier-vaccination-default').addEventListener('change',e=>state.updatePropagationSettings('barrier',{vaccinationCoverage:Math.max(0,Math.min(100,Number(e.target.value)||0))}));
    $('#btn-save-region').addEventListener('click',()=>this.saveRegion());
    $('#scenario-lists').addEventListener('change',e=>this.editScenarioItem(e));
    $('#scenario-lists').addEventListener('click',e=>{const b=e.target.closest('[data-remove-kind]');if(b)state.removeEvent(b.dataset.removeKind,b.dataset.removeId);});
    $('#btn-random-seed').addEventListener('click',()=>{state.updateSimulation({seed:Math.floor(Math.random()*2147483646)+1});this.syncSimulationControls();});
    $('#btn-simulate').addEventListener('click',()=>this.simulate());$('#btn-simulate-main').addEventListener('click',()=>this.simulate());$('#btn-simulate-timeline').addEventListener('click',()=>this.simulate());
    $('#runs-list').addEventListener('click',e=>{const card=e.target.closest('[data-run-id]');if(card)state.selectRun(card.dataset.runId);});
    $('#run-notes').addEventListener('change',e=>{const run=state.currentRun();if(run)state.updateRun(run.id,{notes:e.target.value});});
    $('#btn-approve-run').addEventListener('click',()=>this.setRunStatus('approved'));$('#btn-reject-run').addEventListener('click',()=>this.setRunStatus('rejected'));
    $$('[data-export]').forEach(b=>b.addEventListener('click',()=>this.exportRun(b.dataset.export)));
    $('#analysis-threshold').addEventListener('change',()=>this.refreshAnalysis());$('#analysis-reference').addEventListener('change',()=>this.refreshAnalysis());
  }
  bindSimulationInputs(){const map={
    '#sim-beta':'beta','#sim-gamma':'gamma','#sim-nu':'nu','#sim-mobility':'mobility','#sim-local-weight':'localTransmissionWeight','#sim-spatial-weight':'spatialTransmissionWeight','#sim-noise':'parameterNoise','#sim-steps':'timeSteps','#sim-unit':'temporalUnit','#sim-seed':'seed','#sim-initial-vaccination':'initialVaccinationPct','#sim-vaccination-variation':'initialVaccinationVariationPct'
  };for(const [sel,key] of Object.entries(map))$(sel).addEventListener('change',e=>state.updateSimulation({[key]:key==='temporalUnit'?e.target.value:(Number(e.target.value)||0)}));}
  bindDirectionInputs(){const map={'#direction-key':'direction','#direction-profile':'directionProfile','#direction-cone':'coneAngle','#direction-strength':'directionStrength','#direction-forward':'forwardWeight','#direction-lateral':'lateralLeak','#direction-backward':'backwardLeak','#direction-diagonal':'diagonalPenalty'};$('#direction-enabled').addEventListener('change',e=>state.updateDirection({enabled:e.target.checked}));for(const[sel,key]of Object.entries(map))$(sel).addEventListener('change',e=>state.updateDirection({[key]:key==='direction'||key==='directionProfile'?e.target.value:Number(e.target.value)}));}
  onState(type,data){
    if(type==='NOTIFICATION'){this.toast(data.level,data.title,data.message);return;}
    if(type==='PROJECT_RESET'){this.syncControls();}
    if(type==='PANEL_CHANGE')this.renderPanels();
    if(type==='MODE_CHANGE')this.renderMode();
    if(type==='SELECTION_CHANGE'){this.renderRegion();this.charts.update(state);}
    if(['GRID_REBUILT','GRID_CHANGE'].includes(type)){this.syncGridControls();this.populateRegionReference();}
    if(['SIM_CONFIG_CHANGE','INITIAL_CONDITIONS_CHANGE'].includes(type)){this.syncSimulationControls();this.renderRegion();this.renderSeedSummary();this.renderer.render();}
    if(['PROPAGATION_CHANGE','GRID_REBUILT'].includes(type)){this.renderScenario();this.renderRegion();this.renderSeedSummary();this.renderer.render();}
    if(['RUN_ADDED','RUN_SELECTED','RUN_UPDATED','RUN_REMOVED'].includes(type)){this.renderRuns();this.renderAnalysis();this.renderTimeline();this.renderEvents();this.charts.update(state);this.renderer.render();}
    if(['TIME_CHANGE','PLAYBACK'].includes(type)){this.renderTimeline();this.renderer.render();}
    if(type==='VIEW_CHANGE'){this.renderCompartments();this.renderer.render();}
    this.renderDirty();
  }
  syncControls(){this.syncGridControls();this.syncSimulationControls();this.syncDirectionControls();this.syncPropagationSettings();this.populateRegionReference();$('#project-name').value=state.project.name;this.togglePopulationFields();this.renderSeedSummary();}
  syncGridControls(){const g=state.grid;$('#grid-rows').value=g.rows;$('#grid-cols').value=g.columns;$('#grid-neighborhood').value=g.neighborhood;$('#grid-border').value=g.borderMode;$('#grid-random-pop').checked=!!g.randomizePopulation;$('#grid-pop').value=g.defaultPopulation;$('#grid-min-pop').value=g.minPopulation;$('#grid-max-pop').value=g.maxPopulation;$('#grid-pop-seed').value=g.populationSeed;$('#grid-dim-label').textContent=`${g.rows} × ${g.columns}`;this.togglePopulationFields();}
  syncSimulationControls(){const c=state.simulationConfig;$('#sim-beta').value=c.beta;$('#sim-gamma').value=c.gamma;$('#sim-nu').value=c.nu;$('#sim-mobility').value=c.mobility;$('#sim-local-weight').value=c.localTransmissionWeight;$('#sim-spatial-weight').value=c.spatialTransmissionWeight??1;$('#sim-noise').value=c.parameterNoise;$('#sim-steps').value=c.timeSteps;$('#sim-unit').value=c.temporalUnit;$('#sim-seed').value=c.seed;$('#sim-initial-vaccination').value=c.initialVaccinationPct??15;$('#sim-vaccination-variation').value=c.initialVaccinationVariationPct??10;}
  syncDirectionControls(){const d=state.propagation.direction;$('#direction-enabled').checked=d.enabled!==false;$('#direction-key').value=d.direction;$('#direction-profile').value=d.directionProfile;$('#direction-cone').value=d.coneAngle;$('#direction-strength').value=d.directionStrength;$('#direction-forward').value=d.forwardWeight;$('#direction-lateral').value=d.lateralLeak;$('#direction-backward').value=d.backwardLeak;$('#direction-diagonal').value=d.diagonalPenalty;}
  syncPropagationSettings(){$('#path-susceptibility-default').value=state.propagation.pathSettings?.susceptibilityMultiplier??2.5;$('#barrier-vaccination-default').value=state.propagation.barrierSettings?.vaccinationCoverage??100;}
  togglePopulationFields(){const r=$('#grid-random-pop').checked;$('#uniform-pop-fields').hidden=r;$('#random-pop-fields').hidden=!r;}
  applyGrid(){const rows=Math.max(2,Math.min(80,num('#grid-rows',10))),columns=Math.max(2,Math.min(80,num('#grid-cols',10)));state.grid={...state.grid,rows,columns,neighborhood:$('#grid-neighborhood').value,borderMode:$('#grid-border').value,randomizePopulation:$('#grid-random-pop').checked,defaultPopulation:Math.max(1,num('#grid-pop',1000)),minPopulation:Math.max(1,num('#grid-min-pop',500)),maxPopulation:Math.max(1,num('#grid-max-pop',2000)),populationSeed:num('#grid-pop-seed',9876)};if(state.grid.maxPopulation<state.grid.minPopulation)state.grid.maxPopulation=state.grid.minPopulation;state.rebuildGrid();this.syncControls();this.renderer.resize();this.toast('success','Grid recriado',`${rows} × ${columns} regiões disponíveis.`);}
  renderAll(){this.renderPanels();this.renderMode();this.renderCompartments();this.renderScenario();this.renderRegion();this.renderSeedSummary();this.renderRuns();this.renderAnalysis();this.renderTimeline();this.renderEvents();this.renderDirty();this.renderer.render();this.charts.update(state);}
  renderPanels(){$$('.property-tab').forEach(b=>b.classList.toggle('active',b.dataset.panel===state.activePanel));$$('.property-content').forEach(p=>p.classList.toggle('active',p.dataset.panelContent===state.activePanel));if(state.activePanel==='region')this.renderRegion();if(state.activePanel==='analysis')this.renderAnalysis();}
  renderMode(){const [title,help]=MODE_INFO[state.interactionMode]||MODE_INFO.select;$('#mode-title').textContent=title;const pending=state.pendingSourceId?(state.interactionMode===INTERACTION_MODES.ADD_PREFERRED?` Última região do caminho: ${state.pendingSourceId}.`:` Primeira região: ${state.pendingSourceId}.`):'';$('#mode-help').textContent=help+pending;$('#btn-cancel-mode').hidden=state.interactionMode===INTERACTION_MODES.SELECT;$$('.tool').forEach(b=>b.classList.toggle('active',b.dataset.mode===state.interactionMode));}
  renderCompartments(){$$('.comp-tab').forEach(b=>b.classList.toggle('active',b.dataset.comp===state.activeCompartmentView));}
  renderDirty(){const badge=$('#dirty-badge');badge.hidden=!state.dirty;$('#run-warning').hidden=!(state.dirty&&!!state.currentRun());}
  setZoom(v){$('#zoom-label').textContent=`${Math.round(v*100)}%`;}
  handleHover(id){if(!id){$('#grid-canvas').title='';return;}const run=state.currentRun();const r=run?.history?.[state.currentTimeStep]?.get(id)||state.regions.get(id);if(r){const path=state.propagation.pathRegions?.find(x=>x.regionId===id&&x.enabled!==false);const barrier=state.propagation.vaccinationBarriers?.find(x=>x.regionId===id&&x.enabled!==false);$('#grid-canvas').title=`${id} · Pop ${r.population} · S ${r.susceptible} · I ${r.infected} · R ${r.recovered} · V ${r.vaccinated}${path?` · caminho χ×${path.susceptibilityMultiplier}`:''}${barrier?` · bloqueio V${Math.round(barrier.vaccinationCoverage)}%`:''}`;}}
  handleGridClick(id){
    state.setSelectedRegion(id);
    const mode=state.interactionMode;
    if(mode===INTERACTION_MODES.SELECT){state.setPanel('region');return;}
    if(mode===INTERACTION_MODES.ADD_ORIGIN){if(state.addOrigin(id))this.toast('success','Origem adicionada',`${id} foi adicionada como origem.`);else this.toast('warning','Origem existente',`${id} já é uma origem.`);return;}
    if(mode===INTERACTION_MODES.ADD_FOCUS){state.addFocus(id);this.toast('success','Foco adicionado','Edite o instante e a intensidade no painel Propagação.');return;}
    if(mode===INTERACTION_MODES.ADD_BARRIER){const added=state.addVaccinationBarrier(id);this.toast('success',added?'Bloqueio adicionado':'Bloqueio atualizado',`${id} recebeu ${Math.round(state.propagation.barrierSettings.vaccinationCoverage)}% de vacinação inicial.`);return;}
    if(mode===INTERACTION_MODES.ERASE){state.eraseRegion(id);this.toast('success','Elementos removidos',`Eventos, caminho e bloqueio associados a ${id} foram removidos.`);return;}
    if(mode===INTERACTION_MODES.ADD_PREFERRED){
      if(!state.pendingSourceId){state.addPathRegion(id);state.pendingSourceId=id;state.notify('MODE_CHANGE');this.toast('success','Caminho iniciado',`${id} marcado com suscetibilidade ×${state.propagation.pathSettings.susceptibilityMultiplier}.`);return;}
      const source=state.pendingSourceId,target=id;
      if(source===target){this.toast('warning','Seleção repetida','Escolha uma região adjacente para continuar o caminho.');return;}
      if(!areAdjacent(source,target,state.grid)){this.toast('warning','Caminho inválido','Continue o caminho por uma região adjacente à última região marcada.');return;}
      state.addPathRegion(target);state.pendingSourceId=target;state.notify('MODE_CHANGE');this.toast('success','Caminho ampliado',`${target} marcado com suscetibilidade ×${state.propagation.pathSettings.susceptibilityMultiplier}.`);return;
    }
    if(mode===INTERACTION_MODES.ADD_JUMP){
      if(!state.pendingSourceId){state.pendingSourceId=id;state.notify('MODE_CHANGE');return;}
      const source=state.pendingSourceId,target=id;state.pendingSourceId=null;
      if(source===target){this.toast('warning','Seleção inválida','Origem e destino precisam ser diferentes.');state.notify('MODE_CHANGE');return;}
      if(areAdjacent(source,target,state.grid))this.toast('warning','Salto inválido','Use saltos apenas entre regiões não adjacentes.');
      else{state.addJump(source,target);this.toast('success','Salto adicionado',`${source} → ${target}`);}
      state.notify('MODE_CHANGE');
    }
  }
  renderScenario(){
    const p=state.propagation;
    $('#count-origins').textContent=p.origins.length;
    $('#count-focuses').textContent=p.focuses.length;
    $('#count-jumps').textContent=p.jumps.length;
    $('#count-barriers').textContent=(p.vaccinationBarriers||[]).length;
    $('#count-paths').textContent=(p.pathRegions||[]).length;
    this.syncDirectionControls();this.syncPropagationSettings();
    const blocks=[];
    blocks.push(this.eventSection('Origens','origins',p.origins));
    blocks.push(this.eventSection('Focos','focuses',p.focuses));
    blocks.push(this.eventSection('Saltos','jumps',p.jumps));
    blocks.push(this.eventSection('Bloqueios vacinais','vaccinationBarriers',p.vaccinationBarriers||[]));
    blocks.push(this.eventSection('Regiões do caminho','pathRegions',p.pathRegions||[]));
    $('#scenario-lists').innerHTML=blocks.join('');
  }
  eventSection(title,kind,list){if(!list.length)return`<details><summary>${title} · 0</summary><p class="hint">Use a barra de ferramentas à esquerda para adicionar.</p></details>`;return`<details open><summary>${title} · ${list.length}</summary>${list.map((x,i)=>this.eventCard(kind,x,i)).join('')}</details>`;}
  regionSelect(kind,id,field,value,label){const options=[...state.regions.keys()].map(r=>`<option value="${r}" ${r===value?'selected':''}>${r}</option>`).join('');return`<label>${label}<select data-kind="${kind}" data-id="${id}" data-field="${field}">${options}</select></label>`;}
  eventCard(kind,x,i){
    const field=(name,label,value,type='number',extra='')=>`<label>${label}<input data-kind="${kind}" data-id="${x.id}" data-field="${name}" type="${type}" value="${esc(value)}" ${extra}></label>`;
    const check=(name,label,value)=>`<label class="check-row"><input data-kind="${kind}" data-id="${x.id}" data-field="${name}" type="checkbox" ${value?'checked':''}> ${label}</label>`;
    let body='',title='';
    if(kind==='origins'||kind==='focuses'){
      body=`<div class="mini-grid">${this.regionSelect(kind,x.id,'regionId',x.regionId,'Região')}${field('startTime','Início',x.startTime)}${field('infectedCount','Infectados',x.infectedCount)}${field('duration','Duração',x.duration)}${check('enabled','Ativo',x.enabled!==false)}</div>`;
      title=kind==='origins'?`Origem ${i+1} · ${x.regionId}`:`Foco ${i+1} · ${x.regionId}`;
    }
    if(kind==='jumps'){
      body=`<div class="mini-grid">${this.regionSelect(kind,x.id,'sourceRegionId',x.sourceRegionId,'Origem')}${this.regionSelect(kind,x.id,'targetRegionId',x.targetRegionId,'Destino')}${field('startTime','Início',x.startTime)}${field('probability','Probabilidade',x.probability,'number','min="0" max="1" step="0.05"')}${field('infectedCount','Infectados',x.infectedCount)}${field('interval','Intervalo',x.interval)}${check('recurring','Recorrente',x.recurring)}${check('enabled','Ativo',x.enabled!==false)}</div>`;
      title=`${x.sourceRegionId} → ${x.targetRegionId}`;
    }
    if(kind==='vaccinationBarriers'){
      const coverage=Math.max(0,Math.min(100,Number(x.vaccinationCoverage??100)));
      body=`<div class="mini-grid">${this.regionSelect(kind,x.id,'regionId',x.regionId,'Região')}${field('vaccinationCoverage','Vacinação inicial (%)',coverage,'number','min="0" max="100" step="1"')}${check('enabled','Ativo',x.enabled!==false)}</div><div class="barrier-status ${coverage>=100?'':'partial'}">${coverage>=100?'BLOQUEIO TOTAL':`V ${Math.round(coverage)}%`}</div><p class="hint">O bloqueio altera o compartimento V da região. Em 100%, S = 0 e não há população suscetível para transmissão.</p>`;
      title=`Bloqueio · ${x.regionId}`;
    }
    if(kind==='pathRegions'){
      const susceptibility=Math.max(0,Number(x.susceptibilityMultiplier??2));
      body=`<div class="mini-grid">${this.regionSelect(kind,x.id,'regionId',x.regionId,'Região')}${field('susceptibilityMultiplier','Suscetibilidade (×)',susceptibility,'number','min="1" max="10" step="0.1"')}${check('enabled','Ativo',x.enabled!==false)}</div><div class="path-status">χ ×${susceptibility.toFixed(1)}</div><p class="hint">A força de infecção recebida por esta região é multiplicada por este valor.</p>`;
      title=`Caminho · ${x.regionId}`;
    }
    return`<div class="event-card"><div class="event-card-head"><h4>${esc(title)}</h4><button class="remove" data-remove-kind="${kind}" data-remove-id="${x.id}">Remover</button></div>${body}</div>`;
  }
  editScenarioItem(e){
    const el=e.target;if(!el.dataset.kind)return;
    const {kind,id,field}=el.dataset;
    let value=el.type==='checkbox'?el.checked:el.value;
    if(el.type==='number')value=Number(value);
    if(kind==='vaccinationBarriers'&&field==='vaccinationCoverage')value=Math.max(0,Math.min(100,Number(value)||0));
    if(kind==='pathRegions'&&field==='susceptibilityMultiplier')value=Math.max(1,Math.min(10,Number(value)||1));
    const item=state.propagation[kind]?.find(x=>x.id===id);
    if(item&&kind==='jumps'&&['sourceRegionId','targetRegionId'].includes(field)){
      const source=field==='sourceRegionId'?value:item.sourceRegionId,target=field==='targetRegionId'?value:item.targetRegionId;
      if(source===target){this.toast('warning','Conexão inválida','Origem e destino precisam ser diferentes.');this.renderScenario();return;}
      if(areAdjacent(source,target,state.grid)){this.toast('warning','Salto inválido','Saltos devem ligar regiões não adjacentes.');this.renderScenario();return;}
    }
    if(item&&['vaccinationBarriers','pathRegions'].includes(kind)&&field==='regionId'){
      const duplicate=state.propagation[kind].some(x=>x.id!==id&&x.regionId===value);
      if(duplicate){this.toast('warning','Região já marcada','Essa região já possui essa propriedade.');this.renderScenario();return;}
    }
    state.updateEvent(kind,id,{[field]:value});
  }
  renderSeedSummary(){
    const values=[...state.regions.values()];
    if(!values.length)return;
    const seeded=values.filter(r=>r.initialConditionMode!=='manual');
    const vacc=values.map(r=>r.population>0?100*r.vaccinated/r.population:0);
    const minV=Math.min(...vacc),maxV=Math.max(...vacc),avgV=vacc.reduce((a,b)=>a+b,0)/vacc.length;
    const box=$('#seeded-conditions-summary');
    if(box)box.innerHTML=`<strong>Seed ${esc(state.simulationConfig.seed)}</strong><span>${seeded.length} regiões geradas · V médio ${avgV.toFixed(1)}% · intervalo ${minV.toFixed(1)}–${maxV.toFixed(1)}%</span>`;
  }
  renderRegion(){
    const id=state.selectedRegionId,form=$('#region-form');
    if(!id||!state.regions.has(id)){form.hidden=true;$('#region-caption').textContent='Selecione uma região no grid.';return;}
    const r=state.regions.get(id);form.hidden=false;
    $('#region-caption').textContent=`${id} · linha ${r.row}, coluna ${r.column}`;
    $('#region-manual-initial').checked=r.initialConditionMode==='manual';
    $('#region-pop').value=r.population;$('#region-s').value=r.susceptible;$('#region-i').value=r.infected;$('#region-r').value=r.recovered;$('#region-v').value=r.vaccinated;
    $('#region-susc-m').value=r.localParameters?.susceptibilityMultiplier??1;
    $('#region-beta-m').value=r.localParameters?.betaMultiplier??1;$('#region-gamma-m').value=r.localParameters?.gammaMultiplier??1;$('#region-nu-m').value=r.localParameters?.vaccinationMultiplier??1;$('#region-mobility-m').value=r.localParameters?.mobilityMultiplier??1;
    const path=state.propagation.pathRegions?.find(x=>x.regionId===id&&x.enabled!==false);
    const barrier=state.propagation.vaccinationBarriers?.find(x=>x.regionId===id&&x.enabled!==false);
    const info=$('#region-derived-info');
    info.innerHTML=`<strong>${r.initialConditionMode==='manual'?'Condição inicial manual':'Condição inicial gerada pela semente'}</strong><span>V ${r.population?((r.vaccinated/r.population)*100).toFixed(1):'0.0'}%${path?` · caminho χ ×${Number(path.susceptibilityMultiplier).toFixed(1)}`:''}${barrier?` · bloqueio V ${Math.round(barrier.vaccinationCoverage)}%`:''}</span>`;
  }
  saveRegion(){
    const id=state.selectedRegionId;if(!id)return;
    const manual=$('#region-manual-initial').checked;
    state.updateRegion(id,{population:num('#region-pop',1),infected:num('#region-i'),recovered:num('#region-r'),vaccinated:num('#region-v'),initialConditionMode:manual?'manual':'seeded',localParameters:{susceptibilityMultiplier:num('#region-susc-m',1),betaMultiplier:num('#region-beta-m',1),gammaMultiplier:num('#region-gamma-m',1),vaccinationMultiplier:num('#region-nu-m',1),mobilityMultiplier:num('#region-mobility-m',1)}});
    this.renderRegion();this.renderSeedSummary();this.toast('success','Região atualizada',manual?`${id} manterá S/V manuais.`:`${id} voltará a usar S/V gerados pela semente.`);
  }
  simulate(){try{this.animation.pause();const id=`run-${Date.now().toString(36)}-${Math.random().toString(36).slice(2,6)}`;const regions=new Map([...state.regions].map(([k,r])=>[k,{...r,localParameters:{...(r.localParameters||{})}}]));const propagation=clone(state.propagation),simulationConfig=clone(state.simulationConfig),grid=clone(state.grid);const result=runSIRVSimulation({gridConfig:grid,simulationConfig,regions,propagation});const initialRegions=result.initialRegions||regions;const run={id,createdAt:new Date().toISOString(),seed:simulationConfig.seed,status:'review',notes:'',grid,simulationConfig,propagation,regions:[...initialRegions.values()],history:result.history,eventLog:result.eventLog,edges:result.edges};run.summary=analyzeRun(run,initialRegions,{arrivalThreshold:num('#analysis-threshold',1),referenceRegionId:$('#analysis-reference').value||null});state.registerRun(run);state.setPanel('runs');this.showBottomTab('timeline');$('#bottom-panel').classList.remove('collapsed');$('#btn-toggle-bottom').textContent='Recolher';this.toast('success','Simulação pronta',`${run.history.length} instantes foram gerados com a seed ${simulationConfig.seed}. A animação está habilitada; pressione ▶ na linha do tempo.`);}catch(error){console.error(error);this.toast('danger','Falha na simulação',error.message);}}
  showBottomTab(name){$$('.bottom-tab').forEach(x=>x.classList.toggle('active',x.dataset.bottom===name));$$('.bottom-content').forEach(x=>x.classList.toggle('active',x.dataset.bottomContent===name));setTimeout(()=>{this.charts.draw();this.renderer.resize();},0);}
  renderRuns(){const box=$('#runs-list');if(!state.runs.length){box.innerHTML='<div class="empty-state">Nenhuma execução ainda.</div>';$('#selected-run-actions').hidden=true;return;}box.innerHTML=state.runs.map(r=>`<div class="run-card ${r.id===state.selectedRunId?'selected':''}" data-run-id="${r.id}"><div class="run-card-head"><h4>${esc(r.id)}</h4><span class="run-status ${r.status}">${r.status==='approved'?'Aprovada':r.status==='rejected'?'Rejeitada':'Em análise'}</span></div><div class="run-meta"><span>seed ${r.seed}</span><span>${r.history.length} instantes</span><span>pico I ${r.summary?.globalPeak?.infected??0}</span></div></div>`).join('');const run=state.currentRun();$('#selected-run-actions').hidden=!run;if(run)$('#run-notes').value=run.notes||'';}
  setRunStatus(status){const run=state.currentRun();if(!run)return;state.updateRun(run.id,{status});this.toast('success',status==='approved'?'Execução aprovada':'Execução rejeitada',run.id);}
  renderTimeline(){const run=state.currentRun(),slider=$('#time-slider'),enabled=!!run;slider.max=run?run.history.length-1:0;slider.value=state.currentTimeStep;$('#time-step-badge').textContent=enabled?`t = ${state.currentTimeStep}`:'t = —';$('#btn-play-pause').textContent=state.isPlaying?'❚❚':'▶';for(const id of ['#btn-reset','#btn-step-back','#btn-play-pause','#btn-step-forward','#time-slider','#playback-speed'])$(id).disabled=!enabled;$('#timeline-controls').classList.toggle('is-disabled',!enabled);const gate=$('#simulation-gate');gate.classList.toggle('ready',enabled);gate.querySelector('strong').textContent=enabled?'Simulação pronta para animar':'Animação ainda não disponível';gate.querySelector('span').textContent=enabled?'Use ▶ para reproduzir, os botões de passo ou arraste a linha do tempo.':'Primeiro execute a simulação. Depois use ▶, os passos ou o controle temporal para visualizar a propagação.';$('#btn-simulate-timeline').textContent=enabled?'Executar novamente':'Executar simulação';}
  renderEvents(){const run=state.currentRun(),box=$('#event-log');if(!run){box.className='event-log empty-state';box.textContent='Execute uma simulação para visualizar os eventos.';return;}box.className='event-log';const events=run.eventLog||[];box.innerHTML=events.length?events.map(e=>`<div class="event-row"><strong>t=${e.time}</strong><span>${esc(e.type)}</span><span>${esc(e.regionId||`${e.sourceRegionId||''} → ${e.targetRegionId||''}`)} ${e.infectedCount?`· ${e.infectedCount} infectados`:''}${e.infectedIntroduced?`· ${e.infectedIntroduced} introduzidos`:''}${e.reason?`· ${e.reason}`:''}</span></div>`).join(''):'<div class="empty-state">Nenhum evento externo foi executado.</div>';}
  populateRegionReference(){const sel=$('#analysis-reference'),current=sel.value;sel.innerHTML='<option value="">Nenhuma</option>'+[...state.regions.keys()].map(id=>`<option value="${id}">${id}</option>`).join('');if(state.regions.has(current))sel.value=current;$('#analysis-threshold').value=state.analysisOptions.arrivalThreshold||1;}
  refreshAnalysis(){state.analysisOptions={arrivalThreshold:Math.max(1,num('#analysis-threshold',1)),referenceRegionId:$('#analysis-reference').value||null};const run=state.currentRun();if(run){const regions=new Map(run.regions.map(r=>[r.id,r]));run.summary=analyzeRun(run,regions,state.analysisOptions);state.notify('RUN_UPDATED',{id:run.id});}}
  renderAnalysis(){const run=state.currentRun(),box=$('#analysis-panel');if(!run){box.className='analysis-panel empty-state';box.textContent='Execute uma simulação para calcular métricas.';return;}box.className='analysis-panel';const s=run.summary||{};const dir=s.observedDirection||{};const corr=(s.topCorrelations||[]).map(x=>`<tr><td>${esc(x.regionId)}</td><td>${Number(x.correlation).toFixed(3)}</td></tr>`).join('');box.innerHTML=`<div class="analysis-grid"><div class="metric-card"><strong>${s.reachedRegions??0}/${s.totalRegions??0}</strong><span>regiões atingidas</span></div><div class="metric-card"><strong>t=${s.duration??0}</strong><span>duração com infectados</span></div><div class="metric-card"><strong>${s.peakRegion?.infected??0}</strong><span>maior pico regional · ${esc(s.peakRegion?.regionId||'—')} em t=${s.peakRegion?.time??0}</span></div><div class="metric-card"><strong>${s.executedJumps??0}</strong><span>saltos executados</span></div><div class="metric-card"><strong>${esc(dir.direction||'indefinida')}</strong><span>direção observada · confiança ${Number(dir.confidence||0).toFixed(2)}</span></div><div class="metric-card"><strong>${Math.round((s.attackReach||0)*100)}%</strong><span>cobertura espacial</span></div></div>${corr?`<h3>Regiões mais correlacionadas</h3><table class="analysis-table"><thead><tr><th>Região</th><th>Correlação</th></tr></thead><tbody>${corr}</tbody></table>`:'<p class="hint">Escolha uma região de referência para calcular correlações.</p>'}`;}
  exportRun(type){const run=state.currentRun();if(!run)return;const base=this.safeName(`${state.project.name}-${run.id}`);if(type==='run-json')downloadText(`${base}-simulation.json`,runJSON(run),'application/json;charset=utf-8');if(type==='temporal')downloadText(`${base}-temporal.csv`,temporalCSV(run),'text/csv;charset=utf-8');if(type==='regions')downloadText(`${base}-regions.csv`,regionsCSV(run),'text/csv;charset=utf-8');if(type==='events')downloadText(`${base}-events.csv`,eventsCSV(run),'text/csv;charset=utf-8');if(type==='edges')downloadText(`${base}-edges.csv`,edgesCSV(run),'text/csv;charset=utf-8');if(type==='summary')downloadText(`${base}-summary.json`,JSON.stringify(run.summary,null,2),'application/json;charset=utf-8');}
  async importProject(file){
    if(!file)return;
    try{
      const data=JSON.parse(await file.text());
      if(!String(data.schemaVersion||'').startsWith('4.'))throw new Error('O arquivo não usa o schema 4.x deste projeto.');
      this.animation.pause();
      const oldSchema=String(data.schemaVersion||'');
      state.project={...state.project,...(data.project||{}),schemaVersion:'4.2.0'};
      state.grid={...state.grid,...(data.grid||{})};
      state.simulationConfig={...state.simulationConfig,...(data.simulationConfig||{})};
      state.propagation=migratePropagation(data.propagation||{});
      const importedRegions=new Map((data.regions||[]).map(r=>[r.id,{...r,initialConditionMode:r.initialConditionMode||'seeded',localParameters:{susceptibilityMultiplier:1,...(r.localParameters||{})}}]));
      state.regions=buildInitialRegions(importedRegions.size?importedRegions:state.regions,state.simulationConfig,state.propagation);
      state.analysisOptions=data.analysisOptions||{arrivalThreshold:1,referenceRegionId:null};
      state.runs=(data.runs||[]).map(deserializeRun);state.selectedRunId=state.runs[0]?.id||null;state.currentTimeStep=0;state.selectedRegionId=null;state.interactionMode=INTERACTION_MODES.SELECT;state.pendingSourceId=null;state.dirty=true;
      state.notify('PROJECT_LOADED');this.syncControls();this.renderAll();this.renderer.resize();
      this.toast('success','Projeto importado',oldSchema==='4.2.0'?`${state.project.name} foi carregado.`:`${state.project.name} foi migrado de ${oldSchema||'4.x'} para 4.2.0.`);
    }catch(error){console.error(error);this.toast('danger','Falha ao importar',error.message);}finally{$('#project-file').value='';}
  }
  toast(level,title,message){const el=document.createElement('div');el.className=`toast ${level||''}`;el.innerHTML=`<strong>${esc(title)}</strong><span>${esc(message||'')}</span>`;$('#toast-container').appendChild(el);setTimeout(()=>el.remove(),4200);}
  safeName(name){return String(name||'propagation-studio').trim().replace(/[^a-z0-9-_]+/gi,'-').replace(/-+/g,'-').replace(/^-|-$/g,'')||'propagation-studio';}
}

document.addEventListener('DOMContentLoaded',()=>{window.app=new App();});
