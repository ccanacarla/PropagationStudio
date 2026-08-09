export const DIRECTION_VECTORS = {
  west_to_east: { dx: 1, dy: 0 }, east_to_west: { dx: -1, dy: 0 },
  north_to_south: { dx: 0, dy: 1 }, south_to_north: { dx: 0, dy: -1 },
  northeast: { dx: 1, dy: -1 }, southeast: { dx: 1, dy: 1 },
  northwest: { dx: -1, dy: -1 }, southwest: { dx: -1, dy: 1 }, radial: null
};

const clamp = (value, min, max) => Math.max(min, Math.min(max, Number(value)));

export function directionalMultiplier(source, target, directionKey, options = {}) {
  const vector = DIRECTION_VECTORS[directionKey];
  if (!vector) return 1;
  const sx = Number.isFinite(Number(source.spatialX)) ? Number(source.spatialX) : Number(source.column);
  const sy = Number.isFinite(Number(source.spatialY)) ? Number(source.spatialY) : Number(source.row);
  const tx = Number.isFinite(Number(target.spatialX)) ? Number(target.spatialX) : Number(target.column);
  const ty = Number.isFinite(Number(target.spatialY)) ? Number(target.spatialY) : Number(target.row);
  const dx = tx - sx;
  const dy = ty - sy;
  const edgeLength = Math.hypot(dx, dy) || 1;
  const vectorLength = Math.hypot(vector.dx, vector.dy) || 1;
  const cosine = clamp((dx * vector.dx + dy * vector.dy) / (edgeLength * vectorLength), -1, 1);
  const profile = options.directionProfile || 'cone';
  const forward = Math.max(0, Number(options.forwardWeight) || 1);
  const lateral = clamp(options.lateralLeak ?? 0.015, 0, 1);
  const backward = clamp(options.backwardLeak ?? 0, 0, 1);
  const diagonalPenalty = clamp(options.diagonalPenalty ?? 0.85, 0, 1);
  const isDiagonal = Math.abs(dx) > 0 && Math.abs(dy) > 0;
  let multiplier;

  if (profile === 'strict') {
    multiplier = cosine >= 0.92 ? forward : (cosine > 0 ? lateral : backward);
  } else if (profile === 'soft') {
    const strength = clamp(options.directionStrength ?? 5, 0, 12);
    const raw = Math.exp(strength * cosine);
    const maximum = Math.exp(strength);
    multiplier = forward * raw / maximum;
    if (cosine <= 0) multiplier = Math.max(multiplier, cosine === 0 ? lateral : backward);
  } else {
    const halfAngle = clamp(options.coneAngle ?? 25, 5, 90);
    const threshold = Math.cos(halfAngle * Math.PI / 180);
    if (cosine >= threshold) {
      const normalized = (cosine - threshold) / Math.max(1e-9, 1 - threshold);
      multiplier = forward * (0.7 + 0.3 * normalized);
    } else if (cosine > 0) multiplier = lateral;
    else multiplier = backward;
  }
  if (isDiagonal) multiplier *= diagonalPenalty;
  return Math.max(0, multiplier);
}

export function calculateDirectionalWeight(source, target, directionKey, options = {}, baseWeight = 1) {
  return Math.max(0, Number(baseWeight) || 0) * directionalMultiplier(source, target, directionKey, options);
}
