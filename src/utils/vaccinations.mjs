// Malaysia MOH/KKM National Immunisation Programme (NIP) schedule, 0–18 months,
// plus commonly-recommended optional vaccines. Reference: MOH Malaysia NIP.
//
// Each entry is one administration event (a specific dose) so it can be marked
// done independently. ageMonths drives the due-date calculation from the baby's
// date of birth. region: undefined = whole country; "sarawak"/"sabah" = given
// only in that state's schedule.

export const NIP_SCHEDULE = [
  // At birth
  { key: "bcg", ageMonths: 0, ageLabel: "At birth", vaccine: "BCG", dose: "", protects: "Tuberculosis (TB)" },
  { key: "hepb_1", ageMonths: 0, ageLabel: "At birth", vaccine: "Hepatitis B", dose: "1st dose", protects: "Hepatitis B" },
  // 1 month
  { key: "hepb_2", ageMonths: 1, ageLabel: "1 month", vaccine: "Hepatitis B", dose: "2nd dose", protects: "Hepatitis B" },
  // 2 months
  { key: "sixinone_1", ageMonths: 2, ageLabel: "2 months", vaccine: "6-in-1 (DTaP-IPV-HepB-Hib)", dose: "1st dose", protects: "Diphtheria, Tetanus, Pertussis, Polio, Hib, Hepatitis B" },
  { key: "pcv_1", ageMonths: 2, ageLabel: "2 months", vaccine: "Pneumococcal (PCV)", dose: "1st dose", protects: "Pneumococcal disease (meningitis, pneumonia)" },
  // 3 months
  { key: "sixinone_2", ageMonths: 3, ageLabel: "3 months", vaccine: "6-in-1 (DTaP-IPV-HepB-Hib)", dose: "2nd dose", protects: "Diphtheria, Tetanus, Pertussis, Polio, Hib, Hepatitis B" },
  // 5 months
  { key: "sixinone_3", ageMonths: 5, ageLabel: "5 months", vaccine: "6-in-1 (DTaP-IPV-HepB-Hib)", dose: "3rd dose", protects: "Diphtheria, Tetanus, Pertussis, Polio, Hib, Hepatitis B" },
  { key: "pcv_2", ageMonths: 5, ageLabel: "5 months", vaccine: "Pneumococcal (PCV)", dose: "2nd dose", protects: "Pneumococcal disease" },
  // 6 months (Sabah only)
  { key: "measles_6_sabah", ageMonths: 6, ageLabel: "6 months", vaccine: "Measles", dose: "", protects: "Measles", region: "sabah" },
  // 9 months
  { key: "mmr_1", ageMonths: 9, ageLabel: "9 months", vaccine: "MMR", dose: "1st dose", protects: "Measles, Mumps, Rubella" },
  { key: "je_1_sarawak", ageMonths: 9, ageLabel: "9 months", vaccine: "JE (Japanese Encephalitis)", dose: "1st dose", protects: "Japanese Encephalitis", region: "sarawak" },
  // 12 months
  { key: "mmr_2", ageMonths: 12, ageLabel: "12 months", vaccine: "MMR", dose: "2nd dose", protects: "Measles, Mumps, Rubella" },
  // 15 months
  { key: "pcv_booster", ageMonths: 15, ageLabel: "15 months", vaccine: "Pneumococcal (PCV)", dose: "Booster", protects: "Pneumococcal disease" },
  // 18 months
  { key: "sixinone_booster", ageMonths: 18, ageLabel: "18 months", vaccine: "6-in-1 (DTaP-IPV-HepB-Hib)", dose: "Booster", protects: "Diphtheria, Tetanus, Pertussis, Polio, Hib, Hepatitis B" },
  { key: "je_2_sarawak", ageMonths: 18, ageLabel: "18 months", vaccine: "JE (Japanese Encephalitis)", dose: "2nd dose", protects: "Japanese Encephalitis", region: "sarawak" }
];

// Optional / private-clinic vaccines (not funded under NIP). Shown separately.
export const OPTIONAL_VACCINES = [
  { key: "rotavirus", ageMonths: 2, ageLabel: "2–6 months", vaccine: "Rotavirus (oral)", dose: "2–3 doses", protects: "Severe diarrhoea" },
  { key: "varicella", ageMonths: 12, ageLabel: "After 12 months", vaccine: "Chickenpox (Varicella)", dose: "", protects: "Chickenpox" },
  { key: "influenza", ageMonths: 6, ageLabel: "From 6 months (yearly)", vaccine: "Influenza (flu)", dose: "Annual", protects: "Seasonal flu" },
  { key: "hepa", ageMonths: 12, ageLabel: "After 12 months", vaccine: "Hepatitis A", dose: "2 doses", protects: "Hepatitis A" }
];

export function addMonths(dateStr, months) {
  const date = new Date(dateStr);
  if (Number.isNaN(date.getTime())) return null;
  const result = new Date(date);
  result.setMonth(result.getMonth() + months);
  return result;
}

function startOfDay(date) {
  const copy = new Date(date);
  copy.setHours(0, 0, 0, 0);
  return copy;
}

// status: done | overdue | due (within 14 days) | upcoming
function computeStatus(dueDate, givenOn, now) {
  if (givenOn) return "done";
  if (!dueDate) return "upcoming";
  const today = startOfDay(now);
  const due = startOfDay(dueDate);
  const diffDays = Math.round((due - today) / 86400000);
  if (diffDays < 0) return "overdue";
  if (diffDays <= 14) return "due";
  return "upcoming";
}

// Build the plan for a baby. records: [{ vaccineKey, givenOn }]. region:
// "peninsular" (default) hides Sabah/Sarawak-only items.
export function buildVaccinationPlan(dateOfBirth, records = [], options = {}) {
  const now = options.now ? new Date(options.now) : new Date();
  const region = options.region || "peninsular";
  const recordByKey = new Map(records.filter((r) => r && r.vaccineKey).map((r) => [r.vaccineKey, r]));

  const mapItem = (item, program) => {
    const dueDate = dateOfBirth ? addMonths(dateOfBirth, item.ageMonths) : null;
    const record = recordByKey.get(item.key) || null;
    const givenOn = record?.givenOn || "";
    return {
      ...item,
      program,
      dueDate: dueDate ? dueDate.toISOString() : "",
      givenOn,
      recordId: record?.id || "",
      status: computeStatus(dueDate, givenOn, now)
    };
  };

  const nip = NIP_SCHEDULE
    .filter((item) => !item.region || item.region === region)
    .map((item) => mapItem(item, "nip"));
  const optional = OPTIONAL_VACCINES.map((item) => mapItem(item, "optional"));

  return { nip, optional };
}

export function groupByAge(items) {
  const groups = new Map();
  items.forEach((item) => {
    if (!groups.has(item.ageLabel)) groups.set(item.ageLabel, []);
    groups.get(item.ageLabel).push(item);
  });
  return [...groups.entries()].map(([ageLabel, list]) => ({ ageLabel, items: list }));
}

export function summarise(nipItems) {
  const done = nipItems.filter((i) => i.status === "done").length;
  const overdue = nipItems.filter((i) => i.status === "overdue").length;
  const due = nipItems.filter((i) => i.status === "due").length;
  return { total: nipItems.length, done, overdue, due };
}

// Next upcoming/overdue/due NIP item (for a dashboard hint).
export function nextDue(nipItems) {
  const pending = nipItems
    .filter((i) => i.status !== "done" && i.dueDate)
    .sort((a, b) => new Date(a.dueDate) - new Date(b.dueDate));
  return pending[0] || null;
}
