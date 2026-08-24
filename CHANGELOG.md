# Changelog

## 4.4.2

- Selecionar uma execução agora ativa um modo de reprodução baseado no snapshot completo daquela execução.
- O Canvas usa `run.space`, `run.grid`, `run.regions` e `run.propagation`, além de `run.history`, durante a visualização.
- Execuções importadas com configurações espaciais diferentes do cenário atual podem ser selecionadas e reproduzidas corretamente.
- Play, passo a passo e linha do tempo reativam automaticamente o snapshot da execução selecionada.
- Ao editar o cenário atual, a visualização sai do snapshot sem perder a execução selecionada para download/análise.
- O painel Região passa a mostrar o estado S/I/R/V do instante atual da execução em modo somente leitura.
- Rótulo do Canvas indica o nome e as dimensões/tipo espacial da execução em reprodução.
- Análises e nomes de regiões passam a usar os metadados salvos na própria execução.

## 4.4.1

- Corrigida a importação de projetos com execuções salvas após a remoção dos botões individuais de exportação.
- `renderRuns()` não referencia mais o elemento removido `#btn-export-geojson`.
- Seleção e renomeação de execuções foram separadas; renomear agora usa um botão próprio.
- Adicionado painel **Configuração desta execução** com o snapshot de espaço, seed, SIRV e propagação.
- Desserialização de execuções ficou tolerante a formatos 4.x legados de histórico e regiões.
- IDs duplicados de execuções importadas são normalizados sem quebrar a seleção.
- Projeto salvo passa a preservar `selectedRunId` e `currentTimeStep`.
- Exclusão da execução selecionada reinicia com segurança a reprodução e seleciona a próxima execução disponível.
- JSZip foi vendorizado em `js/vendor/jszip.min.js`, removendo a dependência de `node_modules` em tempo de execução no GitHub Pages.

## 4.4.0

- Adicionado seletor espacial com Grid, Mapa sintético e Importar mapa.
- Adicionado gerador de mapa sintético por células de Voronoi reproduzíveis por seed espacial.
- Adicionada importação local de GeoJSON `FeatureCollection` com `Polygon` e `MultiPolygon`.
- Adicionada seleção de atributos de ID, nome e população.
- Adicionadas topologias por fronteira compartilhada e por vizinhos mais próximos.
- Renderizador Canvas generalizado para células e polígonos.
- Direção e análise de chegada generalizadas para coordenadas espaciais.
- Bloqueio de 100% passa a remover a região da transmissão espacial normal.
- Adicionado verificador de isolamento por barreiras.
- Adicionada exportação `regions.geojson` para mapas sintéticos/importados.
- Projeto atualizado para schema `4.4.0`.
