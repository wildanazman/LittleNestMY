// Home background preference. The actual visuals live as CSS classes
// (.home-bg-<id>) scoped to .home-premium-bg in the home screen; this module
// just stores the choice and toggles the class on <body>.

const KEY = "littlenest:homeBackground";

export const HOME_BACKGROUNDS = [
  { id: "nursery", name: "LittleNest", description: "Purple welcome glow" },
  { id: "nursery-tile", name: "Nursery Tile", description: "Soft premium motifs" },
  { id: "aurora", name: "Dream Glow", description: "Purple, pink and sky" },
  { id: "cloud", name: "Cloud", description: "Airy sky wash" },
  { id: "garden", name: "Garden", description: "Calm botanical tint" },
  { id: "moon", name: "Moon Milk", description: "Dreamy night-light" },
  { id: "minimal", name: "Soft Lilac", description: "Calm and clean" }
];

const DEFAULT_ID = "nursery";

export function getHomeBackground() {
  try {
    const value = localStorage.getItem(KEY);
    return HOME_BACKGROUNDS.some((bg) => bg.id === value) ? value : DEFAULT_ID;
  } catch {
    return DEFAULT_ID;
  }
}

export function setHomeBackground(id) {
  const safe = HOME_BACKGROUNDS.some((bg) => bg.id === id) ? id : DEFAULT_ID;
  try {
    localStorage.setItem(KEY, safe);
  } catch {
    // Ignore storage failures; the in-memory class still applies.
  }
  applyHomeBackground(safe);
  return safe;
}

export function applyHomeBackground(id = getHomeBackground()) {
  if (typeof document === "undefined" || !document.body) return;
  HOME_BACKGROUNDS.forEach((bg) => document.body.classList.remove(`home-bg-${bg.id}`));
  document.body.classList.add(`home-bg-${id}`);
}
