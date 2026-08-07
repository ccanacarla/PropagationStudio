# Propagation Studio 4.2

Aplicação web estática para construção, simulação, análise e exportação de eventos sintéticos de propagação SIRV em grid.

## Conceitos principais

A versão 4.2 usa propriedades regionais para construir o cenário:

- a **semente do experimento** gera um padrão espacial reproduzível de suscetíveis e vacinados;
- **Caminho** marca regiões com suscetibilidade relativa maior, facilitando a propagação por elas;
- **Bloqueio** aumenta a vacinação inicial das regiões marcadas; com 100% de vacinação, a região fica com `S = 0` e funciona como bloqueio total;
- origens, focos, saltos e direção podem ser combinados livremente.

## Condições iniciais e semente

Por padrão, cada região recebe uma cobertura vacinal inicial derivada da mesma semente usada no experimento.

Configure:

- vacinação média inicial (%);
- variação regional em pontos percentuais;
- semente do experimento.

A mesma semente e a mesma configuração recriam exatamente o mesmo padrão regional de `S` e `V`. Alterar a semente gera outro padrão.

Cada região deriva um sub-seed próprio. Assim, tornar uma região manual não desloca a sequência aleatória das demais.

Uma região pode ser marcada como **manual** no painel Região. Nesse modo, seus valores de S/V não são regenerados ao trocar a semente.

## Caminho

A ferramenta **Caminho** marca uma sequência de regiões adjacentes.

Cada região marcada recebe um `susceptibilityMultiplier`. A força de infecção recebida por ela é multiplicada por esse valor. Exemplo:

- `1.0` = suscetibilidade normal;
- `2.5` = força de infecção 2,5 vezes maior;
- `4.0` = força de infecção 4 vezes maior.

O caminho não cria infectados artificialmente e não altera a conservação populacional.

## Bloqueio

A ferramenta **Bloqueio** agora atua sobre a região, não sobre uma aresta.

Ela define a cobertura vacinal inicial mínima daquela região:

- 50% = aproximadamente metade da população em `V`;
- 80% = forte redução da população suscetível;
- 100% = `V = população`, `S = 0` quando não há I/R iniciais, impedindo transmissão pela região.

Para formar uma parede, marque uma sequência de regiões com 100% de vacinação.

## Fluxo de uso

1. Configure grid, SIRV, vacinação inicial e semente.
2. Monte o evento com origens, focos, saltos, caminho, bloqueio e direção.
3. Clique em **Executar simulação**.
4. Use a linha do tempo e **▶** para visualizar a animação.
5. Revise análises, compare execuções e exporte os arquivos.

A animação representa uma execução já calculada e só fica disponível depois de simular.

## Recursos

- grid regular com 4 ou 8 vizinhos;
- população uniforme ou aleatória;
- heterogeneidade inicial S/V reproduzível pela seed;
- edição manual de condições iniciais por região;
- parâmetros SIRV globais e locais;
- suscetibilidade local e caminho suscetível;
- bloqueios por vacinação regional;
- múltiplas origens e focos programados;
- saltos probabilísticos e recorrentes;
- propagação radial, estrita, em cone ou suave;
- histórico de execuções;
- animação temporal;
- análises automáticas;
- exportação JSON/CSV;
- salvamento e importação do projeto.

## Executar localmente

```bash
python3 -m http.server 8000
```

Abra `http://localhost:8000`.

## GitHub Pages

Publique o conteúdo da pasta na branch configurada para o GitHub Pages. Não há backend nem etapa obrigatória de build.

## Testes

```bash
npm test
```

A suíte da versão 4.2 inclui testes para seed, S/V inicial, caminho suscetível, bloqueio vacinal, saltos, direção, conservação e exportações.
