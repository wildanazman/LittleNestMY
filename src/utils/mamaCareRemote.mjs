import { getAuthSession } from "./localAuth.mjs";
import { isSupabaseConfigured, supabase, supabaseConfigMessage } from "./supabaseClient.mjs";

const mamaCareTables = {
  checkins: "mama_checkins",
  supportTasks: "mama_support_tasks",
  medications: "mama_medications",
  appointments: "mama_appointments",
  recoveryNotes: "mama_recovery_notes"
};

const mamaCareKeys = {
  checkins: "littlenest:mamaCheckins",
  supportTasks: "littlenest:mamaSupportTasks",
  medications: "littlenest:mamaMedications",
  appointments: "littlenest:mamaAppointments",
  recoveryNotes: "littlenest:mamaRecoveryNotes"
};

export async function loadMamaCareData(babyId) {
  const local = loadMamaCareDataLocal(babyId);
  if (!babyId) return { ...local, error: "Create a baby profile first to use Mama Care." };
  if (!isSupabaseConfigured) return { ...local, error: supabaseConfigMessage };
  if (!(await getAuthSession())) return { ...local, error: "Please log in to sync Mama Care." };

  try {
    const [checkins, supportTasks, medications, appointments, recoveryNotes] = await Promise.all([
      fetchTable(mamaCareTables.checkins, babyId, "checkin_date", false),
      fetchTable(mamaCareTables.supportTasks, babyId, "task_date", false),
      fetchTable(mamaCareTables.medications, babyId, "medication_time", false),
      fetchTable(mamaCareTables.appointments, babyId, "appointment_time", true),
      fetchTable(mamaCareTables.recoveryNotes, babyId, "note_date", false)
    ]);

    const remote = {
      checkins: checkins.map(fromCheckinRow),
      supportTasks: supportTasks.map(fromSupportTaskRow),
      medications: medications.map(fromMedicationRow),
      appointments: appointments.map(fromAppointmentRow),
      recoveryNotes: recoveryNotes.map(fromRecoveryNoteRow),
      error: ""
    };
    cacheMamaCareData(remote);
    return remote;
  } catch (error) {
    return { ...local, error: friendlyError(error, "load Mama Care data").message };
  }
}

export function loadMamaCareDataLocal(babyId) {
  return {
    checkins: forBaby(readJson(mamaCareKeys.checkins, []), babyId),
    supportTasks: forBaby(readJson(mamaCareKeys.supportTasks, []), babyId),
    medications: forBaby(readJson(mamaCareKeys.medications, []), babyId),
    appointments: forBaby(readJson(mamaCareKeys.appointments, []), babyId),
    recoveryNotes: forBaby(readJson(mamaCareKeys.recoveryNotes, []), babyId),
    error: ""
  };
}

export async function saveMamaCheckin(checkin) {
  const session = await getWritableSession();
  const local = normalizeLocalCheckin(checkin);
  if (!session) return saveLocal(mamaCareKeys.checkins, local);
  const row = toCheckinRow(checkin, session.user.id);
  const { data, error } = await supabase
    .from(mamaCareTables.checkins)
    .upsert(row, { onConflict: "baby_id,checkin_date" })
    .select("*")
    .single();
  if (error) throw friendlyError(error, "save Mama check-in");
  return saveLocal(mamaCareKeys.checkins, fromCheckinRow(data));
}

export async function saveMamaSupportTask(task) {
  const session = await getWritableSession();
  const local = normalizeLocalSupportTask(task);
  if (!session) return saveLocal(mamaCareKeys.supportTasks, local);
  const remoteTask = task.id && !isRemoteId(task.id) ? { ...task, id: "" } : task;
  const { data, error } = await supabase
    .from(mamaCareTables.supportTasks)
    .upsert(toSupportTaskRow(remoteTask, session.user.id), { onConflict: "id" })
    .select("*")
    .single();
  if (error) throw friendlyError(error, "save support task");
  if (task.id && !isRemoteId(task.id)) deleteLocal(mamaCareKeys.supportTasks, task.id);
  return saveLocal(mamaCareKeys.supportTasks, fromSupportTaskRow(data));
}

export async function updateMamaSupportTaskStatus(taskId, status) {
  const session = await getWritableSession();
  if (!session || !isRemoteId(taskId)) return updateLocalStatus(mamaCareKeys.supportTasks, taskId, status);
  const updates = {
    status,
    completed_at: status === "pending" ? null : new Date().toISOString(),
    completed_by: status === "pending" ? null : session.user.id
  };
  const { data, error } = await supabase
    .from(mamaCareTables.supportTasks)
    .update(updates)
    .eq("id", taskId)
    .select("*")
    .single();
  if (error) throw friendlyError(error, "update support task");
  return saveLocal(mamaCareKeys.supportTasks, fromSupportTaskRow(data));
}

export async function deleteMamaSupportTask(taskId) {
  deleteLocal(mamaCareKeys.supportTasks, taskId);
  if (!(await getWritableSession()) || !isRemoteId(taskId)) return true;
  return deleteById(mamaCareTables.supportTasks, taskId, "delete support task");
}

export async function saveMamaMedication(medication) {
  const session = await getWritableSession();
  const local = normalizeLocalMedication(medication);
  if (!session) return saveLocal(mamaCareKeys.medications, local);
  const remoteMedication = medication.id && !isRemoteId(medication.id) ? { ...medication, id: "" } : medication;
  const { data, error } = await supabase
    .from(mamaCareTables.medications)
    .upsert(toMedicationRow(remoteMedication, session.user.id), { onConflict: "id" })
    .select("*")
    .single();
  if (error) throw friendlyError(error, "save medication");
  if (medication.id && !isRemoteId(medication.id)) deleteLocal(mamaCareKeys.medications, medication.id);
  return saveLocal(mamaCareKeys.medications, fromMedicationRow(data));
}

export async function updateMamaMedicationStatus(medicationId, status) {
  const session = await getWritableSession();
  if (!session || !isRemoteId(medicationId)) return updateLocalStatus(mamaCareKeys.medications, medicationId, status);
  const { data, error } = await supabase
    .from(mamaCareTables.medications)
    .update({ status })
    .eq("id", medicationId)
    .select("*")
    .single();
  if (error) throw friendlyError(error, "update medication");
  return saveLocal(mamaCareKeys.medications, fromMedicationRow(data));
}

export async function deleteMamaMedication(medicationId) {
  deleteLocal(mamaCareKeys.medications, medicationId);
  if (!(await getWritableSession()) || !isRemoteId(medicationId)) return true;
  return deleteById(mamaCareTables.medications, medicationId, "delete medication");
}

export async function saveMamaAppointment(appointment) {
  const session = await getWritableSession();
  const local = normalizeLocalAppointment(appointment);
  if (!session) return saveLocal(mamaCareKeys.appointments, local);
  const remoteAppointment = appointment.id && !isRemoteId(appointment.id) ? { ...appointment, id: "" } : appointment;
  const { data, error } = await supabase
    .from(mamaCareTables.appointments)
    .upsert(toAppointmentRow(remoteAppointment, session.user.id), { onConflict: "id" })
    .select("*")
    .single();
  if (error) throw friendlyError(error, "save appointment");
  if (appointment.id && !isRemoteId(appointment.id)) deleteLocal(mamaCareKeys.appointments, appointment.id);
  return saveLocal(mamaCareKeys.appointments, fromAppointmentRow(data));
}

export async function deleteMamaAppointment(appointmentId) {
  deleteLocal(mamaCareKeys.appointments, appointmentId);
  if (!(await getWritableSession()) || !isRemoteId(appointmentId)) return true;
  return deleteById(mamaCareTables.appointments, appointmentId, "delete appointment");
}

export async function saveMamaRecoveryNote(note) {
  const session = await getWritableSession();
  const local = normalizeLocalRecoveryNote(note);
  if (!session) return saveLocal(mamaCareKeys.recoveryNotes, local);
  const remoteNote = note.id && !isRemoteId(note.id) ? { ...note, id: "" } : note;
  const { data, error } = await supabase
    .from(mamaCareTables.recoveryNotes)
    .upsert(toRecoveryNoteRow(remoteNote, session.user.id), { onConflict: "id" })
    .select("*")
    .single();
  if (error) throw friendlyError(error, "save recovery note");
  if (note.id && !isRemoteId(note.id)) deleteLocal(mamaCareKeys.recoveryNotes, note.id);
  return saveLocal(mamaCareKeys.recoveryNotes, fromRecoveryNoteRow(data));
}

export async function deleteMamaRecoveryNote(noteId) {
  deleteLocal(mamaCareKeys.recoveryNotes, noteId);
  if (!(await getWritableSession()) || !isRemoteId(noteId)) return true;
  return deleteById(mamaCareTables.recoveryNotes, noteId, "delete recovery note");
}

function emptyMamaCareData() {
  return {
    checkins: [],
    supportTasks: [],
    medications: [],
    appointments: [],
    recoveryNotes: []
  };
}

async function fetchTable(table, babyId, orderColumn, ascending) {
  const { data, error } = await supabase
    .from(table)
    .select("*")
    .eq("baby_id", babyId)
    .order(orderColumn, { ascending, nullsFirst: false });
  if (error) throw error;
  return data || [];
}

function cacheMamaCareData(data) {
  writeBabyItems(mamaCareKeys.checkins, data.checkins);
  writeBabyItems(mamaCareKeys.supportTasks, data.supportTasks);
  writeBabyItems(mamaCareKeys.medications, data.medications);
  writeBabyItems(mamaCareKeys.appointments, data.appointments);
  writeBabyItems(mamaCareKeys.recoveryNotes, data.recoveryNotes);
}

function writeBabyItems(key, nextItems) {
  const babyIds = new Set((nextItems || []).map((item) => item.babyId));
  const existing = readJson(key, []).filter((item) => !babyIds.has(item.babyId));
  writeJson(key, [...(nextItems || []), ...existing]);
}

function saveLocal(key, item) {
  const items = readJson(key, []);
  writeJson(key, [item, ...items.filter((entry) => entry.id !== item.id)]);
  return item;
}

function deleteLocal(key, id) {
  writeJson(key, readJson(key, []).filter((item) => item.id !== id));
}

function updateLocalStatus(key, id, status) {
  const now = new Date().toISOString();
  const items = readJson(key, []);
  const updated = items.map((item) => item.id === id
    ? {
        ...item,
        status,
        completedAt: status === "pending" ? "" : now,
        updatedAt: now
      }
    : item);
  writeJson(key, updated);
  return updated.find((item) => item.id === id) || null;
}

function forBaby(items, babyId) {
  return babyId ? (items || []).filter((item) => item.babyId === babyId) : [];
}

function readJson(key, fallback) {
  try {
    const value = window.localStorage.getItem(key);
    return value ? JSON.parse(value) : fallback;
  } catch {
    return fallback;
  }
}

function writeJson(key, value) {
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Local storage can be unavailable in restricted browser contexts.
  }
}

async function deleteById(table, id, action) {
  await requireSession();
  const { error } = await supabase.from(table).delete().eq("id", id);
  if (error) throw friendlyError(error, action);
}

async function getWritableSession() {
  if (!isSupabaseConfigured) return null;
  const session = await getAuthSession();
  return session?.user?.id ? session : null;
}

async function requireSession() {
  if (!isSupabaseConfigured) throw new Error(supabaseConfigMessage);
  const session = await getAuthSession();
  if (!session?.user?.id) throw new Error("Please log in to use Mama Care.");
  return session;
}

function toCheckinRow(checkin, userId) {
  return {
    baby_id: checkin.babyId,
    created_by: userId,
    checkin_date: checkin.checkinDate,
    mood: clean(checkin.mood),
    pain_level: nullableNumber(checkin.painLevel),
    bleeding: clean(checkin.bleeding),
    sleep_hours: nullableNumber(checkin.sleepHours),
    water_cups: nullableNumber(checkin.waterCups),
    meals_count: nullableNumber(checkin.mealsCount),
    breastfeeding_comfort: clean(checkin.breastfeedingComfort),
    wound_note: clean(checkin.woundNote),
    toilet_note: clean(checkin.toiletNote),
    notes: clean(checkin.notes)
  };
}

function fromCheckinRow(row) {
  return {
    id: row.id,
    babyId: row.baby_id,
    createdBy: row.created_by,
    checkinDate: row.checkin_date,
    mood: row.mood || "",
    painLevel: row.pain_level ?? "",
    bleeding: row.bleeding || "",
    sleepHours: row.sleep_hours ?? "",
    waterCups: row.water_cups ?? "",
    mealsCount: row.meals_count ?? "",
    breastfeedingComfort: row.breastfeeding_comfort || "",
    woundNote: row.wound_note || "",
    toiletNote: row.toilet_note || "",
    notes: row.notes || "",
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

function toSupportTaskRow(task, userId) {
  return withOptionalId(task.id, {
    baby_id: task.babyId,
    created_by: userId,
    task_title: clean(task.taskTitle),
    task_date: task.taskDate,
    status: task.status || "pending",
    notes: clean(task.notes)
  });
}

function fromSupportTaskRow(row) {
  return {
    id: row.id,
    babyId: row.baby_id,
    createdBy: row.created_by,
    taskTitle: row.task_title,
    taskDate: row.task_date,
    status: row.status || "pending",
    completedBy: row.completed_by || "",
    completedAt: row.completed_at || "",
    notes: row.notes || "",
    createdAt: row.created_at
  };
}

function toMedicationRow(medication, userId) {
  return withOptionalId(medication.id, {
    baby_id: medication.babyId,
    created_by: userId,
    medication_name: clean(medication.medicationName),
    dose: clean(medication.dose),
    medication_time: medication.medicationTime || null,
    status: medication.status || "pending",
    notes: clean(medication.notes)
  });
}

function fromMedicationRow(row) {
  return {
    id: row.id,
    babyId: row.baby_id,
    createdBy: row.created_by,
    medicationName: row.medication_name,
    dose: row.dose || "",
    medicationTime: row.medication_time || "",
    status: row.status || "pending",
    notes: row.notes || "",
    createdAt: row.created_at
  };
}

function toAppointmentRow(appointment, userId) {
  return withOptionalId(appointment.id, {
    baby_id: appointment.babyId,
    created_by: userId,
    title: clean(appointment.title),
    appointment_time: appointment.appointmentTime || null,
    location: clean(appointment.location),
    notes: clean(appointment.notes),
    reminder_enabled: Boolean(appointment.reminderEnabled)
  });
}

function fromAppointmentRow(row) {
  return {
    id: row.id,
    babyId: row.baby_id,
    createdBy: row.created_by,
    title: row.title,
    appointmentTime: row.appointment_time || "",
    location: row.location || "",
    notes: row.notes || "",
    reminderEnabled: Boolean(row.reminder_enabled),
    createdAt: row.created_at
  };
}

function toRecoveryNoteRow(note, userId) {
  return withOptionalId(note.id, {
    baby_id: note.babyId,
    created_by: userId,
    note_date: note.noteDate,
    note_type: clean(note.noteType),
    note: clean(note.note)
  });
}

function withOptionalId(id, row) {
  return id ? { id, ...row } : row;
}

function fromRecoveryNoteRow(row) {
  return {
    id: row.id,
    babyId: row.baby_id,
    createdBy: row.created_by,
    noteDate: row.note_date,
    noteType: row.note_type || "",
    note: row.note || "",
    createdAt: row.created_at
  };
}

function normalizeLocalCheckin(checkin) {
  const existing = readJson(mamaCareKeys.checkins, []).find((item) => item.babyId === checkin.babyId && item.checkinDate === checkin.checkinDate);
  const now = new Date().toISOString();
  return {
    id: checkin.id || existing?.id || localId("checkin"),
    babyId: checkin.babyId,
    checkinDate: checkin.checkinDate,
    mood: checkin.mood || "",
    painLevel: checkin.painLevel ?? "",
    bleeding: checkin.bleeding || "",
    sleepHours: checkin.sleepHours ?? "",
    waterCups: checkin.waterCups ?? "",
    mealsCount: checkin.mealsCount ?? "",
    breastfeedingComfort: checkin.breastfeedingComfort || "",
    woundNote: checkin.woundNote || "",
    toiletNote: checkin.toiletNote || "",
    notes: checkin.notes || "",
    createdAt: checkin.createdAt || existing?.createdAt || now,
    updatedAt: now
  };
}

function normalizeLocalSupportTask(task) {
  const now = new Date().toISOString();
  return {
    id: task.id || localId("task"),
    babyId: task.babyId,
    taskTitle: task.taskTitle || "",
    taskDate: task.taskDate,
    status: task.status || "pending",
    completedBy: task.completedBy || "",
    completedAt: task.completedAt || "",
    notes: task.notes || "",
    createdAt: task.createdAt || now,
    updatedAt: now
  };
}

function normalizeLocalMedication(medication) {
  const now = new Date().toISOString();
  return {
    id: medication.id || localId("med"),
    babyId: medication.babyId,
    medicationName: medication.medicationName || "",
    dose: medication.dose || "",
    medicationTime: medication.medicationTime || "",
    status: medication.status || "pending",
    notes: medication.notes || "",
    createdAt: medication.createdAt || now,
    updatedAt: now
  };
}

function normalizeLocalAppointment(appointment) {
  const now = new Date().toISOString();
  return {
    id: appointment.id || localId("appt"),
    babyId: appointment.babyId,
    title: appointment.title || "",
    appointmentTime: appointment.appointmentTime || "",
    location: appointment.location || "",
    notes: appointment.notes || "",
    reminderEnabled: Boolean(appointment.reminderEnabled),
    createdAt: appointment.createdAt || now,
    updatedAt: now
  };
}

function normalizeLocalRecoveryNote(note) {
  const now = new Date().toISOString();
  return {
    id: note.id || localId("note"),
    babyId: note.babyId,
    noteDate: note.noteDate,
    noteType: note.noteType || "",
    note: note.note || "",
    createdAt: note.createdAt || now,
    updatedAt: now
  };
}

function localId(prefix) {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function isRemoteId(id) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(String(id || ""));
}

function nullableNumber(value) {
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function clean(value) {
  const text = String(value || "").trim();
  return text || null;
}

function friendlyError(error, action) {
  const message = error?.message || String(error || "");
  if (/Could not find the table|schema cache|does not exist/i.test(message)) {
    return new Error(`Mama Care database tables are not ready. Run supabase/migrations/004_mama_care.sql, then try again.`);
  }
  if (/row-level security|permission denied|violates row-level security/i.test(message)) {
    return new Error(`Supabase RLS blocked ${action}. Check Mama Care policies for parent/caregiver write access and viewer read-only access. Original error: ${message}`);
  }
  return new Error(message || `Could not ${action}.`);
}
