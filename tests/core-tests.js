import fs from 'node:fs';
import JSZip from 'jszip';
import { createGrid } from '../js/spatial/grid.js';
import { runSIRVSimulation } from '../js/simulation/sirv.js';
import { buildWeightedEdges } from '../js/spatial/edges.js';
import { buildInitialRegions } from '../js/simulation/initial-conditions.js';
import { analyzeRun } from '../js/analytics/summary.js';
import { projectJSON, runJSON, temporalCSV, eventsCSV, edgesCSV, regionsCSV, regionsGeoJSON, serializeRun, deserializeRun, deserializeRuns } from '../js/export/files.js';
import { createSyntheticMap } from '../js/spatial/map/synthetic-map.js';
import { AppState } from '../js/state.js';
import { validateGeoJSON, normalizeGeoJSON, buildGeoJSONTopology } from '../js/spatial/map/geojson.js';

let passed=0,failed=0;
const assert=(c,n)=>{if(c){console.log(`[PASSOU] ${n}`);passed++;}else{console.error(`[FALHOU] ${n}`);failed++;}};
const grid={rows:7,columns:7,defaultPopulation:1200,randomizePopulation:false,neighborhood:'moore',borderMode:'normal'};
const sim={seed:12345,timeSteps:45,beta:.38,gamma:.08,nu:0,mobility:.65,localTransmissionWeight:1,spatialTransmissionWeight:1,parameterNoise:0,temporalUnit:'dia',initialVaccinationPct:15,initialVaccinationVariationPct:10};
const direction={enabled:true,direction:'radial',directionProfile:'cone',coneAngle:35,directionStrength:5,forwardWeight:1,lateralLeak:.03,backwardLeak:0,diagonalPenalty:.85};
const empty=()=>({origins:[],focuses:[],jumps:[],vaccinationBarriers:[],pathRegions:[],paths:[],pathSettings:{susceptibilityMultiplier:2.5},barrierSettings:{vaccinationCoverage:100},direction:{...direction}});
const run=(propagation,s=sim,g=grid,regions=createGrid(g.rows,g.columns,g))=>runSIRVSimulation({gridConfig:g,simulationConfig:s,regions,propagation});
console.log('=== TESTES PROPAGATION STUDIO 4.4 ===');

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

const namedMockRun={...mockRun,name:'Execução A',simulationConfig:{...sim},grid:{...grid},space:{mode:'grid'},propagation:strict,status:'approved',notes:'nota'};
const serialized=serializeRun(namedMockRun),restored=deserializeRun(serialized);assert(restored.history[0] instanceof Map&&restored.history.length===mockRun.history.length,'Execuções podem ser serializadas e reabertas');
assert(restored.name==='Execução A'&&restored.simulationConfig.beta===sim.beta&&restored.status==='approved'&&restored.notes==='nota','Nome, configuração e metadados da execução sobrevivem ao salvamento/importação');
const legacyFrameObject={id:'legacy-object',history:[Object.fromEntries([...rs.history[0].entries()].slice(0,3))],regions:mockRun.regions};
const restoredLegacyObject=deserializeRun(legacyFrameObject,{simulationConfig:sim,grid,space:{mode:'grid'},propagation:strict});
assert(restoredLegacyObject.history[0] instanceof Map&&restoredLegacyObject.history[0].size===3,'Importação aceita frames legados salvos como objeto por região');
const legacyPairEntries={id:'legacy-pairs',history:[[...rs.history[0].entries()].slice(0,2)],regions:mockRun.regions};
const restoredLegacyPairs=deserializeRun(legacyPairEntries,{simulationConfig:sim,grid,space:{mode:'grid'},propagation:strict});
assert(restoredLegacyPairs.history[0] instanceof Map&&restoredLegacyPairs.history[0].size===2,'Importação aceita frames legados salvos como pares [região, estado]');
const restoredCollection=deserializeRuns([{...serialized,id:'dup'},{...serialized,id:'dup',name:'Segunda'}],{simulationConfig:sim,grid,space:{mode:'grid'},propagation:strict});
assert(restoredCollection.runs.length===2&&restoredCollection.runs[0].id!==restoredCollection.runs[1].id,'Importação resolve IDs duplicados de execuções sem quebrar a seleção');
const runState=new AppState();runState.runs=[{id:'a',history:[new Map()]},{id:'b',history:[new Map()]}];runState.selectedRunId='a';runState.currentTimeStep=7;runState.isPlaying=true;runState.removeRun('a');
assert(runState.selectedRunId==='b'&&runState.currentTimeStep===0&&!runState.isPlaying,'Excluir a execução selecionada escolhe outra execução e reinicia a reprodução com segurança');
const zipCheck=new JSZip();zipCheck.file('simulation.json',runJSON(restored));zipCheck.file('temporal.csv',temporalCSV(restored));const zipBuffer=await zipCheck.generateAsync({type:'nodebuffer',compression:'DEFLATE'});
assert(zipBuffer.length>100,'Execução restaurada pode ser compactada em ZIP após a importação');
const mockState={project:{name:'Teste',schemaVersion:'4.4.0'},space:{mode:'grid',synthetic:{},geojson:{}},grid,simulationConfig:sim,propagation:strict,regions:initA,analysisOptions:{arrivalThreshold:2,referenceRegionId:null},dirty:false,runs:[namedMockRun],selectedRunId:'run-test',currentTimeStep:3};const pj=projectJSON(mockState,true);
assert(pj.includes('\"schemaVersion\": \"4.4.0\"')&&pj.includes('initialVaccinationPct')&&!pj.includes('groundTruth'),'Projeto 4.4 salva espaço, seed e condições iniciais sem atividades');
assert(pj.includes('\"selectedRunId\": \"run-test\"')&&pj.includes('\"currentTimeStep\": 3')&&pj.includes('\"name\": \"Execução A\"'),'Projeto preserva seleção, instante e nome das execuções ao salvar');
assert(temporalCSV(mockRun).includes('path_susceptibility_multiplier')&&eventsCSV(mockRun).includes('origin_injected'),'Exportação temporal inclui modificadores regionais e eventos reais');
assert(edgesCSV(mockRun).includes('effectiveWeight')&&regionsCSV(mockRun).includes('initial_vaccinated_pct'),'Exportações de arestas e regiões incluem condições iniciais');



// Spatial maps
const syntheticA=createSyntheticMap({regionCount:24,spatialSeed:99,irregularity:.9,defaultPopulation:900});
const syntheticB=createSyntheticMap({regionCount:24,spatialSeed:99,irregularity:.9,defaultPopulation:900});
assert(syntheticA.size===24&&[...syntheticA.values()].every(r=>r.geometry?.type==='Polygon'),'Mapa sintético gera polígonos para todas as regiões');
assert(JSON.stringify([...syntheticA.values()].map(r=>r.geometry))===JSON.stringify([...syntheticB.values()].map(r=>r.geometry)),'Seed espacial reproduz exatamente o mapa sintético');
assert([...syntheticA.values()].every(r=>(r.neighbors||[]).length>0),'Mapa sintético gera topologia conectada sem regiões isoladas no exemplo');

const simpleGeo={type:'FeatureCollection',features:[
 {type:'Feature',properties:{code:'A',name:'Alpha',pop:1000},geometry:{type:'Polygon',coordinates:[[[0,0],[1,0],[1,1],[0,1],[0,0]]]}},
 {type:'Feature',properties:{code:'B',name:'Beta',pop:1200},geometry:{type:'Polygon',coordinates:[[[1,0],[2,0],[2,1],[1,1],[1,0]]]}},
 {type:'Feature',properties:{code:'C',name:'Gamma',pop:800},geometry:{type:'Polygon',coordinates:[[[2,0],[3,0],[3,1],[2,1],[2,0]]]}}
]};
const info=validateGeoJSON(simpleGeo);assert(info.features.length===3&&info.propertyKeys.includes('name'),'GeoJSON válido é reconhecido e seus atributos são listados');
let geoRegions=normalizeGeoJSON(simpleGeo,{idProperty:'code',nameProperty:'name',populationProperty:'pop'},{defaultPopulation:500});
const topo=buildGeoJSONTopology(geoRegions,{method:'shared_border'});geoRegions=topo.regions;
assert(geoRegions.get('A').name==='Alpha'&&geoRegions.get('B').population===1200,'Importação usa campos escolhidos de ID, nome e população');
assert(geoRegions.get('A').neighbors.includes('B')&&geoRegions.get('B').neighbors.includes('C')&&!geoRegions.get('A').neighbors.includes('C'),'Fronteiras compartilhadas criam adjacência correta no mapa importado');
const mapProp=empty();mapProp.origins=[{id:'o',regionId:'A',startTime:0,infectedCount:180,duration:1,enabled:true}];mapProp.vaccinationBarriers=[{id:'blk',regionId:'B',vaccinationCoverage:100,enabled:true}];
const mapRun=runSIRVSimulation({spaceConfig:{mode:'geojson'},simulationConfig:{...sim,timeSteps:14,beta:.8,gamma:0,mobility:1,initialVaccinationPct:0,initialVaccinationVariationPct:0},regions:geoRegions,propagation:mapProp});
assert(mapRun.history.every(f=>f.get('B').infected===0&&f.get('C').infected===0),'Bloqueio 100% também remove a passagem espacial em mapas');
const geoRun={id:'geo-run',seed:1,space:{mode:'geojson'},history:mapRun.history,eventLog:mapRun.eventLog,edges:mapRun.edges,regions:[...mapRun.initialRegions.values()],summary:{arrivals:{A:0,B:null,C:null},regionPeaks:{A:{time:0,infected:180},B:{time:0,infected:0},C:{time:0,infected:0}}}};
assert(regionsGeoJSON(geoRun)?.includes('FeatureCollection')&&regionsGeoJSON(geoRun).includes('Alpha'),'Execução geográfica exporta regions.geojson preservando nomes e geometrias');

const html=fs.readFileSync(new URL('../index.html', import.meta.url),'utf8');
const appSource=fs.readFileSync(new URL('../js/app.js', import.meta.url),'utf8');
assert(html.includes('Condições iniciais geradas pela semente')&&html.includes('Vacinação média inicial'),'Interface explica a geração S/V pela semente');
assert(html.includes('Suscetibilidade do caminho')&&html.includes('Vacinação do bloqueio'),'Interface expõe o efeito de caminho e bloqueio');
assert(appSource.includes('addVaccinationBarrier')&&appSource.includes('startPath')&&appSource.includes('extendPath'),'Ferramentas espaciais suportam caminhos ramificados com propriedades regionais');
assert(html.includes('Mapa sintético')&&html.includes('Importar mapa real')&&appSource.includes('normalizeGeoJSON'),'Interface oferece Grid, mapa sintético e importação GeoJSON');
const referencedIds=[...appSource.matchAll(/\$\('#([^']+)'\)/g)].map(m=>m[1]);const missingIds=[...new Set(referencedIds)].filter(id=>!html.includes(`id=\"${id}\"`));
assert(missingIds.length===0,`Todos os IDs acessados diretamente pelo app existem no HTML${missingIds.length?`: ${missingIds.join(', ')}`:''}`);
assert(html.includes('Configuração desta execução')&&appSource.includes('renderRunConfiguration'),'Execução selecionada mostra a configuração salva no próprio run');
const branchingRendererSource=fs.readFileSync(new URL('../js/visualization/grid-renderer.js', import.meta.url),'utf8');
assert(branchingRendererSource.includes('propagation.paths')&&branchingRendererSource.includes('path.regionIds'),'Renderer desenha cada caminho separadamente, sem ligar ramificações distintas');
assert(html.includes('./js/vendor/jszip.min.js')&&!html.includes('./node_modules/jszip/dist/jszip.min.js'),'Download ZIP usa biblioteca vendorizada e portátil para GitHub Pages');

const playbackState=new AppState();
playbackState.runs=[{id:'run-a',name:'Exemplo A',history:[new Map(),new Map()],space:{mode:'grid'},grid:{rows:2,columns:3},regions:[{id:'R_1_1'}],propagation:empty()}];
playbackState.selectRun('run-a');
assert(playbackState.selectedRunId==='run-a'&&playbackState.viewingRunId==='run-a'&&playbackState.viewRun()?.name==='Exemplo A','Clicar em uma execução ativa o snapshot completo para reprodução');
playbackState.updateSimulation({beta:.5});
assert(playbackState.selectedRunId==='run-a'&&playbackState.viewingRunId===null,'Editar o cenário atual sai da visualização da execução sem perder sua seleção');



// Multiple susceptible paths can branch from the same origin/focus.
const branchedPathState=new AppState(), branchOriginId='R_4_4';
branchedPathState.addOrigin(branchOriginId);
const branchOrigin=branchedPathState.propagation.origins.find(o=>o.regionId===branchOriginId);
const firstPath=branchedPathState.startPath(branchOriginId,{sourceType:'origin',sourceEventId:branchOrigin.id});
branchedPathState.extendPath(firstPath.id,'R_4_5');
branchedPathState.extendPath(firstPath.id,'R_4_6');
const secondPath=branchedPathState.startPath(branchOriginId,{sourceType:'origin',sourceEventId:branchOrigin.id});
branchedPathState.extendPath(secondPath.id,'R_5_4');
branchedPathState.extendPath(secondPath.id,'R_6_4');
assert(branchedPathState.propagation.paths.length===2&&branchedPathState.propagation.paths[0].regionIds.join(',')==='R_4_4,R_4_5,R_4_6'&&branchedPathState.propagation.paths[1].regionIds.join(',')==='R_4_4,R_5_4,R_6_4','Uma mesma origem pode iniciar vários caminhos independentes');
assert(branchedPathState.propagation.pathRegions.filter(p=>p.regionId===branchOriginId).length===1&&branchedPathState.propagation.pathRegions.length===5,'Regiões compartilhadas entre caminhos mantêm um único modificador epidemiológico');

const preservedRunsState=new AppState();
preservedRunsState.runs=[{id:'run-kept',name:'Mantida',history:[new Map()],space:{mode:'grid'},grid:{...preservedRunsState.grid},simulationConfig:{...preservedRunsState.simulationConfig},regions:[...preservedRunsState.regions.values()].map(r=>structuredClone(r)),propagation:empty()}];
preservedRunsState.selectedRunId='run-kept';
preservedRunsState.viewingRunId='run-kept';
preservedRunsState.rebuildSyntheticMap({regionCount:12,spatialSeed:81,irregularity:.4,defaultPopulation:700});
assert(preservedRunsState.runs.length===1&&preservedRunsState.runs[0].id==='run-kept'&&preservedRunsState.selectedRunId==='run-kept'&&preservedRunsState.viewingRunId===null,'Trocar Grid/Mapa preserva o histórico de execuções e apenas sai da visualização ativa');

const restoreState=new AppState(), restorePropagation=empty(), restoreRegion=structuredClone([...restoreState.regions.values()][0]);
restorePropagation.origins=[{id:'origin-snapshot',regionId:restoreRegion.id,startTime:0,infectedCount:33,duration:1,enabled:true}];
restorePropagation.direction.forwardWeight=.73;
const savedSnapshot={id:'run-snapshot',name:'Snapshot',history:[new Map()],space:{...structuredClone(restoreState.space),mode:'grid',sourceLabel:'Grid salvo'},grid:{...restoreState.grid,rows:11,columns:13},simulationConfig:{...restoreState.simulationConfig,seed:987,beta:.61,timeSteps:77},regions:[{...restoreRegion,population:4321}],propagation:restorePropagation};
restoreState.runs=[savedSnapshot];
restoreState.grid={...restoreState.grid,rows:3,columns:4};
restoreState.simulationConfig={...restoreState.simulationConfig,seed:1,beta:.05,timeSteps:5};
restoreState.propagation=empty();
restoreState.selectRun('run-snapshot');
assert(restoreState.grid.rows===11&&restoreState.grid.columns===13&&restoreState.simulationConfig.seed===987&&restoreState.simulationConfig.beta===.61&&restoreState.simulationConfig.timeSteps===77&&restoreState.propagation.origins[0]?.infectedCount===33&&restoreState.regions.get(restoreRegion.id)?.population===4321&&!restoreState.dirty,'Selecionar uma execução restaura espaço, simulação, propagação e regiões do snapshot salvo');
restoreState.updateSimulation({beta:.19});
restoreState.updateDirection({forwardWeight:.11});
restoreState.regions.get(restoreRegion.id).population=99;
assert(savedSnapshot.simulationConfig.beta===.61&&savedSnapshot.propagation.direction.forwardWeight===.73&&savedSnapshot.regions[0].population===4321,'Editar o Studio após restaurar uma execução não altera o snapshot histórico');
const rendererSource=fs.readFileSync(new URL('../js/visualization/grid-renderer.js', import.meta.url),'utf8');
assert(rendererSource.includes('viewRun()')&&rendererSource.includes('viewGrid()')&&rendererSource.includes('viewPropagation()')&&rendererSource.includes('viewRegions()'),'Renderer usa espaço, grid, regiões e propagação do snapshot selecionado');
const animationSource=fs.readFileSync(new URL('../js/visualization/animation.js', import.meta.url),'utf8');
assert(animationSource.includes('ensureRunView')&&animationSource.includes('activateRunView'),'Play e navegação temporal reativam automaticamente o snapshot da execução selecionada');

console.log(`\nRESUMO: ${passed} passaram; ${failed} falharam.`);if(failed)process.exitCode=1;
