# Propagation Studio 4.8.0

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

## Execuções e exportações

Cada execução pode ser selecionada, renomeada, aprovada/rejeitada e excluída. Ao selecionar uma execução, o painel mostra a configuração registrada naquele run (espaço, seed, parâmetros SIRV e estruturas de propagação), inclusive depois de reabrir um projeto salvo.
Ao clicar em uma execução, o Canvas entra no snapshot daquela execução: usa o espaço, grid/mapa, regiões, estruturas de propagação e histórico salvos no próprio run. Assim, projetos compartilhados podem ser reabertos e cada exemplo reproduzido com Play/Passo exatamente sobre a configuração em que foi gerado.

O botão **Download (.zip)** gera um pacote com:

- `simulation.json`
- `temporal.csv`
- `regions.csv`
- `events.csv`
- `edges.csv`
- `summary.json`
- `regions.geojson` quando o espaço possui geometria poligonal

O arquivo de projeto salva geometria, atributos importados, topologia, cenário, execuções, execução selecionada e instante atual para reabertura posterior.

## Workspaces de construção e visualização

A interface separa duas tarefas de IHC que antes competiam pelo mesmo espaço:

1. **Construir cenário** — editor espacial completo, com ferramentas, parâmetros e painel de propriedades.
2. **Visualizar execuções** — workspace de análise que ocupa a área central inteira e remove temporariamente as ferramentas de edição, o painel lateral e a gaveta inferior.

O modo **Visualizar execuções** é habilitado quando existe pelo menos uma execução. A execução pode ser escolhida no seletor do próprio workspace ou aberta pelo botão **Visualizar** no card da aba Execuções.

Nesse workspace há quatro técnicas, tratadas como alternativas de representação do mesmo dado:

1. **Animação** — reproduz a propagação quadro a quadro no grid ou mapa.
2. **Small multiples** — mostra todos os instantes da execução simultaneamente em painéis espaciais.
3. **Projeção 1D** — transforma espaço × tempo em uma matriz, com regiões nas colunas e instantes nas linhas.
4. **Glifo** — mantém um único mapa e sobrepõe a cada região uma pequena grade temporal; cada célula representa um instante da execução e usa a mesma escala de infectados (%).

As quatro técnicas usam **a mesma execução selecionada** e não recalculam a simulação. O sinal visual é a porcentagem de infectados por região (`I / população × 100`), em escala fixa de **0–100%**, usando a mesma sequência temporal da execução a partir de `t=1`. Ao trocar de técnica, o instante corrente é preservado sempre que aplicável.

No **Small multiples**, nenhum instante é amostrado ou descartado: todos os passos visualizáveis são mostrados. Na **Projeção 1D**, grids usam uma ordenação espacial do tipo Gilbert/Hilbert; mapas usam agrupamento hierárquico Ward para manter regiões próximas também próximas na projeção. Ao apontar ou selecionar uma célula da matriz, o minimapa destaca a região correspondente e seus vizinhos reais.

Ao importar um projeto compartilhado, basta entrar em **Visualizar execuções**, selecionar uma execução e escolher uma das quatro técnicas. Cada visualização usa o snapshot salvo daquela execução — espaço, regiões, topologia e histórico — mesmo que o cenário editável atual seja diferente.

## Execução local

```bash
python3 -m http.server 8000
```

Acesse `http://localhost:8000`.

## Testes

```bash
npm test
```

A versão 4.5.0 inclui os testes anteriores e testes específicos das quatro técnicas de visualização, adaptação do histórico, ordenação espacial e integração com execuções selecionadas.

## Refinamentos de IHC — v4.7.0

O workspace **Visualizações** foi refinado para reduzir carga cognitiva e tornar a comparação entre técnicas mais controlada. A execução selecionada, a variável visualizada e a escala são apresentadas uma única vez. As quatro técnicas — **Animação**, **Small multiples**, **Projeção 1D** e **Glifo** — usam a mesma escala fixa de infectados (%) e a mesma execução.

Na Animação há navegação temporal completa. Small multiples preserva todos os instantes e permite somente ajustar o tamanho visual dos quadros. A Projeção 1D mantém seleções por clique. Clicar em uma região em qualquer técnica abre um painel contextual com os valores daquele exemplo, sem retornar ao editor.


## Mapa com Glifos — v4.8.0

O modo **Glifo** segue o desenho descrito por Peña-Araya, Bezerianos e Pietriga em *A Comparison of Geographical Propagation Visualizations* (CHI 2020): um único mapa recebe um glifo por região e cada glifo é uma grade de células temporais. Cada célula usa a mesma codificação cromática de infectados (%) das demais técnicas.

A interação também segue a lógica do artigo: o slider seleciona um instante e destaca a célula correspondente em todos os glifos; clicar em uma célula fixa esse mesmo instante globalmente; passar sobre uma região a destaca e clicar mantém a região selecionada. Para reduzir sobreposição em mapas densos, o Studio aplica uma pequena resolução de colisões aos glifos e desenha linhas-guia quando um glifo precisa ser deslocado de sua região.


### Ajuste automático do Glifo

A visualização Glifo ocupa apenas a altura disponível do workspace e não exige rolagem vertical. O tamanho das células temporais é reduzido automaticamente quando necessário para manter todos os glifos dentro da tela, preservando todos os instantes e regiões.
