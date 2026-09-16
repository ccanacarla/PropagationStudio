# Changelog

## v4.8.2 — Glifo sem recorte vertical
- O estágio do Glifo passa a usar a altura real disponível no painel de visualização.
- Removida a combinação frágil `height: 0` + flex que podia provocar corte.
- A hierarquia do workspace usa `minmax(0, 1fr)` para não extrapolar o viewport.
- Células dos glifos podem reduzir até 1 px em cenários densos, preservando todos os instantes.
- Sem rolagem vertical no modo Glifo.
- Nenhuma alteração no motor SIRV ou nos dados da execução.

## 4.8.1 — Glifo ajustado ao viewport

- Corrige o corte vertical da visualização Glifo.
- O workspace do Glifo passa a usar exclusivamente a altura disponível, sem rolagem vertical.
- O tamanho das células temporais é ajustado automaticamente conforme área disponível, número de regiões e quantidade de instantes.
- Todos os glifos continuam presentes no mapa; não há amostragem nem remoção de instantes.
- Nenhuma alteração no motor SIRV ou nos dados das execuções.

# v4.8.0

- Adicionada a técnica **Glifo**, baseada no desenho de Peña-Araya et al. (CHI 2020).
- Um glifo é associado a cada região e contém uma grade de células temporais; uma célula representa um instante da execução.
- O Glifo reutiliza a mesma execução selecionada e a mesma escala fixa de Infectados (%) das demais técnicas.
- Slider temporal destaca o mesmo instante em todos os glifos; clicar numa célula sincroniza o destaque global.
- Hover destaca a região/glifo e clique mantém a região selecionada, integrando-se ao inspetor contextual do Studio.
- Layout dos glifos aplica resolução de colisões com linhas-guia em regiões densas.
- Motor SIRV, histórico das execuções e formatos de exportação não foram alterados.

# v4.7.4

- Corrige o layout do `canvas-card` para manter `canvas-legend` na faixa inferior no modo de construção.
- Substitui Compacto/Médio/Grande do Small Multiples por slider contínuo de 90–320 px.
- O slider fica ao lado do título Small multiples e atualiza o tamanho dos quadros em tempo real.
- Nenhuma alteração no motor SIRV ou nos dados das execuções.

# Changelog

## 4.7.0 — refinamentos de IHC nas visualizações

- Barra do workspace de visualização simplificada e com hierarquia explícita: execução → técnica → visualização.
- `Visualizar execuções` foi encurtado para `Visualizações` e ganhou `← Cenário` como retorno explícito.
- Escala de infectados (%) passou a ser única e fixa na barra superior para as três técnicas.
- Cabeçalhos internos das técnicas deixaram de repetir execução, variável e escala.
- Animação ganhou controles completos: primeiro, anterior, play/pausa, próximo, último e slider temporal.
- Clique em região abre um painel contextual com instante, infectados, população e intensidade (%).
- Small multiples continua exibindo todos os instantes e ganhou apenas controle de tamanho dos quadros: Compacto, Médio e Grande.
- Projeção 1D mantém a célula clicada selecionada após o ponteiro sair e sincroniza a inspeção contextual.
- Cards de execução mantêm `Visualizar` como ação principal e movem Renomear/Excluir para menu `⋯`, reduzindo risco de erro.
- Motor SIRV, propagação, importação e formatos de exportação não foram alterados.

## 4.6.0

- Separados dois workspaces principais: **Construir cenário** e **Visualizar execuções**.
- **Cenário** deixou de ser tratado como uma quarta técnica de visualização.
- No workspace de visualização, barra de ferramentas, painel de propriedades e gaveta inferior são ocultados para dar área máxima às técnicas.
- Adicionado seletor de execução no topo do workspace de visualização.
- Mantidas somente as abas **Animação**, **Small multiples** e **Projeção 1D** dentro da análise visual.
- Cards de execução agora incluem ação explícita **Visualizar**.
- Após executar uma simulação, o Studio entra diretamente no workspace de visualização em **Animação**.
- Retornar para **Construir cenário** sai do snapshot da execução e restaura o cenário editável atual.
- Trocar entre técnicas preserva o instante corrente quando aplicável.
- Layout responsivo atualizado para manter o workspace visual em largura total.
- Suíte atualizada para 60 testes automatizados.

## 4.5.0

- Incorporadas ao Studio as três técnicas do projeto `plot-evalution`: **Animação**, **Small multiples** e **Projeção 1D**.
- As três técnicas usam diretamente o snapshot e o histórico da execução selecionada; nenhuma delas recalcula o SIRV.
- Adicionado seletor central **Cenário | Animação | Small multiples | Projeção 1D**.
- Após uma nova simulação, o Studio abre automaticamente a visualização de Animação.
- A sequência comparativa começa em `t=1`, mantendo `t=0` como condição inicial do simulador.
- O sinal visual foi padronizado como percentual de infectados por região (`I / população × 100`) em escala fixa de 0–100%.
- Small multiples mostra todos os instantes visualizáveis, sem amostragem.
- Projeção 1D usa ordenação Gilbert/Hilbert para grids e agrupamento Ward para mapas; mapas muito grandes usam fallback limitado para evitar travamentos.
- A projeção 1D inclui matriz espaço × tempo, barra de distância, indicação de fragmentação e minimapa com destaque da região e de seus vizinhos topológicos.
- Voltar para **Cenário** sai explicitamente do snapshot de reprodução e retorna ao cenário editável atual.
- Adicionados 8 testes específicos das técnicas de visualização.

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

- v4.7.2: Animação e Projeção 1D ajustadas para ocupar o viewport sem rolagem vertical em desktop; Projeção 1D usa matriz + minimapa lado a lado.
