# Validação da versão 4.2.0

## Testes automatizados

Executados com `npm test`.

Resultado: **28 testes aprovados, 0 falhas**.

Cobertura principal:

- heterogeneidade inicial de S/V;
- reprodução exata de S/V com a mesma semente;
- alteração do padrão espacial com semente diferente;
- preservação de regiões em modo manual;
- reprodutibilidade da dinâmica estocástica;
- conservação populacional;
- origens, focos e saltos;
- bloqueio regional com 100% de vacinação;
- bloqueio parcial por cobertura vacinal;
- caminho com multiplicador de suscetibilidade;
- aumento mensurável da propagação na região de caminho;
- propagação direcional estrita;
- análises automáticas;
- serialização e exportações CSV/JSON;
- presença dos novos controles na interface.

## Semântica da seed

A seed do experimento controla tanto a dinâmica estocástica quanto o padrão inicial regional de vacinação/suscetibilidade. A geração inicial usa sub-seeds determinísticos por região, derivados da seed principal.

## Semântica do caminho

Uma região marcada como caminho recebe `pathSusceptibilityMultiplier`. A probabilidade de infecção usa a força local + importada multiplicada pela suscetibilidade efetiva da região.

## Semântica do bloqueio

Uma região bloqueada recebe uma cobertura vacinal inicial mínima. Com 100% e sem I/R iniciais, `V = N` e `S = 0`. Como eventos externos só convertem indivíduos suscetíveis em infectados, uma região totalmente vacinada também não recebe injeções de origem/foco/salto enquanto não houver suscetíveis.

## Validação estática

- módulos JavaScript passam em `node --check`;
- imports locais foram verificados;
- IDs HTML usados pela aplicação foram conferidos;
- a suíte principal executa sem dependências externas.

A validação interativa automatizada em Chromium não pôde ser executada neste ambiente por uma restrição administrativa de navegação local do navegador. O motor, a serialização e a estrutura da interface foram validados por testes automatizados e inspeção estática.
