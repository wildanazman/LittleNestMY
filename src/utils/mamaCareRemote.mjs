import { getAuthSession } from "./localAuth.mjs";
import { isSupabaseConfigured, supabase, supabaseConfigMessage } from "./supabaseClient.mjs";

const mamaCareTables = {
  checkins: "mama_checkins",
  supportTasks: "mama_support_tasks",
  medications: "mama_medications",
  appointments: "mama_appointments",
  recoveryNotes: "mama_recovery_notes"
};

export async function loadMamaCareData(babyId) {
  const empty = emptyMamaCareData();
  if (!babyId) return { ...empty, error: "Create a baby profile first to use Mama Care." };
  if (!isSupabaseConfigured) return { ...empty, error: supabaseConfigMessage };
  if (!(await getAuthSession())) return { ...empty, error: "Please log in to sync Mama Care." };

  try {
    const [checkins, supportTasks, medications, appointments, recoveryNotes] = await Promise.all([
      fetchTable(mamaCareTables.checkins, babyId, "checkin_date", false),
      fetchTable(mamaCareTables.supportTasks, babyId, "task_date", false),
      fetchTable(mamaCareTables.medications, babyId, "medication_time", false),
      fetchTable(mamaCareTables.appointments, babyId, "appointment_time", true),
      fetchTable(mamaCareTables.recoveryNotes, babyId, "note_date", false)
    ]);

    return {
      checkins: checkins.map(fromCheckinRow),
      supportTasks: supportTasks.map(fromSupportTaskRow),
      medications: medications.map(fromMedicationRow),
      appointments: appointments.map(fromAppointmentRow),
      recoveryNotes: recoveryNotes.map(fromRecoveryNoteRow),
      error: ""
    };
  } catch (error) {
    return { ...empty, error: friendlyError(error, "load Mama Care data").message };
  }
}

export async function saveMamaCheckin(checkin) {
  const session = await requireSession();
  const row = toCheckinRow(checkin, session.user.id);
  const { data, error } = await supabase
    .from(mamaCareTables.checkins)
    .upsert(row, { onConflict: "baby_id,checkin_date" })
    .select("*")
    .single();
  if (error) throw friendlyError(error, "save Mama check-in");
  return fromCheckinRow(data);
}

export async function saveMamaSupportTask(task) {
  const session = await requireSession();
  const { data, error } = await supabase
    .from(mamaCareTables.supportTasks)
    .upsert(toSupportTaskRow(task, session.user.id), { onConflict: "id" })
    .select("*")
    .single();
  if (error) throw friendlyError(error, "save support task");
  return fromSupportTaskRow(data);
}

export async function updateMamaSupportTaskStatus(taskId, status) {
  const updates = {
    status,
    completed_at: status === "pending" ? null : new Date().toISOString(),
    completed_by: status === "pending" ? null : (await requireSession()).user.id
  };
  const { data, error } = await supabase
    .from(mamaCareTables.supportTasks)
    .update(updates)
    .eq("id", taskId)
    .select("*")
    .single();
  if (error) throw friendlyError(error, "update support task");
  return fromSupportTaskRow(data);
}

export async function deleteMamaSupportTask(taskId) {
  return deleteById(mamaCareTables.supportTasks, taskId, "delete support task");
}

export async function saveMamaMedication(medication) {
  const session = await requireSession();
  const { data, error } = await supabase
    .from(mamaCareTables.medications)
    .upsert(toMedicationRow(medication, session.user.id), { onConflict: "id" })
    .select("*")
    .single();
  if (error) throw friendlyError(error, "save medication");
  return fromMedicationRow(data);
}

export async function updateMamaMedicationStatus(medicationId, status) {
  const { data, error } = await supabase
    .from(mamaCareTables.medications)
    .update({ status })
    .eq("id", medicationId)
    .select("*")
    .single();
  if (error) throw friendlyError(error, "update medication");
  return fromMedicationRow(data);
}

export async function deleteMamaMedication(medicationId) {
  return deleteById(mamaCareTables.medications, medicationId, "delete medication");
}

export async function saveMamaAppointment(appointment) {
  const session = await requireSession();
  const { data, error } = await supabase
    .from(mamaCareTables.appointments)
    .upsert(toAppointmentRow(appointment, session.user.id), { onConflict: "id" })
    .select("*")
    .single();
  if (error) throw friendlyError(error, "save appointment");
  return fromAppointmentRow(data);
}

export async function deleteMamaAppointment(appointmentId) {
  return deleteById(mamaCareTables.appointments, appointmentId, "delete appointment");
}

export async function saveMamaRecoveryNote(note) {
  const session = await requireSession();
  const { data, error } = await supabase
    .from(mamaCareTables.recoveryNotes)
    .upsert(toRecoveryNoteRow(note, session.user.id), { onConflict: "id" })
    .select("*")
    .single();
  if (error) throw friendlyError(error, "save recovery note");
  return fromRecoveryNoteRow(data);
}

export async function deleteMamaRecoveryNote(noteId) {
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

async function deleteById(table, id, action) {
  await requireSession();
  const { error } = await supabase.from(table).delete().eq("id", id);
  if (error) throw friendlyError(error, action);
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
