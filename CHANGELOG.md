# Changelog

## 4.4.1

- Ajustado o seletor PT-BR/EN para seguir o padrão visual do cabeçalho.
- Seletor de idioma agora usa o mesmo contraste, altura, borda, raio e estados de foco/hover dos controles superiores.
- Removido o rótulo externo do idioma para reduzir ruído visual; a acessibilidade permanece via `aria-label` e `title`.

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
