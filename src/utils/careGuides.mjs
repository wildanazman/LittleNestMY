export const breastfeedingGuide = [
  {
    age: "0-1 month",
    minMonths: 0,
    maxMonths: 1,
    pattern: "Usually 8-12 feeds/day, around every 2-3 hours",
    solids: "No solids",
    notes: "Follow baby's hunger cues and nurse/doctor advice.",
    suggestedIntervalHours: 2.5
  },
  {
    age: "1-6 months",
    minMonths: 1,
    maxMonths: 6,
    pattern: "Usually every 2-4 hours",
    solids: "No solids",
    notes: "Direct breastfeeding does not need ml amounts.",
    suggestedIntervalHours: 3
  },
  {
    age: "6-8 months",
    minMonths: 6,
    maxMonths: 8,
    pattern: "Continue breast milk",
    solids: "2-3 small meals/day",
    notes: "Start small textures when baby is ready.",
    suggestedIntervalHours: 4
  },
  {
    age: "9-11 months",
    minMonths: 9,
    maxMonths: 11,
    pattern: "Continue breast milk",
    solids: "3-4 meals/day, snacks if needed",
    notes: "Keep mealtimes calm and flexible.",
    suggestedIntervalHours: 4
  },
  {
    age: "12+ months",
    minMonths: 12,
    maxMonths: 240,
    pattern: "Continue breastfeeding if desired",
    solids: "3 meals plus 2-3 snacks",
    notes: "Family foods and breastfeeding can continue together.",
    suggestedIntervalHours: 5
  }
];

export const appointmentChecklist = [
  "Klinik Kesihatan appointment card",
  "Vaccine date and previous record",
  "Baby weight or growth notes",
  "Feeding, sleep, diaper, or health questions",
  "Extra diapers, wipes, and baby clothes"
];

export function getAgeMonths(dateOfBirth, at = new Date()) {
  const birth = new Date(`${dateOfBirth}T00:00:00`);
  const months = (at.getFullYear() - birth.getFullYear()) * 12 + at.getMonth() - birth.getMonth();
  return Math.max(0, months - (at.getDate() < birth.getDate() ? 1 : 0));
}

export function getFeedingGuideForBaby(dateOfBirth) {
  const months = getAgeMonths(dateOfBirth);
  return breastfeedingGuide.find((row) => months >= row.minMonths && months < row.maxMonths) || breastfeedingGuide[0];
}

export function getMeasurementLabel(dateOfBirth, at = new Date()) {
  return getAgeMonths(dateOfBirth, at) < 24 ? "Length" : "Height";
}
