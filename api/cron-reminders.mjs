import { getServiceClient, hasServerSupabaseConfig } from "./_supabaseAdmin.mjs";
import { configurePush, isPushConfigured, sendPushToUser } from "./_push.mjs";
import { buildVaccinationPlan } from "../src/utils/vaccinations.mjs";

// Vercel Cron hits this daily. For every user with a push subscription, check
// their babies' NIP vaccination schedule and push a reminder for doses due
// today, due in 3 days, or (weekly) overdue. Keeps spam low without a dedupe
// table by only firing on those specific day offsets.

export default async function handler(req, res) {
  // Only allow Vercel Cron (or a caller with the secret). Tolerate stray
  // whitespace/quotes that can sneak into env values when pasted.
  const secret = (process.env.CRON_SECRET || "").trim().replace(/^["']|["']$/g, "");
  const provided = (req.headers.authorization || "").replace(/^Bearer\s+/i, "").trim().replace(/^["']|["']$/g, "");
  if (secret && provided !== secret) {
    res.statusCode = 401;
    return res.end(JSON.stringify({ error: "Unauthorized.", hint: `expected length ${secret.length}` }));
  }
  if (!hasServerSupabaseConfig() || !isPushConfigured()) {
    res.statusCode = 500;
    return res.end(JSON.stringify({ error: "Push or Supabase not configured." }));
  }

  // MY local "today" (UTC+8) for due-date math.
  const nowMy = new Date(Date.now() + 8 * 3600000);
  const todayMy = new Date(Date.UTC(nowMy.getUTCFullYear(), nowMy.getUTCMonth(), nowMy.getUTCDate()));
  const isMonday = todayMy.getUTCDay() === 1;

  try {
    // Inside try: an invalid VAPID key throws here, returns a clean error
    // instead of crashing the function.
    if (!configurePush()) {
      res.statusCode = 500;
      return res.end(JSON.stringify({ error: "VAPID keys missing or invalid." }));
    }
    const service = getServiceClient();
    const { data: subs } = await service.from("push_subscriptions").select("user_id");
    const userIds = [...new Set((subs || []).map((s) => s.user_id).filter(Boolean))];
    if (!userIds.length) return done(res, { users: 0, pushes: 0 });

    const { data: members } = await service.from("baby_members").select("baby_id, user_id").in("user_id", userIds);
    const babyIds = [...new Set((members || []).map((m) => m.baby_id).filter(Boolean))];
    if (!babyIds.length) return done(res, { users: userIds.length, pushes: 0 });

    const { data: babies } = await service.from("babies").select("id, name, date_of_birth").in("id", babyIds);
    const babyById = new Map((babies || []).map((b) => [b.id, b]));
    const { data: records } = await service.from("vaccination_records").select("baby_id, vaccine_key, given_on").in("baby_id", babyIds);
    const recordsByBaby = new Map();
    for (const r of records || []) {
      if (!recordsByBaby.has(r.baby_id)) recordsByBaby.set(r.baby_id, []);
      recordsByBaby.get(r.baby_id).push({ vaccineKey: r.vaccine_key, givenOn: r.given_on });
    }

    // baby_id -> reminder message (computed once per baby, reused per member)
    const messageByBaby = new Map();
    for (const babyId of babyIds) {
      const baby = babyById.get(babyId);
      if (!baby?.date_of_birth) continue;
      const plan = buildVaccinationPlan(baby.date_of_birth, recordsByBaby.get(babyId) || [], { now: todayMy.toISOString(), region: "peninsular" });
      const msg = vaccineMessage(plan.nip, baby.name || "Baby", todayMy, isMonday);
      if (msg) messageByBaby.set(babyId, msg);
    }

    // Send per user (one push per baby that has a due/overdue message).
    let pushes = 0;
    for (const userId of userIds) {
      const myBabies = (members || []).filter((m) => m.user_id === userId).map((m) => m.baby_id);
      for (const babyId of myBabies) {
        const msg = messageByBaby.get(babyId);
        if (!msg) continue;
        const result = await sendPushToUser(service, userId, {
          title: "Vaccination reminder",
          body: msg,
          tag: `vaccine-${babyId}`,
          url: "/vaccinations/"
        });
        pushes += result.sent;
      }
    }
    return done(res, { users: userIds.length, babies: babyIds.length, pushes });
  } catch (error) {
    res.statusCode = 500;
    return res.end(JSON.stringify({ error: error.message || "Cron failed." }));
  }
}

function vaccineMessage(nip, babyName, todayMy, isMonday) {
  const dayMs = 86400000;
  const dueToday = [];
  const dueSoon = [];
  const overdue = [];
  for (const item of nip) {
    if (item.status === "done" || !item.dueDate) continue;
    const due = new Date(item.dueDate);
    const dueDay = new Date(Date.UTC(due.getUTCFullYear(), due.getUTCMonth(), due.getUTCDate()));
    const days = Math.round((dueDay - todayMy) / dayMs);
    const label = item.dose ? `${item.vaccine} (${item.dose})` : item.vaccine;
    if (days === 0) dueToday.push(label);
    else if (days === 3) dueSoon.push(label);
    else if (days < 0) overdue.push(label);
  }
  if (dueToday.length) return `${babyName}: ${joinList(dueToday)} due today. Book a clinic slot.`;
  if (dueSoon.length) return `${babyName}: ${joinList(dueSoon)} due in 3 days.`;
  if (isMonday && overdue.length) return `${babyName}: ${overdue.length} vaccine${overdue.length === 1 ? "" : "s"} overdue (${joinList(overdue)}). Please catch up.`;
  return "";
}

function joinList(items) {
  const max = 2;
  if (items.length <= max) return items.join(", ");
  return `${items.slice(0, max).join(", ")} +${items.length - max} more`;
}

function done(res, payload) {
  res.statusCode = 200;
  res.end(JSON.stringify({ ok: true, ...payload }));
}
