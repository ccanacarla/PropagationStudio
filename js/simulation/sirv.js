import { Mulberry32 } from './random.js';
import { buildWeightedEdges } from '../spatial/edges.js';
import { buildInitialRegions } from './initial-conditions.js';
import { applyScheduledEvents } from './events.js';
import { stepStochasticSIRVWeighted } from './stochastic.js';

export function runSIRVSimulation({ spaceConfig, gridConfig, simulationConfig, regions, propagation }) {
  if (!(regions instanceof Map) || regions.size===0) throw new Error('O espaço não possui regiões.');
  const prng=new Mulberry32(Number(simulationConfig.seed)||1);
  const timeSteps=Math.max(1,Math.floor(Number(simulationConfig.timeSteps)||1));
  const initialized=buildInitialRegions(regions,simulationConfig,propagation);
  const graph=buildWeightedEdges(spaceConfig || { mode:'grid', grid:gridConfig },initialized,propagation);
  const eventLog=[];
  const base=new Map();

  for (const [id,r] of initialized) {
    const population=Math.max(1,Math.round(Number(r.population)||1));
    let infected=Math.max(0,Math.round(Number(r.infected)||0));
    let recovered=Math.max(0,Math.round(Number(r.recovered)||0));
    let vaccinated=Math.max(0,Math.round(Number(r.vaccinated)||0));
    const occupied=infected+recovered+vaccinated;
    if (occupied>population) {
      const scale=population/occupied;
      infected=Math.floor(infected*scale);
      recovered=Math.floor(recovered*scale);
      vaccinated=Math.max(0,population-infected-recovered);
    }
    const susceptible=population-infected-recovered-vaccinated;
    base.set(id,{...r,population,susceptible,infected,recovered,vaccinated,newInfections:0,newRecoveries:0,newVaccinations:0,localInfections:0,importedInfections:0,activeOrigin:false,activeFocus:false,receivedJump:false,externalEventIds:[]});
  }

  const resetTransient = frame => new Map([...frame].map(([id,r]) => [id, { ...r, newInfections:0, newRecoveries:0, newVaccinations:0, localInfections:0, importedInfections:0, activeOrigin:false, activeOriginId:null, activeFocus:false, activeFocusId:null, receivedJump:false, receivedJumpId:null, externalEventIds:[] }]));
  let current=applyScheduledEvents(0,base,propagation,prng,eventLog);
  const history=[current];
  for (let t=1;t<=timeSteps;t++) {
    const evolved=stepStochasticSIRVWeighted(resetTransient(current),graph.incomingMap,simulationConfig,prng);
    current=applyScheduledEvents(t,evolved,propagation,prng,eventLog);
    history.push(current);
  }
  return {history,eventLog,edges:graph.edges,initialRegions:initialized};
}
