export const babyProfile = {
  id: "baby-aisyah",
  name: "Aisyah",
  dateOfBirth: "2026-02-25",
  gender: "female",
  photoUrl: "/home_dashboard/screen.png",
  notes: "Loves morning cuddles and soft lullabies.",
  createdAt: "2026-06-01T08:00:00+08:00",
  updatedAt: "2026-06-09T08:30:00+08:00"
};

export const feedingLogs = [
  { id: "feed-001", babyId: "baby-aisyah", type: "bottle", startedAt: "2026-06-09T08:00:00+08:00", endedAt: "2026-06-09T08:18:00+08:00", amountMl: 90, notes: "Breastmilk. Finished calmly after burping." },
  { id: "feed-002", babyId: "baby-aisyah", type: "breast", startedAt: "2026-06-09T11:05:00+08:00", endedAt: "2026-06-09T11:28:00+08:00", side: "both", notes: "Mama fed after morning nap." },
  { id: "feed-003", babyId: "baby-aisyah", type: "formula", startedAt: "2026-06-09T14:20:00+08:00", endedAt: "2026-06-09T14:35:00+08:00", amountMl: 100, notes: "Papa helped while Mama rested." }
];

export const sleepLogs = [
  { id: "sleep-001", babyId: "baby-aisyah", status: "night_sleep", startedAt: "2026-06-08T21:15:00+08:00", endedAt: "2026-06-09T05:55:00+08:00", location: "Cot beside Mama and Papa", notes: "Woke once for a quick feed." },
  { id: "sleep-002", babyId: "baby-aisyah", status: "nap", startedAt: "2026-06-09T09:20:00+08:00", endedAt: "2026-06-09T10:10:00+08:00", location: "Living room bassinet", notes: "Short calm nap after tummy time." },
  { id: "sleep-003", babyId: "baby-aisyah", status: "nap", startedAt: "2026-06-09T13:00:00+08:00", endedAt: "2026-06-09T14:05:00+08:00", location: "Daycare cot", notes: "Daycare teacher said she settled well." }
];

export const diaperLogs = [
  { id: "diaper-001", babyId: "baby-aisyah", type: "wet", changedAt: "2026-06-09T06:20:00+08:00", notes: "Morning change." },
  { id: "diaper-002", babyId: "baby-aisyah", type: "mixed", changedAt: "2026-06-09T10:45:00+08:00", color: "Mustard yellow", texture: "Soft", notes: "Normal for today." },
  { id: "diaper-003", babyId: "baby-aisyah", type: "wet", changedAt: "2026-06-09T15:10:00+08:00", notes: "Changed before daycare pickup." }
];

export const healthNotes = [
  { id: "health-001", babyId: "baby-aisyah", type: "clinic", recordedAt: "2026-06-07T10:00:00+08:00", title: "Klinik Kesihatan check-in", details: "Nurse advised to continue normal feeding and monitor sleep routine." },
  { id: "health-002", babyId: "baby-aisyah", type: "temperature", recordedAt: "2026-06-08T19:30:00+08:00", title: "Evening temperature", temperatureC: 36.8, details: "No fever. Baby was active and comfortable." },
  { id: "health-003", babyId: "baby-aisyah", type: "general", recordedAt: "2026-06-09T07:40:00+08:00", title: "Mild spit-up", details: "Small spit-up after feed. Keep upright for a few minutes after makan." }
];

export const milestones = [
  { id: "milestone-001", babyId: "baby-aisyah", title: "First big smile", achievedAt: "2026-05-12", category: "social", notes: "Smiled at Mama during morning play." },
  { id: "milestone-002", babyId: "baby-aisyah", title: "Held head up during tummy time", achievedAt: "2026-06-02", category: "movement", notes: "Managed a few strong seconds. Good job, sayang." },
  { id: "milestone-003", babyId: "baby-aisyah", title: "First daycare settling day", achievedAt: "2026-06-09", category: "memory", notes: "Aisyah stayed calm with Cikgu Nur." }
];

export const calendarEvents = [
  { id: "event-001", babyId: "baby-aisyah", type: "clinic", title: "Klinik Kesihatan appointment", startsAt: "2026-06-12T09:30:00+08:00", location: "Klinik Kesihatan Taman Melati", notes: "Bring MyKid/buku pink and latest growth notes." },
  { id: "event-002", babyId: "baby-aisyah", type: "vaccine", title: "6-month vaccine", startsAt: "2026-06-12T09:30:00+08:00", location: "Klinik Kesihatan Taman Melati", notes: "Check appointment card. Reminder only, not medical advice." },
  { id: "event-003", babyId: "baby-aisyah", type: "daycare", title: "Daycare payment reminder", startsAt: "2026-06-10T07:30:00+08:00", isAllDay: true, location: "Little Stars Daycare", notes: "Prepare payment and extra baju." },
  { id: "event-004", babyId: "baby-aisyah", type: "health", title: "Pediatric checkup", startsAt: "2026-06-20T11:00:00+08:00", location: "Paediatric Clinic", notes: "Bring growth records and feeding notes." }
];

export const familyMembers = [
  { id: "family-001", name: "Mama", role: "parent", permission: "owner", email: "mama@example.my", phone: "+6012-345 6789", acceptedAt: "2026-06-01T08:10:00+08:00" },
  { id: "family-002", name: "Papa", role: "parent", permission: "editor", email: "papa@example.my", phone: "+6017-222 3344", acceptedAt: "2026-06-01T08:15:00+08:00" },
  { id: "family-003", name: "Cikgu Nur", role: "caregiver", permission: "editor", email: "nur.daycare@example.my", invitedAt: "2026-06-08T20:00:00+08:00", acceptedAt: "2026-06-09T07:00:00+08:00" },
  { id: "family-004", name: "Tok Ma", role: "family", permission: "viewer", phone: "+6019-888 1122", invitedAt: "2026-06-09T09:00:00+08:00" }
];

export const assistantSuggestions = [
  { id: "suggestion-001", babyId: "baby-aisyah", category: "feeding", title: "Next feed may be soon", message: "Aisyah usually feeds around every 3 hours. You may want to prepare the next bottle soon.", createdAt: "2026-06-09T10:45:00+08:00", source: "mock", relatedLogId: "feed-001" },
  { id: "suggestion-002", babyId: "baby-aisyah", category: "sleep", title: "Nap window looks close", message: "Kalau Aisyah looks sleepy, a calm nap routine may help her settle gently.", createdAt: "2026-06-09T12:30:00+08:00", source: "mock", relatedLogId: "sleep-002" },
  { id: "suggestion-003", babyId: "baby-aisyah", category: "health", title: "Clinic visit reminder", message: "Klinik Kesihatan appointment is coming up. Bring the appointment card and recent growth records.", createdAt: "2026-06-09T18:00:00+08:00", source: "mock", relatedLogId: "event-001" }
];

export const mockData = {
  babyProfile,
  feedingLogs,
  sleepLogs,
  diaperLogs,
  healthNotes,
  milestones,
  calendarEvents,
  familyMembers,
  assistantSuggestions
};
