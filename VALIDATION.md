# Validação — Propagation Studio v4.7.0

## Resultado automatizado

- **64 testes aprovados, 0 falhas**.
- 51 verificações do núcleo do Studio.
- 13 verificações das técnicas de visualização e da integração de IHC.
- `node --check` aprovado para `js/app.js` e `js/visualization/comparative-viewer.js`.

## O que os testes novos verificam

- legenda fixa e compartilhada de infectados (%);
- retorno explícito ao cenário;
- painel contextual de inspeção de região;
- controles temporais completos da Animação;
- Small multiples preservando todos os instantes, com ajuste apenas de tamanho;
- manutenção dos três modos comparativos sem introduzir um quarto modo de cenário.

## Validação visual

Foi tentada uma validação automatizada com Chromium/Playwright, mas o navegador deste ambiente bloqueia navegação para `localhost` e `file://` por política administrativa (`ERR_BLOCKED_BY_ADMINISTRATOR`). A validação funcional ficou coberta pela suíte automatizada e pelas verificações sintáticas; recomenda-se conferência visual final no navegador local.

## Escopo

Não houve alteração no motor SIRV, pesos espaciais, eventos de propagação, serialização de projetos ou formatos de exportação.

## v4.7.2 — ajuste de viewport
- Alteração funcional restrita a `css/layout.css`.
- Animação: mapa passa a usar o espaço vertical restante do workspace, evitando rolagem vertical.
- Projeção 1D (desktop): matriz e minimapa ficam lado a lado e dimensionados pelo espaço disponível, evitando rolagem vertical da técnica.
- Small Multiples permanece com rolagem, pois pode conter muitos instantes.
- A rolagem horizontal interna da matriz 1D pode permanecer quando houver muitas regiões, preservando a legibilidade das células.
- CSS analisado com `tinycss2`: 0 erros de parsing.
- A suíte JavaScript não foi reexecutada nesta revisão porque o pacote distribuído não inclui `node_modules`; nenhum arquivo JavaScript foi alterado em relação à v4.7.1 validada anteriormente.
## v4.7.4

- 51 testes do núcleo: aprovados.
- 13 testes de visualização/IHC: aprovados.
- Total: 64 testes, 0 falhas.
- `comparative-viewer.js`: verificação sintática aprovada.

