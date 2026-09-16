# Validação — v4.8.2

- `node --check js/visualization/comparative-viewer.js`: aprovado.
- Suíte do núcleo: **51/51**.
- Suíte de visualizações/IHC: **15/15**.
- Correção restrita ao layout/dimensionamento do Glifo.
- O estágio é calculado a partir da altura real do `#technique-view`, descontando o espaço já ocupado pelo cabeçalho/instrução.
- `node_modules` foi usado apenas temporariamente na validação e não faz parte do pacote final.

