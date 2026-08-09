const clamp = (v, a, b) => Math.max(a, Math.min(b, Number(v)));
const localMultiplier = (region, key) => {
  const value = Number(region.localParameters?.[key]);
  return Number.isFinite(value) && value >= 0 ? value : 1;
};

export function stepStochasticSIRVWeighted(currentFrame, incomingMap, config, prng) {
  const next = new Map();
  const beta = Math.max(0, Number(config.beta) || 0);
  const gamma = clamp(config.gamma || 0, 0, 1);
  const nu = clamp(config.nu || 0, 0, 1);
  const mobility = Math.max(0, Number(config.mobility) || 0);
  const localWeight = Math.max(0, Number(config.localTransmissionWeight) || 0);
  const spatialWeight = Math.max(0, Number(config.spatialTransmissionWeight ?? 1) || 0);
  const noise = clamp(config.parameterNoise || 0, 0, 1);

  for (const [regionId, region] of currentFrame.entries()) {
    const S = region.susceptible, I = region.infected, R = region.recovered, V = region.vaccinated, population = region.population;
    const jitter = noise > 0 ? 1 + (prng.next() * 2 - 1) * noise : 1;
    const localBeta = beta * localWeight * localMultiplier(region, 'betaMultiplier') * jitter;
    const localGamma = clamp(gamma * localMultiplier(region, 'gammaMultiplier'), 0, 1);
    const localNu = clamp(nu * localMultiplier(region, 'vaccinationMultiplier'), 0, 1);
    const targetMobility = mobility * localMultiplier(region, 'mobilityMultiplier');
    const susceptibility = Math.max(0, localMultiplier(region, 'susceptibilityMultiplier') * Math.max(0, Number(region.pathSusceptibilityMultiplier ?? 1)));
    const localForce = population > 0 ? localBeta * I / population : 0;
    let importedForce = 0;
    for (const source of incomingMap.get(regionId) || []) {
      const sourceState = currentFrame.get(source.id);
      if (sourceState?.population > 0) importedForce += beta * spatialWeight * targetMobility * source.weight * sourceState.infected / sourceState.population;
    }
    const pInfection = clamp(1 - Math.exp(-((localForce + importedForce) * susceptibility)), 0, 1);
    const newVaccinations = prng.binomial(S, localNu);
    const available = S - newVaccinations;
    const newInfections = prng.binomial(available, pInfection);
    const newRecoveries = prng.binomial(I, localGamma);
    const totalForce = localForce + importedForce;
    const localShare = totalForce > 0 ? localForce / totalForce : 0;
    const localInfections = Math.min(newInfections, Math.round(newInfections * localShare));
    const importedInfections = newInfections - localInfections + (region.importedInfections || 0);
    const nextRegion = {
      ...region,
      susceptible: S - newVaccinations - newInfections,
      infected: I + newInfections - newRecoveries,
      recovered: R + newRecoveries,
      vaccinated: V + newVaccinations,
      newInfections: newInfections + (region.newInfections || 0), newRecoveries, newVaccinations,
      localInfections, importedInfections
    };
    const total = nextRegion.susceptible + nextRegion.infected + nextRegion.recovered + nextRegion.vaccinated;
    if (total !== population || [nextRegion.susceptible, nextRegion.infected, nextRegion.recovered, nextRegion.vaccinated].some(v => !Number.isFinite(v) || v < 0)) throw new Error(`Violação de conservação na região ${regionId}.`);
    next.set(regionId, nextRegion);
  }
  return next;
}
