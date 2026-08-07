# Changelog

## 4.2.0

- condições iniciais de suscetíveis/vacinados passam a ser geradas pela semente do experimento;
- adiciona vacinação média inicial e variação regional configuráveis;
- cada região deriva um sub-seed estável, evitando que edições manuais alterem as demais;
- adiciona modo manual por região para preservar S/V definidos pelo usuário;
- redefine Caminho como conjunto de regiões com maior suscetibilidade;
- adiciona multiplicador de suscetibilidade por região do caminho;
- redefine Bloqueio como vacinação regional;
- 100% de vacinação deixa a região sem suscetíveis e produz bloqueio total;
- bloqueios parciais permitem configurar qualquer cobertura de 0 a 100%;
- atualiza visualização do grid com rótulos `χ×` para caminho e `V%` para bloqueio;
- exporta condições iniciais, suscetibilidade do caminho e vacinação de bloqueio;
- migra projetos 4.x antigos para a semântica regional quando possível;
- atualiza schema para 4.2.0;
- amplia a suíte para 28 testes.

## 4.1.0

- deixa explícito que a animação depende de uma simulação executada;
- adiciona botão Executar simulação junto ao grid;
- desabilita controles de reprodução antes da primeira execução;
- melhora mensagens e estados da linha do tempo.

## 4.0.0

- remove seleção e dependência de atividades;
- reorganiza a aplicação em editor livre de propagação;
- adiciona múltiplas origens, focos, saltos e histórico de execuções.
