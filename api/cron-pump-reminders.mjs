import { getServiceClient, hasServerSupabaseConfig } from "./_supabaseAdmin.mjs";
import { configurePush, isPushConfigured, sendPushToUser } from "./_push.mjs";

// Vercel Cron hits this every ~15 minutes. For every user with a push
// subscription, push a "time to pump" reminder for any active pump schedule
// whose time falls in the window since the last run — unless it was skipped
// today or already pumped (a session logged within 75 min of the slot).
//
// NOTE: needs a sub-daily cron, which requires Vercel Pro. On Hobby (daily
// crons only) this fires at most once per day and will miss most pump times.

const WINDOW_MINUTES = 16; // lookback ~= cron interval (+1 for jitter tolerance)
const DONE_WITHIN_MINUTES = 75; // a session this close to the slot counts as done

export default async function handler(req, res) {
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

  // MY local "now" (UTC+8).
  const nowMy = new Date(Date.now() + 8 * 3600000);
  const nowMin = nowMy.getUTCHours() * 60 + nowMy.getUTCMinutes();
  const todayMy = isoDate(nowMy);

  try {
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

    const { data: babies } = await service.from("babies").select("id, name").in("id", babyIds);
    const babyById = new Map((babies || []).map((b) => [b.id, b]));

    const { data: schedules } = await service
      .from("mama_pump_schedules")
      .select("id, baby_id, pump_time, label, active, skipped_dates")
      .in("baby_id", babyIds)
      .eq("active", true);
    if (!schedules?.length) return done(res, { users: userIds.length, babies: babyIds.length, pushes: 0 });

    // Today's pump sessions (MY day) for the "already pumped" check.
    const startUtc = new Date(Date.UTC(nowMy.getUTCFullYear(), nowMy.getUTCMonth(), nowMy.getUTCDate()) - 8 * 3600000);
    const { data: sessions } = await service
      .from("mama_pump_sessions")
      .select("baby_id, started_at")
      .in("baby_id", babyIds)
      .gte("started_at", startUtc.toISOString());
    const sessionMinsByBaby = new Map();
    for (const s of sessions || []) {
      if (!s.started_at) continue;
      const localMin = clockMinutesMy(s.started_at);
      if (!sessionMinsByBaby.has(s.baby_id)) sessionMinsByBaby.set(s.baby_id, []);
      sessionMinsByBaby.get(s.baby_id).push(localMin);
    }

    // baby_id -> list of due schedules right now.
    const dueByBaby = new Map();
    for (const schedule of schedules) {
      const pumpMin = pumpTimeToMinutes(schedule.pump_time);
      if (pumpMin == null) continue;
      const elapsed = nowMin - pumpMin;
      if (elapsed < 0 || elapsed >= WINDOW_MINUTES) continue; // not in this window
      if ((schedule.skipped_dates || []).includes(todayMy)) continue;
      const sessionMins = sessionMinsByBaby.get(schedule.baby_id) || [];
      const alreadyPumped = sessionMins.some((m) => Math.abs(m - pumpMin) <= DONE_WITHIN_MINUTES);
      if (alreadyPumped) continue;
      if (!dueByBaby.has(schedule.baby_id)) dueByBaby.set(schedule.baby_id, []);
      dueByBaby.get(schedule.baby_id).push(schedule);
    }
    if (!dueByBaby.size) return done(res, { users: userIds.length, babies: babyIds.length, pushes: 0 });

    let pushes = 0;
    for (const userId of userIds) {
      const myBabies = (members || []).filter((m) => m.user_id === userId).map((m) => m.baby_id);
      for (const babyId of myBabies) {
        const due = dueByBaby.get(babyId);
        if (!due?.length) continue;
        for (const schedule of due) {
          const babyName = babyById.get(babyId)?.name || "";
          const result = await sendPushToUser(service, userId, {
            title: "Time to pump",
            body: pumpMessage(schedule, babyName),
            // Same tag per schedule per day → OS collapses any duplicate fire.
            tag: `pump-${schedule.id}-${todayMy}`,
            url: "/breast_pumping/"
          });
          pushes += result.sent;
        }
      }
    }
    return done(res, { users: userIds.length, babies: babyIds.length, pushes });
  } catch (error) {
    res.statusCode = 500;
    return res.end(JSON.stringify({ error: error.message || "Cron failed." }));
  }
}

function pumpMessage(schedule, babyName) {
  const clock = formatClock(schedule.pump_time);
  const label = (schedule.label || "").trim();
  const who = babyName ? ` for ${babyName}` : "";
  return label ? `${clock} pump${who}: ${label}.` : `${clock} pump session due${who}.`;
}

// "HH:MM[:SS]" -> minutes since midnight, or null.
function pumpTimeToMinutes(value) {
  if (!value) return null;
  const [h, m] = String(value).split(":");
  const hours = Number(h);
  const mins = Number(m);
  if (!Number.isFinite(hours) || !Number.isFinite(mins)) return null;
  return hours * 60 + mins;
}

// ISO timestamp -> minutes since midnight in MY local time.
function clockMinutesMy(isoString) {
  const d = new Date(new Date(isoString).getTime() + 8 * 3600000);
  return d.getUTCHours() * 60 + d.getUTCMinutes();
}

function formatClock(value) {
  const total = pumpTimeToMinutes(value);
  if (total == null) return "";
  let h = Math.floor(total / 60);
  const m = total % 60;
  const period = h >= 12 ? "PM" : "AM";
  h = h % 12 || 12;
  return `${h}:${String(m).padStart(2, "0")} ${period}`;
}

function isoDate(date) {
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}-${String(date.getUTCDate()).padStart(2, "0")}`;
}

function done(res, payload) {
  res.statusCode = 200;
  res.end(JSON.stringify({ ok: true, ...payload }));
}
