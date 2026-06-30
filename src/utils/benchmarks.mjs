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

export function correctedAgeExpired(profile, at = new Date()) {
  if (!profile?.dateOfBirth) return true;
  return ageInMonths(profile.dateOfBirth, at) >= 24;
}

export function hasActivePrematureProfile(profile) {
  return profile?.isPremature === true || String(profile?.isPremature || "").toLowerCase() === "true";
}

export function getEffectiveDateOfBirth(profile) {
  if (!profile || !hasActivePrematureProfile(profile)) return profile?.dateOfBirth || null;
  if (correctedAgeExpired(profile)) return profile.dateOfBirth;
  if (profile.expectedDueDate) return profile.expectedDueDate;
  if (profile.gestationalAgeAtBirth) {
    const ga = Number(profile.gestationalAgeAtBirth);
    if (Number.isNaN(ga) || ga >= 40) return profile.dateOfBirth;
    const prematurityDays = Math.round((40 - ga) * 7);
    const dob = new Date(`${String(profile.dateOfBirth).slice(0, 10)}T00:00:00`);
    if (Number.isNaN(dob.getTime())) return profile.dateOfBirth;
    dob.setDate(dob.getDate() + prematurityDays);
    return dob.toISOString().slice(0, 10);
  }
  return profile.dateOfBirth;
}

export function correctedAgeInMonths(profile, at = new Date()) {
  if (!profile || !hasActivePrematureProfile(profile)) return ageInMonths(profile?.dateOfBirth, at);
  if (correctedAgeExpired(profile, at)) return ageInMonths(profile.dateOfBirth, at);
  const effectiveDob = getEffectiveDateOfBirth(profile);
  if (!effectiveDob) return 0;
  return ageInMonths(effectiveDob, at);
}

export function hasReachedTermCorrected(profile, at = new Date()) {
  if (!profile || !hasActivePrematureProfile(profile)) return true;
  if (!profile.expectedDueDate && !profile.gestationalAgeAtBirth) return true;
  if (profile.expectedDueDate) {
    const edd = new Date(`${String(profile.expectedDueDate).slice(0, 10)}T00:00:00`);
    return !Number.isNaN(edd.getTime()) && at >= edd;
  }
  return correctedAgeInMonths(profile, at) > 0;
}

export function isProfilePremature(profile) {
  if (!profile || !hasActivePrematureProfile(profile)) return false;
  return !correctedAgeExpired(profile);
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

// ---------- Premium: Sleep Predictions ----------
// Age-appropriate awake window between sleeps, in minutes (AAP / pediatric sleep guidance).
export function wakeWindowMinutes(m) {
  if (m < 1) return [35, 60];
  if (m < 3) return [60, 90];
  if (m < 6) return [90, 120];
  if (m < 9) return [120, 180];
  if (m < 12) return [150, 210];
  if (m < 18) return [180, 240];
  if (m < 24) return [240, 300];
  return [300, 360];
}

// Format minutes-of-day (0..1439) as a friendly "8:30 PM".
export function formatMinutesOfDay(mins) {
  let m = ((Math.round(mins) % 1440) + 1440) % 1440;
  const h = Math.floor(m / 60), mm = m % 60;
  const ap = h < 12 ? "AM" : "PM";
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return `${h12}:${String(mm).padStart(2, "0")} ${ap}`;
}

// Predict the next nap window (from the last sleep end + age-based wake window) and
// the typical bedtime (average start of each day's longest evening sleep). Real logs only.
export function predictSleep(sleeps, months, now = new Date()) {
  const valid = (sleeps || [])
    .filter((s) => s && s.startedAt)
    .map((s) => ({ start: new Date(s.startedAt), end: s.endedAt ? new Date(s.endedAt) : null }))
    .filter((s) => !Number.isNaN(s.start.getTime()))
    .sort((a, b) => b.start - a.start);
  if (!valid.length) return { hasData: false };

  const byDay = {};
  for (const s of valid) {
    const k = s.start.toISOString().slice(0, 10);
    const dur = s.end ? s.end - s.start : 0;
    (byDay[k] = byDay[k] || []).push({ ...s, dur });
  }
  const basedOnDays = Object.keys(byDay).length;

  // Bedtime = average start of each day's longest sleep that begins in the evening/night.
  const nightStarts = [];
  for (const k in byDay) {
    const longest = byDay[k].slice().sort((a, b) => b.dur - a.dur)[0];
    if (!longest) continue;
    const h = longest.start.getHours();
    if (h >= 17 || h <= 2) nightStarts.push(longest.start.getHours() * 60 + longest.start.getMinutes());
  }
  let bedtime = null;
  if (nightStarts.length) {
    // Average across the midnight wrap: shift post-midnight starts (before ~3 AM) by 24h
    // so an 11 PM and a 1 AM bedtime average to ~midnight, not noon.
    const shifted = nightStarts.map((m) => (m < 180 ? m + 1440 : m));
    const avg = Math.round(shifted.reduce((a, b) => a + b, 0) / shifted.length) % 1440;
    bedtime = { mid: avg, from: avg - 30, to: avg + 30 };
  }

  // Next nap = last sleep end + wake window (only when the last sleep has ended).
  const [wmin, wmax] = wakeWindowMinutes(months);
  const lastEnd = valid[0].end;
  let nextNap = null;
  if (lastEnd && !Number.isNaN(lastEnd.getTime())) {
    nextNap = {
      from: new Date(lastEnd.getTime() + wmin * 60000),
      to: new Date(lastEnd.getTime() + wmax * 60000),
      lastEnd,
    };
  }

  const confidence = basedOnDays >= 5 ? "High" : basedOnDays >= 3 ? "Medium" : "Building";
  return { hasData: true, basedOnDays, bedtime, nextNap, wakeWindow: [wmin, wmax], confidence };
}

// ---------- Premium: Growth Correlations ----------
// Between each pair of weight measurements, compute weekly weight gain alongside the
// average daily feeds and average daily sleep hours over that same window. Real logs only.
export function growthCorrelations(growthRecords, feeds, sleeps) {
  const recs = (growthRecords || [])
    .filter((r) => r && r.measuredAt && r.weightKg != null)
    .map((r) => ({ at: new Date(r.measuredAt), w: Number(r.weightKg) }))
    .filter((r) => !Number.isNaN(r.at.getTime()) && !Number.isNaN(r.w))
    .sort((a, b) => a.at - b.at);
  if (recs.length < 2) return { hasData: false, needMore: 2 - recs.length };

  const feedAt = (feeds || [])
    .map((f) => (f && f.startedAt ? new Date(f.startedAt) : null))
    .filter((d) => d && !Number.isNaN(d.getTime()));
  const sleepSpans = (sleeps || [])
    .filter((s) => s && s.startedAt && s.endedAt)
    .map((s) => ({ s: new Date(s.startedAt), e: new Date(s.endedAt) }))
    .filter((sp) => !Number.isNaN(sp.s.getTime()) && !Number.isNaN(sp.e.getTime()) && sp.e > sp.s);

  const intervals = [];
  for (let i = 1; i < recs.length; i++) {
    const a = recs[i - 1], b = recs[i];
    const days = Math.max(1, (b.at - a.at) / 86400000);
    const gainPerWeek = Math.round(((b.w - a.w) * 1000) / days * 7);
    const avgFeeds = +(feedAt.filter((t) => t >= a.at && t <= b.at).length / days).toFixed(1);
    let sleepMs = 0;
    for (const sp of sleepSpans) {
      const s = Math.max(sp.s, a.at), e = Math.min(sp.e, b.at);
      if (e > s) sleepMs += e - s;
    }
    const avgSleepHours = +((sleepMs / 3600000) / days).toFixed(1);
    intervals.push({ fromAt: a.at, toAt: b.at, days: Math.round(days), gainPerWeek, avgFeeds, avgSleepHours });
  }
  return { hasData: true, intervals };
}

// ---------- PREMATURE: INTERGROWTH-21st / Fenton Preterm Growth ----------
// PMA = Postmenstrual Age (weeks) = GA_at_birth + (actual_age_in_days / 7)
export function pmaWeeks(profile, at = new Date()) {
  if (!profile?.dateOfBirth) return 0;
  const ga = profile.gestationalAgeAtBirth
    ? Number(profile.gestationalAgeAtBirth)
    : profile.expectedDueDate
      ? 40 - Math.round((new Date(`${profile.expectedDueDate}T00:00:00`) - new Date(`${profile.dateOfBirth}T00:00:00`)) / (7 * 86400000))
      : 40;
  const actualDays = Math.max(0, (at - new Date(`${String(profile.dateOfBirth).slice(0, 10)}T00:00:00`)) / 86400000);
  return Math.max(ga, ga + actualDays / 7);
}

export function pmaWeeksForRecord(profile, measuredAt) {
  return pmaWeeks(profile, new Date(measuredAt));
}

export const PRETERM_CHART_THRESHOLD_WEEKS = 64;

export function usePretermChart(profile) {
  if (!profile || !hasActivePrematureProfile(profile)) return false;
  if (correctedAgeExpired(profile)) return false;
  return pmaWeeks(profile) < PRETERM_CHART_THRESHOLD_WEEKS;
}

// Intergrowth-21st / Fenton 50th percentile preterm reference (simplified)
// [PMA_weeks, weight_kg, length_cm, head_cm]
const PRETERM_REF = [
  [24, 0.63, 31.0, 22.0],
  [26, 0.83, 33.1, 24.0],
  [28, 1.07, 35.4, 25.9],
  [30, 1.36, 37.8, 27.7],
  [32, 1.71, 40.2, 29.3],
  [34, 2.12, 42.5, 30.8],
  [36, 2.58, 44.7, 32.2],
  [38, 2.98, 46.8, 33.5],
  [40, 3.30, 49.0, 34.5],
  [42, 3.70, 51.2, 35.5],
  [44, 4.15, 53.3, 36.5],
  [46, 4.60, 55.3, 37.4],
  [48, 5.05, 57.2, 38.2],
  [50, 5.50, 59.0, 38.9],
  [52, 5.93, 60.7, 39.5],
  [54, 6.33, 62.2, 40.1],
  [56, 6.70, 63.6, 40.6],
  [58, 7.05, 64.8, 41.1],
  [60, 7.38, 66.0, 41.5],
  [62, 7.69, 67.1, 41.9],
  [64, 7.98, 68.1, 42.2]
];

export function pretermMedian(pmaWeeks, metric) {
  const col = metric === "weight" ? 1 : metric === "length" ? 2 : metric === "head" ? 3 : null;
  if (col == null) return null;
  const table = PRETERM_REF;
  const w = Math.max(table[0][0], Math.min(table[table.length - 1][0], pmaWeeks));
  for (let i = 0; i < table.length - 1; i += 1) {
    const [a] = table[i], [b] = table[i + 1];
    if (w >= a && w <= b) {
      const t = b === a ? 0 : (w - a) / (b - a);
      return Math.round((table[i][col] + (table[i + 1][col] - table[i][col]) * t) * 10) / 10;
    }
  }
  return table[table.length - 1][col];
}
