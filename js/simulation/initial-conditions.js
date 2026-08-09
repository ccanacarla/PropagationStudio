import { Mulberry32 } from './random.js';

const clamp = (v, min, max) => Math.max(min, Math.min(max, Number(v)));

export function initialSeedFromExperiment(seed) {
  const s = (Number(seed) || 1) >>> 0;
  return (s ^ 0x9E3779B9) >>> 0;
}

export function barrierCoverageMap(propagation = {}) {
  const map = new Map();
  for (const barrier of propagation.vaccinationBarriers || []) {
    if (barrier.enabled === false || !barrier.regionId) continue;
    const coverage = clamp(barrier.vaccinationCoverage ?? 100, 0, 100);
    const previous = map.get(barrier.regionId) ?? 0;
    map.set(barrier.regionId, Math.max(previous, coverage));
  }
  return map;
}

export function pathSusceptibilityMap(propagation = {}) {
  const map = new Map();
  for (const path of propagation.pathRegions || []) {
    if (path.enabled === false || !path.regionId) continue;
    const multiplier = Math.max(0, Number(path.susceptibilityMultiplier ?? 2));
    map.set(path.regionId, Math.max(map.get(path.regionId) ?? 1, multiplier));
  }
  return map;
}

/**
 * Rebuilds S/V deterministically from the experiment seed.
 * I/R are preserved. Regions marked as manual preserve their existing S/V.
 * Vaccination barriers are applied last and therefore override the seeded
 * vaccination coverage. This makes 100% vaccination a true regional block.
 */
export function buildInitialRegions(regions, simulationConfig = {}, propagation = {}) {
  const experimentSeed = initialSeedFromExperiment(simulationConfig.seed);
  const basePct = clamp(simulationConfig.initialVaccinationPct ?? 15, 0, 100);
  const variationPct = clamp(simulationConfig.initialVaccinationVariationPct ?? 10, 0, 100);
  const barrierMap = barrierCoverageMap(propagation);
  const pathMap = pathSusceptibilityMap(propagation);
  const next = new Map();

  for (const [id, source] of regions) {
    const r = { ...source, localParameters: { ...(source.localParameters || {}) } };
    const population = Math.max(1, Math.round(Number(r.population) || 1));
    let infected = Math.max(0, Math.round(Number(r.infected) || 0));
    let recovered = Math.max(0, Math.round(Number(r.recovered) || 0));
    if (infected + recovered > population) {
      const scale = population / Math.max(1, infected + recovered);
      infected = Math.floor(infected * scale);
      recovered = Math.max(0, population - infected);
    }

    const available = Math.max(0, population - infected - recovered);
    const manual = r.initialConditionMode === 'manual';
    let vaccinated;
    let coveragePct;

    if (manual) {
      vaccinated = Math.max(0, Math.min(available, Math.round(Number(r.vaccinated) || 0)));
      coveragePct = population > 0 ? (vaccinated / population) * 100 : 0;
    } else {
      let h=experimentSeed; for(const ch of String(id)){h=Math.imul(h ^ ch.charCodeAt(0),16777619)>>>0;} const regionPrng=new Mulberry32(h||1);
      const jitter = variationPct > 0 ? (regionPrng.next() * 2 - 1) * variationPct : 0;
      coveragePct = clamp(basePct + jitter, 0, 100);
      vaccinated = Math.max(0, Math.min(available, Math.round(population * coveragePct / 100)));
    }

    const barrierPct = barrierMap.get(id);
    if (barrierPct != null) {
      coveragePct = Math.max(coveragePct, barrierPct);
      if (barrierPct >= 100) {
        infected = 0;
        recovered = 0;
        vaccinated = population;
      } else {
        const nowAvailable = Math.max(0, population - infected - recovered);
        vaccinated = Math.max(vaccinated, Math.min(nowAvailable, Math.round(population * barrierPct / 100)));
      }
    }

    const susceptible = Math.max(0, population - infected - recovered - vaccinated);
    const pathMultiplier = pathMap.get(id) ?? 1;

    next.set(id, {
      ...r,
      population,
      infected,
      recovered,
      vaccinated,
      susceptible,
      seededVaccinationPct: population > 0 ? vaccinated / population * 100 : 0,
      barrierVaccinationPct: barrierPct ?? null,
      pathSusceptibilityMultiplier: pathMultiplier,
      localParameters: {
        betaMultiplier: Number.isFinite(Number(r.localParameters?.betaMultiplier)) ? Number(r.localParameters.betaMultiplier) : 1,
        gammaMultiplier: Number.isFinite(Number(r.localParameters?.gammaMultiplier)) ? Number(r.localParameters.gammaMultiplier) : 1,
        vaccinationMultiplier: Number.isFinite(Number(r.localParameters?.vaccinationMultiplier)) ? Number(r.localParameters.vaccinationMultiplier) : 1,
        mobilityMultiplier: Number.isFinite(Number(r.localParameters?.mobilityMultiplier)) ? Number(r.localParameters.mobilityMultiplier) : 1,
        susceptibilityMultiplier: Number.isFinite(Number(r.localParameters?.susceptibilityMultiplier)) ? Number(r.localParameters.susceptibilityMultiplier) : 1
      }
    });
  }
  return next;
}
