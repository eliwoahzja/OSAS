export const EARTHQUAKE_HAZARD = 'Earthquake Hazards in School Buildings';
export const EARTHQUAKE_PREVENTION = [
  'Conduct regular earthquake drills and review the school evacuation plan.',
  'Have qualified professionals inspect school buildings for structural damage.',
  'Secure cabinets, shelves, and heavy objects against falling.',
  'Mark emergency exits and evacuation routes and keep them accessible.',
  'Teach students and staff to Duck, Cover, and Hold during shaking.',
  'Keep hallways and emergency exits clear of obstructions.',
  'Refer cracks and structural damage to qualified engineers for assessment and repair.',
  'Maintain emergency kits and first aid supplies.',
  'Identify an assembly area away from buildings, power lines, and falling objects.',
  'Have qualified professionals assess compliance with earthquake-resistant building standards.',
];
export const earthquakePreventionPlan = () => EARTHQUAKE_PREVENTION.map((text, i) => `${i + 1}. ${text}`).join('\n');
