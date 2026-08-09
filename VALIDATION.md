# Validação — Propagation Studio 4.4.0

## Automatizada

`npm test`: 37 testes aprovados, 0 falhas.

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
- exportação GeoJSON.

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
