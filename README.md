# Propagation Studio 4.4.0

Aplicação web estática para construir, simular, revisar e exportar eventos SIRV estocásticos. Funciona em GitHub Pages e não exige backend.

## Modos espaciais

A aplicação usa um único motor SIRV para três representações:

1. **Grid** — grade regular com vizinhança Moore (8) ou Von Neumann (4).
2. **Mapa sintético** — regiões poligonais de Voronoi geradas por uma seed espacial.
3. **Mapa importado** — GeoJSON `FeatureCollection` contendo `Polygon` ou `MultiPolygon`.

No mapa importado, o usuário escolhe quais atributos representam ID, nome e população. Se não houver população, um valor padrão é aplicado.

### Conectividade de mapas

- **Fronteira compartilhada**: regiões são conectadas quando compartilham trecho de fronteira.
- **Vizinhos mais próximos**: alternativa para arquivos cujas fronteiras não coincidem numericamente.

A construção por fronteira pode ficar lenta em mapas muito grandes ou extremamente detalhados.

## Seeds

- **Seed espacial**: usada somente no mapa sintético para reproduzir a geometria.
- **Seed do experimento**: reproduz condições iniciais S/V e a dinâmica estocástica.

## Ferramentas

As mesmas ferramentas funcionam nos três espaços:

- origens;
- focos;
- saltos;
- caminhos de maior suscetibilidade;
- bloqueios vacinais;
- anisotropia direcional;
- edição individual de regiões.

### Bloqueio vacinal

Um bloqueio de `100%` faz a região iniciar com toda a população em `V`, zera `S/I/R` e remove suas arestas da transmissão espacial normal. A capacidade bloqueada não é redistribuída para outros vizinhos. Saltos continuam sendo eventos externos explícitos e não dependem da continuidade espacial.

O botão **Verificar isolamento pelas barreiras** calcula quais regiões deixaram de ser alcançáveis pelas origens através da transmissão espacial normal.

## Importação GeoJSON

1. Abra **Espaço**.
2. Escolha **Importar mapa**.
3. Selecione um `.geojson` ou `.json`.
4. Escolha os campos de ID, nome e população.
5. Escolha o método de conectividade.
6. Clique em **Usar este mapa**.

O processamento ocorre localmente no navegador. Um arquivo de demonstração está em `examples/demo-regions.geojson`.

## Exportações

Para cada execução:

- `simulation.json`
- `temporal.csv`
- `regions.csv`
- `events.csv`
- `edges.csv`
- `summary.json`
- `regions.geojson` quando o espaço possui geometria poligonal

O arquivo de projeto salva geometria, atributos importados, topologia, cenário e execuções para reabertura posterior.

## Execução local

```bash
python3 -m http.server 8000
```

Acesse `http://localhost:8000`.

## Testes

```bash
npm test
```

A versão 4.4.0 inclui testes do grid, mapa sintético, GeoJSON, adjacência, bloqueio, seeds, eventos, análises e exportações.
