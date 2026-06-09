export type Id = string;
export type ISODate = string;
export type ISODateTime = string;

export type BabyGender = "female" | "male" | "other" | "unknown";
export type FeedingType = "breast" | "bottle" | "formula" | "solid";
export type SleepStatus = "started" | "ended" | "nap" | "night_sleep";
export type DiaperType = "wet" | "dirty" | "mixed" | "dry";
export type HealthNoteType = "medicine" | "symptom" | "temperature" | "clinic" | "general";
export type CalendarEventType = "health" | "vaccine" | "clinic" | "daycare" | "school" | "family" | "reminder" | "other";
export type FamilyRole = "parent" | "guardian" | "caregiver" | "doctor" | "family";
export type PermissionLevel = "owner" | "editor" | "viewer";
export type SuggestionCategory = "feeding" | "sleep" | "diaper" | "health" | "milestone" | "general";

export interface BabyProfile {
  id: Id;
  name: string;
  dateOfBirth: ISODate;
  gender?: BabyGender;
  photoUrl?: string;
  notes?: string;
  createdAt: ISODateTime;
  updatedAt: ISODateTime;
}

export interface FeedingLog {
  id: Id;
  babyId: Id;
  type: FeedingType;
  startedAt: ISODateTime;
  endedAt?: ISODateTime;
  amountMl?: number;
  side?: "left" | "right" | "both";
  foodName?: string;
  notes?: string;
}

export interface SleepLog {
  id: Id;
  babyId: Id;
  status: SleepStatus;
  startedAt: ISODateTime;
  endedAt?: ISODateTime;
  location?: string;
  notes?: string;
}

export interface DiaperLog {
  id: Id;
  babyId: Id;
  type: DiaperType;
  changedAt: ISODateTime;
  color?: string;
  texture?: string;
  notes?: string;
}

export interface HealthNote {
  id: Id;
  babyId: Id;
  type: HealthNoteType;
  recordedAt: ISODateTime;
  title: string;
  details?: string;
  temperatureC?: number;
  medicineName?: string;
  dose?: string;
}

export interface GrowthRecord {
  id: Id;
  babyId: Id;
  recordedAt: ISODateTime;
  weightKg?: number;
  heightCm?: number;
  headCircumferenceCm?: number;
  notes?: string;
}

export interface Milestone {
  id: Id;
  babyId: Id;
  title: string;
  achievedAt: ISODate;
  category?: "movement" | "communication" | "social" | "feeding" | "memory" | "other";
  photoUrl?: string;
  notes?: string;
}

export interface CalendarEvent {
  id: Id;
  babyId?: Id;
  type: CalendarEventType;
  title: string;
  startsAt: ISODateTime;
  endsAt?: ISODateTime;
  location?: string;
  notes?: string;
  isAllDay?: boolean;
}

export interface FamilyMember {
  id: Id;
  name: string;
  role: FamilyRole;
  permission: PermissionLevel;
  email?: string;
  phone?: string;
  photoUrl?: string;
  invitedAt?: ISODateTime;
  acceptedAt?: ISODateTime;
}

export interface AssistantSuggestion {
  id: Id;
  babyId?: Id;
  category: SuggestionCategory;
  title: string;
  message: string;
  createdAt: ISODateTime;
  source?: "mock" | "rule";
  relatedLogId?: Id;
}
