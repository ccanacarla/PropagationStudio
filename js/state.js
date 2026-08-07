import { GRID_DEFAULTS, SIMULATION_DEFAULTS, NEIGHBORHOOD_TYPES, BORDER_MODES, INTERACTION_MODES } from './constants.js';
import { createGrid } from './spatial/grid.js';
import { buildInitialRegions } from './simulation/initial-conditions.js';

const uid=(prefix)=>`${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2,7)}`;
const defaultDirection=()=>({
  enabled:true,direction:'radial',directionProfile:SIMULATION_DEFAULTS.DIRECTION_PROFILE,
  coneAngle:SIMULATION_DEFAULTS.CONE_ANGLE,directionStrength:SIMULATION_DEFAULTS.DIRECTION_STRENGTH,
  forwardWeight:SIMULATION_DEFAULTS.FORWARD_WEIGHT,lateralLeak:SIMULATION_DEFAULTS.LATERAL_LEAK,
  backwardLeak:SIMULATION_DEFAULTS.BACKWARD_LEAK,diagonalPenalty:SIMULATION_DEFAULTS.DIAGONAL_PENALTY
});
export const defaultPropagation=()=>({
  origins:[],focuses:[],jumps:[],vaccinationBarriers:[],pathRegions:[],direction:defaultDirection(),
  pathSettings:{susceptibilityMultiplier:SIMULATION_DEFAULTS.PATH_SUSCEPTIBILITY_MULTIPLIER},
  barrierSettings:{vaccinationCoverage:SIMULATION_DEFAULTS.BARRIER_VACCINATION_PCT}
});

export class AppState {
  constructor(){
    this.listeners=new Set();
    this.project={id:uid('project'),name:'Novo cenário',schemaVersion:'4.2.0',createdAt:new Date().toISOString(),updatedAt:new Date().toISOString()};
    this.grid={rows:GRID_DEFAULTS.DEFAULT_ROWS,columns:GRID_DEFAULTS.DEFAULT_COLS,defaultPopulation:GRID_DEFAULTS.DEFAULT_POPULATION,randomizePopulation:false,minPopulation:500,maxPopulation:2000,populationSeed:9876,neighborhood:NEIGHBORHOOD_TYPES.MOORE,borderMode:BORDER_MODES.NORMAL};
    this.simulationConfig={
      seed:SIMULATION_DEFAULTS.SEED,timeSteps:SIMULATION_DEFAULTS.TIME_STEPS,temporalUnit:SIMULATION_DEFAULTS.TEMPORAL_UNIT,
      beta:SIMULATION_DEFAULTS.BETA,gamma:SIMULATION_DEFAULTS.GAMMA,nu:SIMULATION_DEFAULTS.NU,mobility:SIMULATION_DEFAULTS.MOBILITY,
      localTransmissionWeight:SIMULATION_DEFAULTS.LOCAL_WEIGHT,spatialTransmissionWeight:SIMULATION_DEFAULTS.SPATIAL_WEIGHT,
      parameterNoise:SIMULATION_DEFAULTS.PARAMETER_NOISE,
      initialVaccinationPct:SIMULATION_DEFAULTS.INITIAL_VACCINATION_PCT,
      initialVaccinationVariationPct:SIMULATION_DEFAULTS.INITIAL_VACCINATION_VARIATION_PCT
    };
    this.propagation=defaultPropagation();
    this.regions=createGrid(this.grid.rows,this.grid.columns,this.grid);
    this.regions=buildInitialRegions(this.regions,this.simulationConfig,this.propagation);
    this.runs=[];this.selectedRunId=null;this.currentTimeStep=0;this.isPlaying=false;this.playbackSpeed=180;
    this.interactionMode=INTERACTION_MODES.SELECT;this.pendingSourceId=null;this.selectedRegionId=null;
    this.activeCompartmentView='infected';this.activePanel='space';this.dirty=true;this.notifications=[];
    this.analysisOptions={arrivalThreshold:1,referenceRegionId:null};
  }
  subscribe(fn){this.listeners.add(fn);return()=>this.listeners.delete(fn);}
  notify(type,data=null){for(const fn of this.listeners){try{fn(type,data,this);}catch(e){console.error(e);}}}
  touch(type='STATE_CHANGE',data=null){this.project.updatedAt=new Date().toISOString();this.dirty=true;this.notify(type,data);}
  currentRun(){return this.runs.find(r=>r.id===this.selectedRunId)||null;}
  setPanel(panel){this.activePanel=panel;this.notify('PANEL_CHANGE',{panel});}
  setMode(mode){this.interactionMode=mode;this.pendingSourceId=null;this.notify('MODE_CHANGE',{mode});}
  setSelectedRegion(id){this.selectedRegionId=id;this.notify('SELECTION_CHANGE',{id});}
  setCompartment(comp){this.activeCompartmentView=comp;this.notify('VIEW_CHANGE',{comp});}
  setTimeStep(t){const run=this.currentRun();const max=run?run.history.length-1:0;this.currentTimeStep=Math.max(0,Math.min(max,Math.floor(Number(t)||0)));this.notify('TIME_CHANGE',{time:this.currentTimeStep});}
  updateGrid(patch,rebuild=false){this.grid={...this.grid,...patch};if(rebuild)this.rebuildGrid();else this.touch('GRID_CHANGE',this.grid);}
  regenerateInitialConditions(type='INITIAL_CONDITIONS_CHANGE'){
    this.regions=buildInitialRegions(this.regions,this.simulationConfig,this.propagation);
    this.touch(type,{seed:this.simulationConfig.seed});
  }
  rebuildGrid(){
    this.regions=createGrid(this.grid.rows,this.grid.columns,this.grid);
    this.propagation=defaultPropagation();
    this.regions=buildInitialRegions(this.regions,this.simulationConfig,this.propagation);
    this.selectedRegionId=null;this.selectedRunId=null;this.currentTimeStep=0;
    this.touch('GRID_REBUILT');
  }
  updateSimulation(patch){
    const seededKeys=['seed','initialVaccinationPct','initialVaccinationVariationPct'];
    const shouldRegenerate=Object.keys(patch).some(k=>seededKeys.includes(k));
    this.simulationConfig={...this.simulationConfig,...patch};
    if(shouldRegenerate){
      this.regions=buildInitialRegions(this.regions,this.simulationConfig,this.propagation);
      this.touch('INITIAL_CONDITIONS_CHANGE',{seed:this.simulationConfig.seed});
    } else this.touch('SIM_CONFIG_CHANGE');
  }
  updateDirection(patch){this.propagation.direction={...this.propagation.direction,...patch};this.touch('PROPAGATION_CHANGE');}
  updatePropagationSettings(kind,patch){
    if(kind==='path')this.propagation.pathSettings={...this.propagation.pathSettings,...patch};
    if(kind==='barrier')this.propagation.barrierSettings={...this.propagation.barrierSettings,...patch};
    this.touch('PROPAGATION_CHANGE');
  }
  updateRegion(id,patch){
    const r=this.regions.get(id);if(!r)return;
    const next={...r,...patch,localParameters:{...(r.localParameters||{}),...(patch.localParameters||{})}};
    next.population=Math.max(1,Math.round(Number(next.population)||1));
    next.infected=Math.max(0,Math.round(Number(next.infected)||0));
    next.recovered=Math.max(0,Math.round(Number(next.recovered)||0));
    next.vaccinated=Math.max(0,Math.round(Number(next.vaccinated)||0));
    let occupied=next.infected+next.recovered+next.vaccinated;
    if(occupied>next.population){
      const scale=next.population/occupied;
      next.infected=Math.floor(next.infected*scale);next.recovered=Math.floor(next.recovered*scale);
      next.vaccinated=Math.max(0,next.population-next.infected-next.recovered);
    }
    next.susceptible=next.population-next.infected-next.recovered-next.vaccinated;
    this.regions.set(id,next);
    if(next.initialConditionMode!=='manual'){
      this.regions=buildInitialRegions(this.regions,this.simulationConfig,this.propagation);
    }
    this.touch('REGION_CHANGE',{id});
  }
  addOrigin(regionId){if(this.propagation.origins.some(x=>x.regionId===regionId))return false;this.propagation.origins.push({id:uid('origin'),regionId,startTime:0,infectedCount:20,duration:1,enabled:true});this.touch('PROPAGATION_CHANGE');return true;}
  addFocus(regionId){this.propagation.focuses.push({id:uid('focus'),regionId,startTime:10,infectedCount:20,duration:1,enabled:true});this.touch('PROPAGATION_CHANGE');return true;}
  addJump(sourceRegionId,targetRegionId){this.propagation.jumps.push({id:uid('jump'),sourceRegionId,targetRegionId,startTime:10,probability:1,infectedCount:10,recurring:false,interval:5,enabled:true});this.touch('PROPAGATION_CHANGE');}
  addVaccinationBarrier(regionId){
    const existing=this.propagation.vaccinationBarriers.find(x=>x.regionId===regionId);
    if(existing){existing.vaccinationCoverage=this.propagation.barrierSettings.vaccinationCoverage;existing.enabled=true;}
    else this.propagation.vaccinationBarriers.push({id:uid('barrier'),regionId,vaccinationCoverage:this.propagation.barrierSettings.vaccinationCoverage,enabled:true});
    this.regions=buildInitialRegions(this.regions,this.simulationConfig,this.propagation);
    this.touch('PROPAGATION_CHANGE');return !existing;
  }
  addPathRegion(regionId){
    const existing=this.propagation.pathRegions.find(x=>x.regionId===regionId);
    if(existing){existing.susceptibilityMultiplier=this.propagation.pathSettings.susceptibilityMultiplier;existing.enabled=true;}
    else this.propagation.pathRegions.push({id:uid('path'),regionId,susceptibilityMultiplier:this.propagation.pathSettings.susceptibilityMultiplier,enabled:true});
    this.touch('PROPAGATION_CHANGE');return !existing;
  }
  updateEvent(kind,id,patch){
    const list=this.propagation[kind];const item=list?.find(x=>x.id===id);
    if(!item)return;
    Object.assign(item,patch);
    if(kind==='vaccinationBarriers')this.regions=buildInitialRegions(this.regions,this.simulationConfig,this.propagation);
    this.touch('PROPAGATION_CHANGE');
  }
  removeEvent(kind,id){
    if(!Array.isArray(this.propagation[kind]))return;
    this.propagation[kind]=this.propagation[kind].filter(x=>x.id!==id);
    if(kind==='vaccinationBarriers')this.regions=buildInitialRegions(this.regions,this.simulationConfig,this.propagation);
    this.touch('PROPAGATION_CHANGE');
  }
  eraseRegion(regionId){
    for(const k of ['origins','focuses'])this.propagation[k]=this.propagation[k].filter(x=>x.regionId!==regionId);
    this.propagation.jumps=this.propagation.jumps.filter(x=>x.sourceRegionId!==regionId&&x.targetRegionId!==regionId);
    this.propagation.vaccinationBarriers=this.propagation.vaccinationBarriers.filter(x=>x.regionId!==regionId);
    this.propagation.pathRegions=this.propagation.pathRegions.filter(x=>x.regionId!==regionId);
    this.regions=buildInitialRegions(this.regions,this.simulationConfig,this.propagation);
    this.touch('PROPAGATION_CHANGE');
  }
  registerRun(run){this.runs.unshift(run);this.selectedRunId=run.id;this.currentTimeStep=0;this.dirty=false;this.notify('RUN_ADDED',{run});}
  selectRun(id){this.selectedRunId=id;this.currentTimeStep=0;this.notify('RUN_SELECTED',{id});}
  updateRun(id,patch){const run=this.runs.find(r=>r.id===id);if(run){Object.assign(run,patch);this.notify('RUN_UPDATED',{id});}}
  removeRun(id){this.runs=this.runs.filter(r=>r.id!==id);if(this.selectedRunId===id)this.selectedRunId=this.runs[0]?.id||null;this.notify('RUN_REMOVED',{id});}
  newProject(){const listeners=this.listeners;const fresh=new AppState();Object.assign(this,fresh);this.listeners=listeners;this.notify('PROJECT_RESET');}
  addNotification(level,title,message){this.notifications.push({id:uid('note'),level,title,message});this.notify('NOTIFICATION',this.notifications.at(-1));}
}
export const state=new AppState();
