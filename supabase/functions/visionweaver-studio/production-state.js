export const PRODUCTION_VERSION = '2.02';
export const EVENT_TYPES = ['rain', 'traffic', 'pedestrians', 'birds', 'insects', 'baby', 'garbage_truck', 'splashes'];
const text = (value, max = 1000) => String(value ?? '').trim().slice(0, max);
export function voiceProfile(input = {}) {
  input = input && typeof input === 'object' ? input : {};
  return Object.fromEntries(['age', 'language', 'accent', 'pitch', 'pace', 'emotion', 'pronunciation', 'provider', 'voice_id', 'rights'].map(key => [key, text(input[key], 500)]));
}
export function sceneState(input = {}) {
  input = input && typeof input === 'object' ? input : {};
  const state = Object.fromEntries(['location', 'date', 'timezone', 'time_of_day', 'weather', 'terrain', 'lighting', 'camera', 'action', 'end_state', 'evidence'].map(key => [key, text(input[key])]));
  state.events = EVENT_TYPES.map(type => {
    const e = (Array.isArray(input.events) ? input.events : []).find(e => e && e.type === type) || {};
    return { type, visible: e.visible === true, audible: e.audible === true, notes: text(e.notes, 300) };
  });
  state.schema_version = PRODUCTION_VERSION;
  state.fidelity = 'cinematic_plausibility';
  return state;
}
export function compileScene(state) {
  const s = sceneState(state);
  const labels = { location: 'Location', date: 'Date', timezone: 'Timezone', time_of_day: 'Time', weather: 'Weather', terrain: 'Terrain', lighting: 'Lighting', camera: 'Camera', action: 'Action', end_state: 'Required ending' };
  const lines = Object.entries(labels).filter(([key]) => s[key]).map(([key, label]) => `${label}: ${s[key]}.`);
  for (const e of s.events) lines.push(`${e.type}: ${e.visible ? 'visible' : 'not visible'}.${e.notes ? ' ' + e.notes : ''}`);
  return lines.join('\n');
}
export function orderedUnique(ids, maximum) {
  if (!Array.isArray(ids)) return [];
  return [...new Set(ids.map(String))].slice(0, maximum);
}
