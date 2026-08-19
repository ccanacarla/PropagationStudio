import { GRID_DEFAULTS, SPATIAL_DEFAULTS } from '../constants.js';
import { Mulberry32 } from '../simulation/random.js';

export function createGrid(rows, columns, config = {}, prng = null) {
  const defaultPop = Math.max(1, Math.round(Number(config.defaultPopulation) || SPATIAL_DEFAULTS.DEFAULT_POPULATION));
  const randomizePop = Boolean(config.randomizePopulation);
  const minPop = Math.max(1, Math.round(Number(config.minPopulation) || GRID_DEFAULTS.MIN_POPULATION));
  const maxPop = Math.max(minPop, Math.round(Number(config.maxPopulation) || GRID_DEFAULTS.MAX_POPULATION));
  const localPrng = prng || new Mulberry32(Number(config.populationSeed) || GRID_DEFAULTS.POPULATION_SEED);
  const regionsMap = new Map();

  for (let r = 1; r <= rows; r++) {
    for (let c = 1; c <= columns; c++) {
      const id = `R_${r}_${c}`;
      const population = randomizePop ? localPrng.nextInt(minPop, maxPop) : defaultPop;
      regionsMap.set(id, {
        id, name: `Região ${r},${c}`, row: r, column: c, spatialX: c, spatialY: r, displayCentroid: { x: c, y: r }, geometry: null, sourceProperties: {}, population,
        susceptible: population, infected: 0, recovered: 0, vaccinated: 0, initialConditionMode: 'seeded',
        localParameters: { betaMultiplier: 1, gammaMultiplier: 1, vaccinationMultiplier: 1, mobilityMultiplier: 1, susceptibilityMultiplier: 1 }
      });
    }
  }
  return regionsMap;
}
