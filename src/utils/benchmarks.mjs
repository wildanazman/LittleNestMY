// Age-aware benchmark engine — single source of truth from RESEARCH.md
// (WHO, AAP, CDC, National Sleep Foundation). Pure functions only: feed it the
// baby's age / gender / feeding type + logged data, get back interpreted
// guidance. No hardcoded recommendations live in the screens.

export function ageInMonths(dateOfBirth, at = new Date()) {
  if (!dateOfBirth) return 0;
  const dob = new Date(`${String(dateOfBirth).slice(0, 10)}T00:00:00`);
  if (Number.isNaN(dob.getTime())) return 0;
  return Math.max(0, (at - dob) / (1000 * 60 * 60 * 24 * 30.4375));
}

// "Breastfeeding" | "Formula" | "Mixed" | "breast" | "formula" -> normalized key
export function normalizeFeedingType(value) {
  const t = String(value || "").toLowerCase();
  if (t.includes("formula")) return "formula";
  if (t.includes("mix")) return "mixed";
  if (t.includes("breast")) return "breast";
  return "mixed";
}

// ---------- 1. FEEDING ----------
export function feedingBenchmark(months, feedingType) {
  const type = normalizeFeedingType(feedingType);
  const breastFreq = (m) => m < 1 ? [8, 12] : m < 3 ? [7, 9] : m < 6 ? [5, 7] : m < 12 ? [3, 5] : null;
  const formula = (m) => {
    if (m < 0.5) return { freq: [6, 8], vol: [60, 90] };
    if (m < 2) return { freq: [6, 7], vol: [120, 150] };
    if (m < 4) return { freq: [5, 6], vol: [120, 180] };
    if (m < 6) return { freq: [4, 5], vol: [180, 240] };
    if (m < 12) return { freq: [3, 4], vol: [210, 240] };
    return { freq: [2, 2], vol: null, totalCap: [470, 710] };
  };
  if (type === "formula") {
    const f = formula(months);
    return { type, freq: f.freq, volume: f.vol || null, totalCap: f.totalCap || null };
  }
  if (type === "breast") {
    return { type, freq: breastFreq(months), volume: null };
  }
  // mixed: use breast frequency window, offer formula volume as a guide
  const f = formula(months);
  return { type, freq: breastFreq(months) || f.freq, volume: f.vol || null };
}

// ---------- 2. SLEEP ----------
export function sleepBenchmark(months) {
  if (months < 3) return { band: "0–3 months", totalHours: [14, 17], naps: [3, 5], bedtime: ["21:00", "23:00"], bedtimeLabel: "9:00 – 11:00 PM" };
  if (months < 12) return { band: "4–11 months", totalHours: [12, 15], naps: [2, 3], bedtime: ["19:00", "20:30"], bedtimeLabel: "7:00 – 8:30 PM" };
  if (months < 24) return { band: "12–24 months", totalHours: [11, 14], naps: [1, 1], bedtime: ["19:00", "20:00"], bedtimeLabel: "7:00 – 8:00 PM" };
  return { band: "24–36 months", totalHours: [11, 14], naps: [1, 1], bedtime: ["19:30", "20:30"], bedtimeLabel: "7:30 – 8:30 PM" };
}

// ---------- 3. DIAPER / ELIMINATION ----------
export function diaperBenchmark(months, feedingType) {
  const type = normalizeFeedingType(feedingType);
  let wetMin = 6, changes, stoolBaseline;
  if (months < 1) { changes = [8, 10]; stoolBaseline = type === "formula" ? [1, 2] : [3, 4]; }
  else if (months < 6) { changes = [6, 8]; stoolBaseline = type === "formula" ? [1, 2] : null; }
  else if (months < 12) { changes = [5, 7]; stoolBaseline = [1, 2]; }
  else { changes = [4, 6]; stoolBaseline = [1, 2]; }
  return { wetMin, changes, stoolBaseline, feedingType: type };
}

// Stool-gap interpretation accounts for feeding type (breastfed can go days).
export function stoolStatus(daysSinceStool, feedingType) {
  const type = normalizeFeedingType(feedingType);
  if (daysSinceStool == null) return { tone: "info", text: "No stool logged yet." };
  if (type === "breast") {
    if (daysSinceStool <= 7) return { tone: "good", text: `${daysSinceStool} day${daysSinceStool === 1 ? "" : "s"} ago — can still be normal for breastfed babies.` };
    return { tone: "watch", text: `${daysSinceStool} days ago — worth mentioning to your doctor.` };
  }
  // formula / mixed expect closer to daily
  if (daysSinceStool <= 2) return { tone: "good", text: `${daysSinceStool} day${daysSinceStool === 1 ? "" : "s"} ago — within a typical range.` };
  if (daysSinceStool <= 3) return { tone: "watch", text: `${daysSinceStool} days ago — keep an eye on bowel pattern.` };
  return { tone: "watch", text: `${daysSinceStool} days ago — monitor and consider asking your doctor.` };
}

// ---------- 4. WHO GROWTH (50th percentile) ----------
const WHO = {
  male: {
    weight: [[0, 3.3], [1, 4.5], [3, 6.4], [6, 7.9], [9, 8.9], [12, 9.6], [18, 10.9], [24, 12.2], [36, 14.3]],
    length: [[0, 49.9], [1, 54.7], [3, 61.4], [6, 67.6], [9, 72.0], [12, 75.7], [18, 82.3], [24, 87.8], [36, 96.1]],
    head: [[0, 34.5], [1, 37.3], [3, 40.5], [6, 43.3], [9, 45.0], [12, 46.1], [18, 47.4], [24, 48.4], [36, 49.5]]
  },
  female: {
    weight: [[0, 3.2], [1, 4.2], [3, 5.8], [6, 7.3], [9, 8.2], [12, 8.9], [18, 10.2], [24, 11.5], [36, 13.9]],
    length: [[0, 49.1], [1, 53.7], [3, 59.8], [6, 65.7], [9, 70.1], [12, 74.0], [18, 80.7], [24, 86.4], [36, 95.1]],
    head: [[0, 33.9], [1, 36.5], [3, 39.5], [6, 42.2], [9, 43.8], [12, 45.0], [18, 46.2], [24, 47.2], [36, 48.4]]
  }
};

export function whoMedian(months, gender, metric) {
  const g = String(gender || "").toLowerCase().startsWith("m") ? "male" : "female";
  const table = WHO[g]?.[metric];
  if (!table) return null;
  const m = Math.max(0, Math.min(36, months));
  for (let i = 0; i < table.length - 1; i += 1) {
    const [a, va] = table[i], [b, vb] = table[i + 1];
    if (m >= a && m <= b) {
      const t = b === a ? 0 : (m - a) / (b - a);
      return Math.round((va + (vb - va) * t) * 10) / 10;
    }
  }
  return table[table.length - 1][1];
}

// How a measurement compares to the WHO median (gentle, non-diagnostic).
export function growthComparison(value, median) {
  if (!value || !median) return null;
  const pctDiff = ((value - median) / median) * 100;
  let tone = "good", text;
  if (Math.abs(pctDiff) <= 7) text = "Tracking close to the WHO median.";
  else if (pctDiff > 7) { text = "Above the WHO median — common and usually fine if growth is steady."; }
  else { text = "Below the WHO median — common and usually fine if growth is steady."; }
  return { median, pctDiff: Math.round(pctDiff), tone, text };
}

// ---------- 5. NUTRITION STAGE ENGINE ----------
export function nutritionStage(months) {
  if (months < 6) return { key: "milk", title: "Exclusive milk diet", guidance: "Breast milk or formula only — no water, juice, or solids yet." };
  if (months < 7) return { key: "intro", title: "Solids introduction", guidance: "Start iron-rich single-grain cereals or smooth purées once baby sits upright and the tongue-thrust reflex fades." };
  if (months < 10) return { key: "texture", title: "Texture progression", guidance: "Move to thick mashes and soft finger foods. Offer small sips of open-cup water with meals." };
  if (months < 12) return { key: "table", title: "Chunky table foods", guidance: "Finely diced family meals. Milk eases to 3–4 sessions as solids increase." };
  return { key: "toddler", title: "Toddler diet", guidance: "3 meals + 2 snacks. Whole milk capped ~470–710ml/day. Honey now safe; avoid choking shapes (whole grapes, popcorn, nuts)." };
}

// ---------- 6. CDC MILESTONES ----------
export const CDC_MILESTONES = [
  { age: 2, items: ["Smiles when spoken to", "Makes cooing sounds", "Holds head up on tummy", "Looks at your face"] },
  { age: 4, items: ["Smiles to get attention", "Chuckles", "Holds head steady", "Pushes up on elbows", "Brings hands to mouth"] },
  { age: 6, items: ["Laughs out loud", "Knows familiar faces", "Reaches for toys", "Rolls tummy to back", "Blows raspberries"] },
  { age: 9, items: ["Babbles (bababa, mamama)", "Sits without support", "Reacts when you leave", "Passes objects hand to hand", "Plays peek-a-boo"] },
  { age: 12, items: ["Waves bye-bye", "Says 1–2 words", "Pulls to stand", "Cruises along furniture", "Pincer grasp"] },
  { age: 15, items: ["Says a few words", "Takes a few steps", "Stacks 2 blocks", "Claps when excited", "Points to ask"] },
  { age: 18, items: ["Walks confidently", "Says several words", "Scribbles", "Points to a body part", "Simple pretend play"] },
  { age: 24, items: ["2–4 word phrases", "Kicks a ball", "Runs", "Points to things in a book", "Shows early empathy"] },
  { age: 30, items: ["50+ word vocabulary", "Uses I / me / you", "Jumps with both feet", "Follows two-step instructions", "Names one color"] },
  { age: 36, items: ["Short conversations", "Asks who/what/where/why", "Draws a circle", "Pedals a tricycle", "Says first name"] }
];

export function milestonesForAge(months) {
  const current = [...CDC_MILESTONES].reverse().find((m) => months >= m.age) || null;
  const next = CDC_MILESTONES.find((m) => m.age > months) || null;
  return { current, next };
}

// ---------- STATUS HELPERS ----------
export function rangeStatus(value, range, { unit = "" } = {}) {
  if (!range) return { tone: "info", label: "Tracked", short: "Logged" };
  const [min, max] = range;
  if (value < min) return { tone: "watch", label: "Below typical range", short: "Below range" };
  if (max != null && value > max) return { tone: "high", label: "Above typical range", short: "Above range" };
  return { tone: "good", label: "Within recommended range", short: "On track" };
}

// ---------- 7. WELLNESS SCORE (age-aware, 0–100) ----------
// Each domain contributes up to 25. "On track" = full; near range = partial.
export function domainScore(value, range) {
  if (!range || value == null) return { score: 12, label: "Needs data" };
  const [min, max] = range;
  if (value >= min && (max == null || value <= max)) return { score: 25, label: "Excellent" };
  const lo = Math.min(value, min), hi = max == null ? value : Math.max(value, max);
  const target = value < min ? min : max;
  const off = Math.abs(value - target) / Math.max(1, target);
  if (off <= 0.25) return { score: 18, label: "Good" };
  if (off <= 0.5) return { score: 12, label: "Monitor" };
  return { score: 7, label: "Needs attention" };
}

export function wellnessLabel(score) {
  if (score >= 85) return "Excellent";
  if (score >= 70) return "Good";
  if (score >= 50) return "Fair";
  return "Building";
}
