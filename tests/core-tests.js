import fs from 'node:fs';
import { createGrid } from '../js/spatial/grid.js';
import { runSIRVSimulation } from '../js/simulation/sirv.js';
import { buildWeightedEdges } from '../js/spatial/edges.js';
import { buildInitialRegions } from '../js/simulation/initial-conditions.js';
import { analyzeRun } from '../js/analytics/summary.js';
import { projectJSON, temporalCSV, eventsCSV, edgesCSV, regionsCSV, serializeRun, deserializeRun } from '../js/export/files.js';

let passed=0,failed=0;
const assert=(c,n)=>{if(c){console.log(`[PASSOU] ${n}`);passed++;}else{console.error(`[FALHOU] ${n}`);failed++;}};
const grid={rows:7,columns:7,defaultPopulation:1200,randomizePopulation:false,neighborhood:'moore',borderMode:'normal'};
const sim={seed:12345,timeSteps:45,beta:.38,gamma:.08,nu:0,mobility:.65,localTransmissionWeight:1,spatialTransmissionWeight:1,parameterNoise:0,temporalUnit:'dia',initialVaccinationPct:15,initialVaccinationVariationPct:10};
const direction={enabled:true,direction:'radial',directionProfile:'cone',coneAngle:35,directionStrength:5,forwardWeight:1,lateralLeak:.03,backwardLeak:0,diagonalPenalty:.85};
const empty=()=>({origins:[],focuses:[],jumps:[],vaccinationBarriers:[],pathRegions:[],pathSettings:{susceptibilityMultiplier:2.5},barrierSettings:{vaccinationCoverage:100},direction:{...direction}});
const run=(propagation,s=sim,g=grid,regions=createGrid(g.rows,g.columns,g))=>runSIRVSimulation({gridConfig:g,simulationConfig:s,regions,propagation});
console.log('=== TESTES PROPAGATION STUDIO 4.2 ===');

// Initial seeded heterogeneity
const raw=createGrid(5,5,{...grid,rows:5,columns:5});
const initA=buildInitialRegions(raw,{...sim,seed:2026},empty());
const initB=buildInitialRegions(raw,{...sim,seed:2026},empty());
const initC=buildInitialRegions(raw,{...sim,seed:2027},empty());
const vaccA=[...initA.values()].map(r=>r.vaccinated);
const vaccB=[...initB.values()].map(r=>r.vaccinated);
const vaccC=[...initC.values()].map(r=>r.vaccinated);
assert(new Set(vaccA).size>1,'Semente gera heterogeneidade regional de vacinados/suscetíveis');
assert(JSON.stringify(vaccA)===JSON.stringify(vaccB),'Mesma semente reproduz exatamente as condições iniciais S/V');
assert(JSON.stringify(vaccA)!==JSON.stringify(vaccC),'Semente diferente gera outro padrão espacial S/V');

const manual=createGrid(2,2,{...grid,rows:2,columns:2});
manual.get('R_1_1').initialConditionMode='manual';manual.get('R_1_1').vaccinated=321;manual.get('R_1_1').susceptible=879;
const initManual=buildInitialRegions(manual,{...sim,seed:77},empty());
assert(initManual.get('R_1_1').vaccinated===321,'Região em modo manual preserva V ao trocar a semente');

const p1=empty();p1.origins=[{id:'o1',regionId:'R_4_4',startTime:0,infectedCount:50,duration:1,enabled:true}];const a=run(p1),b=run(p1);
assert(JSON.stringify([...a.history[15].values()].map(r=>r.infected))===JSON.stringify([...b.history[15].values()].map(r=>r.infected)),'Mesma semente produz a mesma simulação dinâmica');
let conserved=true;for(const frame of a.history)for(const r of frame.values())if(r.susceptible+r.infected+r.recovered+r.vaccinated!==r.population||Math.min(r.susceptible,r.infected,r.recovered,r.vaccinated)<0)conserved=false;
assert(conserved,'Conservação populacional e ausência de valores negativos');

const delayed=empty();delayed.origins=[{id:'o1',regionId:'R_2_2',startTime:5,infectedCount:40,duration:1,enabled:true}];const rd=run(delayed);
assert(rd.history.slice(0,5).every(f=>f.get('R_2_2').infected===0)&&rd.history[5].get('R_2_2').infected===40,'Origem pode ser programada para instante futuro');

const f=empty();f.focuses=[{id:'f1',regionId:'R_6_6',startTime:3,infectedCount:12,duration:2,enabled:true}];const rf=run(f);
assert(rf.eventLog.filter(e=>e.type==='focus_injected'&&e.focusId==='f1').length===2,'Foco respeita início e duração');

const j=empty();j.origins=[{id:'o1',regionId:'R_1_1',startTime:0,infectedCount:100,duration:1,enabled:true}];j.jumps=[{id:'j1',sourceRegionId:'R_1_1',targetRegionId:'R_7_7',startTime:2,probability:1,infectedCount:20,recurring:false,interval:5,enabled:true}];const rj=run(j,{...sim,gamma:0});
assert(rj.eventLog.some(e=>e.type==='jump_executed'&&e.jumpId==='j1'&&e.infectedIntroduced>0),'Salto não adjacente é executado e registrado');
assert(rj.history[2].get('R_7_7').infected>0,'Salto semeia infectados no destino');

// Regional vaccination barrier
const lineGrid={rows:1,columns:3,defaultPopulation:1000,randomizePopulation:false,neighborhood:'von_neumann',borderMode:'normal'};
const blocked=empty();blocked.origins=[{id:'o',regionId:'R_1_1',startTime:0,infectedCount:200,duration:1,enabled:true}];blocked.vaccinationBarriers=[{id:'b',regionId:'R_1_2',vaccinationCoverage:100,enabled:true}];
const rb=run(blocked,{...sim,timeSteps:18,beta:.7,gamma:0,mobility:1,initialVaccinationPct:0,initialVaccinationVariationPct:0},lineGrid,createGrid(1,3,lineGrid));
assert(rb.history[0].get('R_1_2').vaccinated===1000&&rb.history[0].get('R_1_2').susceptible===0,'Bloqueio 100% converte a região em totalmente vacinada');
assert(rb.history.every(fr=>fr.get('R_1_2').infected===0&&fr.get('R_1_3').infected===0),'Região 100% vacinada bloqueia a propagação através do corredor');

const partial=empty();partial.vaccinationBarriers=[{id:'b',regionId:'R_1_2',vaccinationCoverage:65,enabled:true}];
const partialInit=buildInitialRegions(createGrid(1,3,lineGrid),{...sim,initialVaccinationPct:0,initialVaccinationVariationPct:0},partial);
assert(partialInit.get('R_1_2').vaccinated===650&&partialInit.get('R_1_2').susceptible===350,'Bloqueio parcial define a cobertura vacinal regional solicitada');

// Susceptible path effect
const pathGrid={rows:1,columns:3,defaultPopulation:5000,randomizePopulation:false,neighborhood:'von_neumann',borderMode:'normal'};
const baseProp=empty();baseProp.origins=[{id:'o',regionId:'R_1_1',startTime:0,infectedCount:120,duration:1,enabled:true}];
const pathProp=structuredClone(baseProp);pathProp.pathRegions=[{id:'p',regionId:'R_1_2',susceptibilityMultiplier:4,enabled:true}];
const baseRun=run(baseProp,{...sim,seed:808,timeSteps:8,beta:.22,gamma:0,mobility:.38,initialVaccinationPct:0,initialVaccinationVariationPct:0},pathGrid,createGrid(1,3,pathGrid));
const pathRun=run(pathProp,{...sim,seed:808,timeSteps:8,beta:.22,gamma:0,mobility:.38,initialVaccinationPct:0,initialVaccinationVariationPct:0},pathGrid,createGrid(1,3,pathGrid));
const baseMid=Math.max(...baseRun.history.map(fr=>fr.get('R_1_2').infected));
const pathMid=Math.max(...pathRun.history.map(fr=>fr.get('R_1_2').infected));
assert(pathRun.history[0].get('R_1_2').pathSusceptibilityMultiplier===4,'Região de caminho recebe o multiplicador de suscetibilidade configurado');
assert(pathMid>baseMid,'Caminho com maior suscetibilidade aumenta a propagação na região marcada');

// Direction remains independent of path/block semantics
const strict=empty();strict.direction={enabled:true,direction:'west_to_east',directionProfile:'strict',coneAngle:20,directionStrength:6,forwardWeight:1,lateralLeak:0,backwardLeak:0,diagonalPenalty:0};strict.origins=[{id:'o',regionId:'R_4_2',startTime:0,infectedCount:100,duration:1,enabled:true}];const rs=run(strict,{...sim,timeSteps:28,beta:.45,gamma:.05,mobility:1,initialVaccinationPct:0,initialVaccinationVariationPct:0});let forward=0,offAxis=0,backward=0;for(const [id,r] of rs.history[25]){const [,row,col]=id.split('_').map(Number);if(row===4&&col>2)forward+=r.infected;if(row!==4)offAxis+=r.infected;if(col<2)backward+=r.infected;}
assert(forward>0&&offAxis===0&&backward===0,'Perfil estrito impede propagação lateral e reversa');

const graph=buildWeightedEdges(grid,createGrid(7,7,grid),empty());
const outgoing=graph.outgoingMap.get('R_4_4');
assert(outgoing.length===8&&Math.abs(outgoing.reduce((s,x)=>s+x.weight,0)-1)<1e-12,'Grafo espacial radial mantém pesos normalizados');

const custom=createGrid(3,3,{...grid,rows:3,columns:3});const region=custom.get('R_2_2');region.initialConditionMode='manual';region.infected=15;region.recovered=10;region.vaccinated=25;region.susceptible=1150;region.localParameters.betaMultiplier=.5;region.localParameters.susceptibilityMultiplier=1.7;const rc=run(empty(),{...sim,timeSteps:2}, {...grid,rows:3,columns:3},custom);
assert(rc.history[0].get('R_2_2').infected===15&&rc.history[0].get('R_2_2').vaccinated===25,'Condições iniciais manuais por região são preservadas na execução');
assert(rc.history[0].get('R_2_2').localParameters.susceptibilityMultiplier===1.7,'Suscetibilidade local manual é preservada');

const mockRun={id:'run-test',seed:sim.seed,history:rs.history,eventLog:rs.eventLog,edges:rs.edges,regions:[...rs.initialRegions.values()]};mockRun.summary=analyzeRun(mockRun,new Map(mockRun.regions.map(r=>[r.id,r])),{arrivalThreshold:2});
assert(mockRun.summary.reachedRegions>1&&mockRun.summary.peakRegion.regionId,'Análises automáticas calculam cobertura e pico regional');
assert(mockRun.summary.observedDirection.direction==='east','Análise automática reconhece direção observada leste');

const serialized=serializeRun(mockRun),restored=deserializeRun(serialized);assert(restored.history[0] instanceof Map&&restored.history.length===mockRun.history.length,'Execuções podem ser serializadas e reabertas');
const mockState={project:{name:'Teste',schemaVersion:'4.2.0'},grid,simulationConfig:sim,propagation:strict,regions:initA,analysisOptions:{arrivalThreshold:2,referenceRegionId:null},dirty:false,runs:[mockRun]};const pj=projectJSON(mockState,true);
assert(pj.includes('"schemaVersion": "4.2.0"')&&pj.includes('initialVaccinationPct')&&!pj.includes('groundTruth'),'Projeto 4.2 salva seed, condições iniciais e não contém atividades');
assert(temporalCSV(mockRun).includes('path_susceptibility_multiplier')&&eventsCSV(mockRun).includes('origin_injected'),'Exportação temporal inclui modificadores regionais e eventos reais');
assert(edgesCSV(mockRun).includes('effectiveWeight')&&regionsCSV(mockRun).includes('initial_vaccinated_pct'),'Exportações de arestas e regiões incluem condições iniciais');

const html=fs.readFileSync(new URL('../index.html', import.meta.url),'utf8');
const appSource=fs.readFileSync(new URL('../js/app.js', import.meta.url),'utf8');
assert(html.includes('Condições iniciais geradas pela semente')&&html.includes('Vacinação média inicial'),'Interface explica a geração S/V pela semente');
assert(html.includes('Suscetibilidade do caminho')&&html.includes('Vacinação do bloqueio'),'Interface expõe o efeito de caminho e bloqueio');
assert(appSource.includes('addVaccinationBarrier')&&appSource.includes('addPathRegion'),'Ferramentas do grid usam propriedades regionais');

console.log(`\nRESUMO: ${passed} passaram; ${failed} falharam.`);if(failed)process.exitCode=1;
