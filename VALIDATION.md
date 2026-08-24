# Validação — Propagation Studio 4.4.2

## Automatizada

`npm test`: 51 testes aprovados, 0 falhas.

Cobertura relevante:

- heterogeneidade S/V reproduzível por seed;
- conservação populacional;
- origens, focos e saltos;
- bloqueio vacinal parcial e total;
- bloqueio total impedindo travessia espacial;
- caminhos de maior suscetibilidade;
- anisotropia direcional;
- mapa sintético reproduzível por seed espacial;
- validação e normalização de GeoJSON;
- seleção de ID/nome/população;
- adjacência por fronteira compartilhada;
- bloqueio total em mapas;
- exportação GeoJSON;
- serialização/desserialização de execuções com nome e configuração;
- compatibilidade com históricos 4.x em arrays, pares e objetos por região;
- resolução de IDs duplicados em execuções importadas;
- exclusão segura da execução selecionada;
- geração de ZIP a partir de uma execução restaurada;
- consistência entre IDs referenciados em `app.js` e elementos presentes no HTML;
- JSZip vendorizado para execução estática no GitHub Pages;
- seleção de execução ativando o snapshot completo para reprodução;
- retorno automático ao cenário atual quando ele é editado;
- Play e navegação temporal reativando o snapshot selecionado;
- renderer usando espaço, grid, regiões e propagação próprios de cada execução.

## Verificações estáticas

- todos os módulos JavaScript passam em `node --check`;
- nenhum seletor `#id` usado por `app.js` aponta para elemento ausente;
- nenhum import local quebrado;
- IDs HTML sem duplicação.

## Limitações conhecidas

- a adjacência por fronteira faz comparações geométricas no navegador e pode ficar lenta com centenas de polígonos muito detalhados;
- GeoJSON com `Point`, `LineString` e `GeometryCollection` não é aceito nesta versão;
- GeoJSON com fronteiras numericamente incompatíveis pode produzir regiões isoladas; nesses casos use **Vizinhos mais próximos**;
- a visualização usa projeção cartesiana simples do bounding box e não substitui um GIS para análise cartográfica de precisão;
- a tentativa de automação visual por Chromium headless não concluiu neste ambiente por restrições do processo do navegador; a validação visual final deve ser feita em um navegador local.
