import assert from 'node:assert/strict';
import fs from 'node:fs';
import { buildTechniqueStimulus } from '../js/visualization/technique-data.js';
import { hilbertOrder, ahcWardOrder, projectionOrder } from '../js/visualization/technique-ordering.js';
import { describeRun, assemblePdf, configurationReportDocumentHtml, runConfigurationMiniature } from '../js/export/report-pdf.js';

let passed=0;
function test(name,fn){try{fn();passed++;console.log(`[PASSOU] ${name}`);}catch(e){console.error(`[FALHOU] ${name}`);throw e;}}

const regions=[
  {id:'R_1_1',name:'A',row:1,column:1,population:100,spatialX:1,spatialY:1},
  {id:'R_1_2',name:'B',row:1,column:2,population:200,spatialX:2,spatialY:1},
  {id:'R_2_1',name:'C',row:2,column:1,population:100,spatialX:1,spatialY:2},
  {id:'R_2_2',name:'D',row:2,column:2,population:100,spatialX:2,spatialY:2},
];
const frame=(vals)=>new Map(regions.map((r,i)=>[r.id,{...r,infected:vals[i],susceptible:r.population-vals[i],recovered:0,vaccinated:0}]));
const run={id:'run-test',name:'Teste',space:{mode:'grid'},grid:{rows:2,columns:2,neighborhood:'moore',borderMode:'normal'},regions,history:[frame([0,0,0,0]),frame([10,20,0,0]),frame([30,100,10,0])],edges:[]};

test('Adaptador omite t=0 e preserva t=1..N como no plot-evalution',()=>{
  const s=buildTechniqueStimulus(run);assert.equal(s.timeSteps,2);assert.deepEqual(s.frameTimes,[1,2]);
});

test('Sinal visual é percentual infectado/população em escala fixa 0–100',()=>{
  const s=buildTechniqueStimulus(run);assert.deepEqual(s.series.R_1_1,[10,30]);assert.deepEqual(s.series.R_1_2,[10,50]);assert.equal(s.maxValue,100);
});

test('Grafo Moore mantém vizinhança espacial para a projeção ligada ao mini-mapa',()=>{
  const s=buildTechniqueStimulus(run);assert.deepEqual(new Set(s.neighborGraph.R_1_1),new Set(['R_1_2','R_2_1','R_2_2']));
});

test('Ordenação Gilbert/Hilbert inclui cada célula exatamente uma vez',()=>{
  const order=hilbertOrder(regions,{rows:2,columns:2});assert.equal(order.length,4);assert.equal(new Set(order).size,4);assert.deepEqual(new Set(order),new Set(regions.map(r=>r.id)));
});

test('Ordenação espacial AHC inclui cada região de mapa exatamente uma vez',()=>{
  const mapRegs=regions.map((r,i)=>({...r,id:`M${i}`,displayCentroid:{x:r.spatialX+.1*i,y:r.spatialY}}));const order=ahcWardOrder(mapRegs);assert.equal(order.length,mapRegs.length);assert.equal(new Set(order).size,mapRegs.length);
});

test('projectionOrder usa a ordenação de grid no cenário regular',()=>{
  const s=buildTechniqueStimulus(run);const order=projectionOrder(s);assert.equal(order.length,4);assert.equal(new Set(order).size,4);
});

test('Interface separa Construir cenário e Visualizar execuções em workspaces',()=>{
  const html=fs.readFileSync(new URL('../index.html',import.meta.url),'utf8');
  assert.match(html,/data-workspace-mode="build"/);
  assert.match(html,/data-workspace-mode="visualize"/);
  assert.match(html,/id="visualization-run-select"/);
});

test('Workspace de visualização expõe as quatro técnicas disponíveis',()=>{
  const html=fs.readFileSync(new URL('../index.html',import.meta.url),'utf8');
  for(const mode of ['animation','small_multiples','projection1d','glyph']) assert.match(html,new RegExp(`data-visualization-mode="${mode}"`));
  assert.doesNotMatch(html,/data-visualization-mode="scenario"/);
  assert.match(html,/id="technique-view"/);
});

test('App integra workspace visual e visualizador comparativo sem substituir o simulador',()=>{
  const app=fs.readFileSync(new URL('../js/app.js',import.meta.url),'utf8');
  assert.match(app,/ComparativeViewer/);
  assert.match(app,/setWorkspaceMode\('visualize'/);
  assert.match(app,/setVisualizationMode/);
  assert.match(app,/runSIRVSimulation/);
});


test('Workspace visual mantém legenda fixa compartilhada e retorno explícito ao cenário',()=>{
  const html=fs.readFileSync(new URL('../index.html',import.meta.url),'utf8');
  assert.match(html,/id="btn-back-to-build"/);
  assert.match(html,/class="visualization-fixed-legend"/);
  assert.match(html,/Infectados \(%\)/);
});

test('Visualização oferece inspeção contextual de região sem retornar ao editor',()=>{
  const html=fs.readFileSync(new URL('../index.html',import.meta.url),'utf8');
  const app=fs.readFileSync(new URL('../js/app.js',import.meta.url),'utf8');
  assert.match(html,/id="visualization-inspector"/);
  assert.match(app,/renderVisualizationInspector/);
});

test('Animação comparativa expõe controles temporais completos',()=>{
  const viewer=fs.readFileSync(new URL('../js/visualization/comparative-viewer.js',import.meta.url),'utf8');
  for(const action of ['first','back','play','forward','last']) assert.ok(viewer.includes(`data-tech-action=\"${action}\"`));
});

test('Small multiples preserva todos os instantes e oferece apenas ajuste de tamanho',()=>{
  const viewer=fs.readFileSync(new URL('../js/visualization/comparative-viewer.js',import.meta.url),'utf8');
  assert.ok(viewer.includes('data-small-size-slider'));
  assert.ok(viewer.includes('min=\"90\"'));
  assert.ok(viewer.includes('max=\"320\"'));
  assert.ok(viewer.includes('--small-card-size'));
  assert.match(viewer,/stimulus\.frameTimes\.map/);
});



test('Glifo segue o desenho temporal descrito no artigo',()=>{
  const viewer=fs.readFileSync(new URL('../js/visualization/comparative-viewer.js',import.meta.url),'utf8');
  assert.match(viewer,/renderGlyph\(stimulus\)/);
  assert.ok(viewer.includes('data-glyph-time-slider'));
  assert.ok(viewer.includes('pe-glyph-cell'));
  assert.ok(viewer.includes('time-selected'));
  assert.ok(viewer.includes('layoutGlyphs'));
  assert.match(viewer,/stimulus\.series\[region\.id\]/);
});

test('Glifo usa mapa único e destaque temporal global, sem recalcular a simulação',()=>{
  const viewer=fs.readFileSync(new URL('../js/visualization/comparative-viewer.js',import.meta.url),'utf8');
  const app=fs.readFileSync(new URL('../js/app.js',import.meta.url),'utf8');
  assert.ok(viewer.includes('pe-glyph-map'));
  assert.ok(viewer.includes('pe-glyph-layer'));
  assert.ok(viewer.includes('.pe-glyph-cell[data-time-index'));
  assert.match(app,/\['animation', 'small_multiples', 'projection1d', 'glyph'\]/);
  assert.match(app,/runSIRVSimulation/);
});


test('Relatório PDF descreve espaço, simulação e eventos da execução',()=>{
  const sample={...run,createdAt:'2026-09-24T12:00:00.000Z',status:'review',notes:'Observação de teste',seed:42,simulationConfig:{seed:42,timeSteps:2,beta:.2,gamma:.1,nu:.01,mobility:.3,localTransmissionWeight:.6,spatialTransmissionWeight:.4,parameterNoise:0,initialVaccinationPct:5,initialVaccinationVariationPct:1,temporalUnit:'dia'},propagation:{origins:[{regionId:'R_1_1',startTime:0,infectedCount:20,duration:1}],focuses:[{regionId:'R_2_2',startTime:4,infectedCount:10,duration:1}],jumps:[],vaccinationBarriers:[],paths:[{regionIds:['R_1_1','R_1_2']}],pathRegions:[],pathSettings:{susceptibilityMultiplier:2},direction:{enabled:true,direction:'radial',directionProfile:'cone',directionStrength:1}}};
  const d=describeRun(sample);assert.ok(d.spaceLines.some(x=>x.includes('Grid')));assert.equal(d.origins.length,1);assert.equal(d.focuses.length,1);assert.equal(d.paths.length,1);assert.ok(d.simLines.some(x=>x.includes('β=0.2')));
});

test('Relatório visual consolidado usa o mapa de configurações das execuções',()=>{
  const html=fs.readFileSync(new URL('../index.html',import.meta.url),'utf8');
  const app=fs.readFileSync(new URL('../js/app.js',import.meta.url),'utf8');
  const report=fs.readFileSync(new URL('../js/export/report-pdf.js',import.meta.url),'utf8');
  assert.match(html,/id="btn-export-report-pdf"/);
  assert.match(html,/Relatório visual das execuções/);
  assert.match(app,/generateRunsPdf/);
  assert.match(report,/configurationReportDocumentHtml/);
  assert.match(report,/runConfigurationMiniature/);
  assert.match(report,/report-grid/);
  assert.match(report,/Imprimir \/ Salvar PDF/);
  assert.match(report,/run\?\.notes|run\.notes/);
});

test('Mapa de configuração desenha origem, caminho e bloqueio do snapshot salvo',()=>{
  const sample={...run,simulationConfig:{timeSteps:30,beta:.34,gamma:.1,nu:0,mobility:.32,seed:12345},propagation:{origins:[{regionId:'R_1_1',enabled:true}],focuses:[],jumps:[],vaccinationBarriers:[{regionId:'R_2_2',vaccinationCoverage:100,enabled:true}],paths:[{regionIds:['R_1_1','R_1_2'],enabled:true}],pathRegions:[],direction:{enabled:true,direction:'west_to_east'}},notes:'Observação de teste'};
  const svg=runConfigurationMiniature(sample);assert.match(svg,/report-mini-space/);assert.match(svg,/polyline/);assert.match(svg,/circle/);assert.match(svg,/×/);
  const doc=configurationReportDocumentHtml({name:'Experimento'},[sample],{generatedAt:'agora'});assert.match(doc,/Teste/);assert.match(doc,/Observação de teste/);assert.match(doc,/Oeste → Leste/);assert.match(doc,/30 passos/);
});

test('Montador PDF gera Blob PDF sem dependência externa',()=>{
  const blob=assemblePdf([{jpegBytes:new Uint8Array([255,216,255,217]),widthPx:1,heightPx:1,pdfWidth:595.28,pdfHeight:841.89}]);assert.equal(blob.type,'application/pdf');assert.ok(blob.size>200);
});

console.log(`RESUMO VISUALIZAÇÕES: ${passed} passaram; 0 falharam.`);
