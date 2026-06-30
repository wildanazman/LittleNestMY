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

export function getAgeMonths(dateOrProfile, at = new Date()) {
  let dateOfBirth;
  if (typeof dateOrProfile === "object" && dateOrProfile !== null && hasActivePrematureProfile(dateOrProfile)) {
    const actualAgeMonths = rawAgeMonths(dateOrProfile.dateOfBirth, at);
    if (actualAgeMonths >= 24) {
      dateOfBirth = dateOrProfile.dateOfBirth;
    } else if (dateOrProfile.expectedDueDate) {
      dateOfBirth = dateOrProfile.expectedDueDate;
    } else if (dateOrProfile.gestationalAgeAtBirth) {
      const ga = Number(dateOrProfile.gestationalAgeAtBirth);
      if (ga < 40) {
        const prematurityDays = Math.round((40 - ga) * 7);
        const dob = new Date(`${String(dateOrProfile.dateOfBirth).slice(0, 10)}T00:00:00`);
        if (!Number.isNaN(dob.getTime())) {
          dob.setDate(dob.getDate() + prematurityDays);
          dateOfBirth = dob.toISOString().slice(0, 10);
        }
      }
    }
    if (!dateOfBirth) dateOfBirth = dateOrProfile.dateOfBirth;
  } else if (typeof dateOrProfile === "object" && dateOrProfile !== null && dateOrProfile.dateOfBirth) {
    dateOfBirth = dateOrProfile.dateOfBirth;
  } else {
    dateOfBirth = dateOrProfile;
  }
  return rawAgeMonths(dateOfBirth, at);
}

function hasActivePrematureProfile(profile) {
  return profile?.isPremature === true || String(profile?.isPremature || "").toLowerCase() === "true";
}

function rawAgeMonths(dateOfBirth, at) {
  const birth = new Date(`${dateOfBirth}T00:00:00`);
  const months = (at.getFullYear() - birth.getFullYear()) * 12 + at.getMonth() - birth.getMonth();
  return Math.max(0, months - (at.getDate() < birth.getDate() ? 1 : 0));
}

export function getFeedingGuideForBaby(dateOrProfile) {
  const months = getAgeMonths(dateOrProfile);
  return breastfeedingGuide.find((row) => months >= row.minMonths && months < row.maxMonths) || breastfeedingGuide[0];
}

export function getMeasurementLabel(dateOrProfile, at = new Date()) {
  return getAgeMonths(dateOrProfile, at) < 24 ? "Length" : "Height";
}
