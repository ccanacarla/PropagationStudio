export const NEIGHBORHOOD_TYPES = { MOORE: 'moore', VON_NEUMANN: 'von_neumann' };
export const BORDER_MODES = { NORMAL: 'normal', TOROIDAL: 'toroidal' };
export const INTERACTION_MODES = {
  SELECT: 'select', ADD_ORIGIN: 'add_origin', ADD_FOCUS: 'add_focus',
  ADD_JUMP: 'add_jump', ADD_BARRIER: 'add_barrier', ADD_PREFERRED: 'add_preferred', ERASE: 'erase'
};
export const COMPARTMENT_COLORS = { susceptible: '#2563eb', infected: '#dc2626', recovered: '#059669', vaccinated: '#7c3aed' };
export const GRID_DEFAULTS = { DEFAULT_ROWS: 10, DEFAULT_COLS: 10, DEFAULT_POPULATION: 1000, DEFAULT_INITIAL_INFECTED: 20 };
export const SIMULATION_DEFAULTS = {
  TIME_STEPS: 80, TEMPORAL_UNIT: 'dia', BETA: 0.34, GAMMA: 0.10, NU: 0,
  MOBILITY: 0.32, SEED: 12345, LOCAL_WEIGHT: 1, SPATIAL_WEIGHT: 1, PARAMETER_NOISE: 0,
  INITIAL_VACCINATION_PCT: 15, INITIAL_VACCINATION_VARIATION_PCT: 10,
  PATH_SUSCEPTIBILITY_MULTIPLIER: 2.5, BARRIER_VACCINATION_PCT: 100,
  DIRECTION_PROFILE: 'cone', CONE_ANGLE: 35, DIRECTION_STRENGTH: 5,
  FORWARD_WEIGHT: 1, LATERAL_LEAK: 0.03, BACKWARD_LEAK: 0, DIAGONAL_PENALTY: 0.85
};
export const DIRECTION_OPTIONS = [
  ['radial','Radial / isotrópica'], ['west_to_east','Oeste → Leste'], ['east_to_west','Leste → Oeste'],
  ['north_to_south','Norte → Sul'], ['south_to_north','Sul → Norte'], ['northeast','Sudoeste → Nordeste'],
  ['southeast','Noroeste → Sudeste'], ['northwest','Sudeste → Noroeste'], ['southwest','Nordeste → Sudoeste']
];
export const DIRECTION_PROFILES = [['strict','Estrito'],['cone','Cone'],['soft','Suave']];
