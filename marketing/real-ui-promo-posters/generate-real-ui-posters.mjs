import fs from "node:fs/promises";
import path from "node:path";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
let chromium;
try {
  ({ chromium } = require("playwright"));
} catch (error) {
  throw new Error("Playwright is required to capture the real app UI. Install it in the project or run with NODE_PATH pointing to a node_modules folder that contains playwright.");
}

const baseUrl = process.env.LITTLENEST_BASE_URL || "http://127.0.0.1:5173";
const here = path.dirname(new URL(import.meta.url).pathname).replace(/^\/([A-Za-z]:)/, "$1");
const outputDir = path.join(here, "output");
const captureDir = path.join(outputDir, "captures");

const posterSpecs = [
  {
    id: "instagram",
    filename: "littlenest-instagram-real-ui.png",
    label: "Instagram",
    width: 1080,
    height: 1350,
    headline: "Baby care, calm at a glance.",
    subhead: "Feeds, sleep, diapers, milestones, appointments, and Mama Care in one premium family app.",
    theme: "warm",
    shots: ["home", "feeding", "milestones"]
  },
  {
    id: "facebook",
    filename: "littlenest-facebook-real-ui.png",
    label: "Facebook",
    width: 1200,
    height: 1500,
    headline: "One home for every little routine.",
    subhead: "Fast logging, clear daily summaries, and shared care for Malaysian families.",
    theme: "sage",
    shots: ["home", "calendar", "baby_profiles"]
  },
  {
    id: "threads",
    filename: "littlenest-threads-real-ui.png",
    label: "Threads",
    width: 1080,
    height: 1920,
    headline: "Less guessing. More gentle rhythm.",
    subhead: "Know the next feed, recent sleep, today’s log, appointments, and memories without digging.",
    theme: "blue",
    shots: ["home", "milestones", "calendar"]
  },
  {
    id: "app-store",
    filename: "littlenest-app-store-real-ui.png",
    label: "App Store",
    width: 1290,
    height: 2796,
    headline: "LittleNest MY",
    subhead: "Premium baby tracking for feeds, sleep, diapers, milestones, appointments, and Mama Care.",
    theme: "pink",
    shots: ["home", "feeding", "baby_profiles"]
  }
];

const screenShots = [
  { id: "home", route: "/home_dashboard/", waitFor: "#homeContent:not(.hidden)" },
  { id: "feeding", route: "/feeding_log/", waitFor: "body" },
  { id: "milestones", route: "/milestones/", waitFor: "#milestonesContent:not(.hidden)" },
  { id: "calendar", route: "/calendar/", waitFor: "body" },
  { id: "baby_profiles", route: "/baby_profiles/", waitFor: "body" }
];

await fs.mkdir(captureDir, { recursive: true });

const browser = await chromium.launch({ channel: process.env.PLAYWRIGHT_CHANNEL || "msedge", headless: true });
const context = await browser.newContext({
  viewport: { width: 474, height: 900 },
  deviceScaleFactor: 2,
  isMobile: true,
  hasTouch: true,
  userAgent: "Mozilla/5.0 (iPhone; CPU iPhone OS 18_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.5 Mobile/15E148 Safari/604.1"
});

const page = await context.newPage();
await page.goto(`${baseUrl}/auth_welcome/`, { waitUntil: "domcontentloaded" });
await seedDemoData(page);

const captures = {};
for (const shot of screenShots) {
  await page.goto(`${baseUrl}${shot.route}`, { waitUntil: "networkidle" });
  await page.waitForSelector(shot.waitFor, { timeout: 15000 }).catch(() => {});
  await page.waitForTimeout(1200);
  const file = path.join(captureDir, `${shot.id}.png`);
  await page.screenshot({ path: file, fullPage: false });
  captures[shot.id] = `data:image/png;base64,${(await fs.readFile(file)).toString("base64")}`;
}

const posterPage = await context.newPage();
for (const spec of posterSpecs) {
  await posterPage.setViewportSize({ width: spec.width, height: spec.height });
  await posterPage.setContent(renderPosterHtml(spec, captures), { waitUntil: "load" });
  await posterPage.waitForTimeout(600);
  await posterPage.screenshot({ path: path.join(outputDir, spec.filename), fullPage: true });
}

await posterPage.setViewportSize({ width: 1440, height: 1200 });
await posterPage.setContent(renderSheetHtml(captures), { waitUntil: "load" });
await posterPage.screenshot({ path: path.join(outputDir, "poster-proof-sheet.png"), fullPage: true });

await browser.close();

await fs.writeFile(path.join(here, "README.md"), `# LittleNest Real UI Promo Posters

Generated from real local app screens at \`${baseUrl}\` with fictional demo data.

## Output

- \`output/littlenest-instagram-real-ui.png\` (1080x1350)
- \`output/littlenest-facebook-real-ui.png\` (1200x1500)
- \`output/littlenest-threads-real-ui.png\` (1080x1920)
- \`output/littlenest-app-store-real-ui.png\` (1290x2796)
- \`output/poster-proof-sheet.png\`
- \`output/captures/*.png\` real app screenshots used inside the posters

## Regenerate

\`\`\`powershell
node marketing/real-ui-promo-posters/generate-real-ui-posters.mjs
\`\`\`

Set \`LITTLENEST_BASE_URL\` if the local app runs on a different port.
If Playwright is not installed in the project, run with \`NODE_PATH\` pointing to a node_modules folder that contains Playwright.
`);

console.log(`Generated ${posterSpecs.length} posters in ${outputDir}`);

async function seedDemoData(page) {
  await page.evaluate(() => {
    const now = new Date();
    const isoAt = (hoursAgo = 0, minutesAgo = 0) => new Date(now.getTime() - ((hoursAgo * 60) + minutesAgo) * 60000).toISOString();
    const localDate = (offsetDays = 0) => {
      const d = new Date(now);
      d.setDate(d.getDate() + offsetDays);
      d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
      return d.toISOString().slice(0, 10);
    };
    const atTime = (hour, minute = 0, offsetDays = 0) => {
      const d = new Date(now);
      d.setDate(d.getDate() + offsetDays);
      d.setHours(hour, minute, 0, 0);
      return d.toISOString();
    };
    const babyPhoto = "data:image/svg+xml;charset=utf-8," + encodeURIComponent(`
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 240 240">
        <defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop stop-color="#ffd8c8"/><stop offset=".55" stop-color="#eee8ff"/><stop offset="1" stop-color="#dff3e7"/></linearGradient></defs>
        <rect width="240" height="240" rx="120" fill="url(#g)"/>
        <circle cx="120" cy="98" r="42" fill="#fffaf6" opacity=".88"/>
        <path d="M56 190c14-42 114-42 128 0" fill="#fffaf6" opacity=".88"/>
        <circle cx="106" cy="96" r="7" fill="#7c5cff"/><circle cx="134" cy="96" r="7" fill="#7c5cff"/>
        <path d="M103 120c12 10 24 10 36 0" fill="none" stroke="#83533c" stroke-width="8" stroke-linecap="round"/>
      </svg>`);
    const parentPhoto = "data:image/svg+xml;charset=utf-8," + encodeURIComponent(`
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 240 240">
        <rect width="240" height="240" rx="120" fill="#f8efe8"/>
        <circle cx="120" cy="88" r="42" fill="#ffcab1"/>
        <path d="M50 196c15-52 125-52 140 0" fill="#7c5cff" opacity=".86"/>
      </svg>`);

    const babyId = "demo-baby-hana";
    const parent = { name: "Nadia Rahman", email: "nadia@example.test", photoUrl: parentPhoto, updatedAt: now.toISOString() };
    const baby = {
      id: babyId,
      name: "Hana",
      dateOfBirth: "2026-02-14",
      gender: "girl",
      feedingPreference: "mixed",
      photoUrl: babyPhoto,
      createdAt: "2026-02-14T08:00:00.000Z",
      updatedAt: now.toISOString()
    };

    const feedingLogs = [
      { id: "feed-1", babyId, type: "formula", amountMl: 120, startedAt: isoAt(1, 12), notes: "Finished calmly after burping" },
      { id: "feed-2", babyId, type: "bottle", amountMl: 90, startedAt: isoAt(4, 20), notes: "Breastmilk bottle" },
      { id: "feed-3", babyId, type: "breast", durationMinutes: 18, startedAt: isoAt(7, 40), notes: "Left side longer" }
    ];
    const sleepLogs = [
      { id: "sleep-1", babyId, status: "nap", startedAt: isoAt(3, 30), endedAt: isoAt(2, 15), notes: "Settled with white noise" },
      { id: "sleep-2", babyId, status: "night", startedAt: atTime(21, 10, -1), endedAt: atTime(5, 45), notes: "One wake-up" }
    ];
    const diaperLogs = [
      { id: "diaper-1", babyId, type: "pee", peeAmount: "Medium", peeColor: "Pale yellow", changedAt: isoAt(0, 38), notes: "" },
      { id: "diaper-2", babyId, type: "mixed", peeAmount: "Light", poopConsistency: "Soft", poopColor: "Mustard", changedAt: isoAt(5, 5), notes: "" }
    ];
    const calendarEvents = [
      { id: "event-1", babyId, type: "vaccine", title: "Klinik Kesihatan checkup", startsAt: atTime(9, 30, 1), notes: "Bring vaccine book" },
      { id: "event-2", babyId, type: "daycare", title: "Daycare prep", startsAt: atTime(16, 30, 2), notes: "Pack extra bottle" }
    ];
    const growthRecords = [
      { id: "growth-1", babyId, recordedAt: localDate(-21), weightKg: 5.8, heightCm: 60.2 },
      { id: "growth-2", babyId, recordedAt: localDate(-3), weightKg: 6.2, heightCm: 62.1 }
    ];
    const milestones = [
      { id: "mile-1", babyId, category: "smile", title: "First laugh", achievedAt: localDate(-4), notes: "Laughed when Papa made a funny voice.", photoUrl: babyPhoto, createdAt: isoAt(80, 0) },
      { id: "mile-2", babyId, category: "movement", title: "Rolled over", achievedAt: localDate(-12), notes: "Rolled from tummy to back after playtime.", photoUrl: babyPhoto, createdAt: isoAt(120, 0) }
    ];
    const reminders = [
      { id: "reminder-1", babyId, type: "health", title: "Vitamin D", startsAt: atTime(20, 0), status: "pending" }
    ];
    const mamaCheckins = [
      { id: "checkin-1", babyId, checkinDate: localDate(), mood: "Calm", painLevel: 2, waterCups: 6, mealsCount: 2, sleepHours: 5.5, notes: "Short walk helped today." }
    ];
    const mamaSupport = [
      { id: "support-1", babyId, taskDate: localDate(), title: "Refill Mama's water bottle", notes: "Keep beside nursing chair.", status: "done" },
      { id: "support-2", babyId, taskDate: localDate(), title: "Prepare an easy meal", notes: "One-handed lunch.", status: "pending" }
    ];
    const mamaMeds = [
      { id: "med-1", babyId, name: "Postnatal vitamin", medicationTime: atTime(9, 0), status: "taken" },
      { id: "med-2", babyId, name: "Iron tablet", medicationTime: atTime(20, 30), status: "pending" }
    ];
    const mamaAppointments = [
      { id: "mama-appt-1", babyId, title: "Postnatal follow-up", appointmentTime: atTime(10, 30, 3), location: "Clinic" }
    ];
    const pumpSessions = [
      { id: "pump-1", babyId, startedAt: isoAt(2, 10), endedAt: isoAt(1, 50), durationMinutes: 20, leftMl: 55, rightMl: 70, totalMl: 125, pumpUsed: "Momcozy V1 Pro", notes: "Morning output strong" },
      { id: "pump-2", babyId, startedAt: isoAt(6, 0), endedAt: isoAt(5, 42), durationMinutes: 18, leftMl: 50, rightMl: 62, totalMl: 112, pumpUsed: "Momcozy V1 Pro", notes: "" },
      { id: "pump-3", babyId, startedAt: isoAt(10, 0), endedAt: isoAt(9, 40), durationMinutes: 20, leftMl: 48, rightMl: 60, totalMl: 108, pumpUsed: "Momcozy V1 Pro", notes: "" }
    ];
    const pumpSchedules = ["06:00", "09:00", "12:00", "15:00", "18:00", "21:00"].map((pumpTime, index) => ({
      id: `schedule-${index + 1}`,
      babyId,
      pumpTime,
      label: index < 3 ? "Completed" : "Scheduled",
      active: true,
      skippedDates: []
    }));
    const milkStorage = [
      { id: "milk-1", babyId, quantityMl: 120, remainingMl: 120, storageType: "refrigerator", containerType: "Storage Bag", pumpDate: localDate(-3), expirationDate: localDate(1), label: "Storage Bag #17", notes: "Use first" },
      { id: "milk-2", babyId, quantityMl: 150, remainingMl: 150, storageType: "freezer", containerType: "Storage Bag", pumpDate: localDate(-9), expirationDate: localDate(170), label: "Storage Bag #18", notes: "" },
      { id: "milk-3", babyId, quantityMl: 100, remainingMl: 80, storageType: "freezer", containerType: "Bottle", pumpDate: localDate(-7), expirationDate: localDate(172), label: "Bottle #4", notes: "" }
    ];
    const pumpParts = [
      { id: "part-1", babyId, partType: "Valve Replacement", lastChangedDate: localDate(-32), intervalDays: 30, notes: "" },
      { id: "part-2", babyId, partType: "Tubing Inspection", lastChangedDate: localDate(-10), intervalDays: 30, notes: "" }
    ];

    const write = (key, value) => localStorage.setItem(key, JSON.stringify(value));
    localStorage.clear();
    localStorage.setItem("littlenest:isGuest", "true");
    write("littlenest:parentProfile", parent);
    write("littlenest:babyProfiles", [baby]);
    write("littlenest:selectedBabyId", babyId);
    write("littlenest:feedingLogs", feedingLogs);
    write("littlenest:sleepLogs", sleepLogs);
    write("littlenest:diaperLogs", diaperLogs);
    write("littlenest:calendarEvents", calendarEvents);
    write("littlenest:growthRecords", growthRecords);
    write("littlenest:milestones", milestones);
    write("littlenest:reminders", reminders);
    write("littlenest:mamaCheckins", mamaCheckins);
    write("littlenest:mamaSupportTasks", mamaSupport);
    write("littlenest:mamaMedications", mamaMeds);
    write("littlenest:mamaAppointments", mamaAppointments);
    write("littlenest:pumpSessions", pumpSessions);
    write("littlenest:pumpSchedules", pumpSchedules);
    write("littlenest:milkStorage", milkStorage);
    write("littlenest:pumpParts", pumpParts);
    write("littlenest:customPumpBrands", ["Momcozy V1 Pro"]);
  });
}

function renderPosterHtml(spec, captures) {
  const shotMarkup = spec.shots.map((id, index) => {
    const cls = index === 0 ? "phone main" : `phone small small-${index}`;
    return `<figure class="${cls}"><img src="${captures[id]}" alt="${id} screen capture" /></figure>`;
  }).join("");

  return `<!doctype html>
<html>
<head>
<meta charset="utf-8" />
<style>
  ${baseCss()}
  body { width:${spec.width}px; height:${spec.height}px; }
  .poster { width:${spec.width}px; height:${spec.height}px; }
  .headline { font-size:${spec.height > 1900 ? 122 : 82}px; max-width:${spec.height > 1900 ? 980 : 900}px; }
  .subhead { font-size:${spec.height > 1900 ? 35 : 27}px; max-width:${spec.height > 1900 ? 820 : 760}px; }
  .stage { height:${Math.round(spec.height * (spec.height > 1900 ? 0.66 : 0.56))}px; bottom:${spec.height > 1900 ? 132 : 92}px; }
  .phone.main { width:${mainPhoneWidth(spec)}px; }
  .phone.small { width:${smallPhoneWidth(spec)}px; }
  .poster.${spec.theme} { ${themeBackground(spec.theme)} }
</style>
</head>
<body>
  <main class="poster ${spec.theme}">
    <div class="brand"><span class="mark">LN</span><span>LittleNest MY</span><span class="channel">${spec.label}</span></div>
    <section class="copy">
      <h1 class="headline">${escapeHtml(spec.headline)}</h1>
      <p class="subhead">${escapeHtml(spec.subhead)}</p>
    </section>
    <section class="stage">${shotMarkup}</section>
    <footer><span>Real app UI</span><span>Fictional preview data</span><span>Made for tired parents</span></footer>
  </main>
</body>
</html>`;
}

function renderSheetHtml(captures) {
  return `<!doctype html><html><head><meta charset="utf-8" /><style>${baseCss()}
    body{width:1440px;background:#f8efe8;padding:42px;font-family:"Plus Jakarta Sans",sans-serif}
    h1{margin:0 0 26px;font-size:44px;color:#241915}
    .grid{display:grid;grid-template-columns:repeat(5,1fr);gap:22px}
    .proof{background:white;border-radius:34px;padding:12px;box-shadow:0 24px 70px rgba(92,58,44,.14)}
    .proof img{width:100%;border-radius:25px;display:block}
    .proof p{margin:12px 4px 4px;font-weight:900;color:#83533c}
  </style></head><body><h1>LittleNest MY real app UI captures</h1><div class="grid">
    ${Object.entries(captures).map(([id, src]) => `<div class="proof"><img src="${src}" /><p>${id}</p></div>`).join("")}
  </div></body></html>`;
}

function baseCss() {
  return `
    @import url("https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@600;700;800&family=Nunito+Sans:wght@700;800;900&display=swap");
    * { box-sizing: border-box; }
    body { margin:0; overflow:hidden; font-family:"Nunito Sans", system-ui, sans-serif; color:#241915; }
    .poster { position:relative; overflow:hidden; isolation:isolate; padding:64px 72px; }
    .poster::before { content:""; position:absolute; inset:0; z-index:-1; opacity:.16; background-image:linear-gradient(rgba(46,31,24,.08) 1px, transparent 1px), linear-gradient(90deg, rgba(46,31,24,.05) 1px, transparent 1px); background-size:54px 54px; mask-image:linear-gradient(to bottom, rgba(0,0,0,.75), transparent 78%); }
    .poster::after { content:""; position:absolute; inset:0; z-index:-1; opacity:.16; mix-blend-mode:soft-light; background-image:repeating-linear-gradient(0deg, rgba(255,255,255,.5) 0 1px, transparent 1px 5px), repeating-linear-gradient(90deg, rgba(52,32,24,.08) 0 1px, transparent 1px 7px); }
    .brand { display:inline-flex; align-items:center; gap:16px; height:64px; padding:8px 22px 8px 10px; border-radius:999px; background:rgba(255,255,255,.68); border:1px solid rgba(255,255,255,.84); box-shadow:inset 0 1px 0 rgba(255,255,255,.9), 0 18px 54px rgba(92,58,44,.12); color:#83533c; font-weight:900; font-size:22px; }
    .mark { width:48px; height:48px; border-radius:999px; display:grid; place-items:center; background:linear-gradient(145deg,#ffe0d2,#fff7ef); color:#83533c; font-size:16px; }
    .channel { height:34px; display:inline-flex; align-items:center; padding:0 14px; border-radius:999px; background:rgba(131,83,60,.1); font-size:15px; text-transform:uppercase; letter-spacing:.14em; }
    .copy { margin-top:46px; position:relative; z-index:4; }
    .headline { margin:0; font-family:"Plus Jakarta Sans", "Nunito Sans", sans-serif; line-height:.94; letter-spacing:-.06em; font-weight:800; text-wrap:balance; }
    .subhead { margin:28px 0 0; line-height:1.25; color:#6b5a52; font-weight:800; }
    .stage { position:absolute; left:0; right:0; bottom:92px; }
    .phone { position:absolute; margin:0; border-radius:64px; padding:12px; background:linear-gradient(145deg, rgba(255,255,255,.78), rgba(255,242,235,.44)); border:1px solid rgba(255,255,255,.86); box-shadow:0 52px 126px rgba(76,50,39,.22), inset 0 1px 0 rgba(255,255,255,.95); }
    .phone::before { content:""; position:absolute; z-index:3; top:24px; left:50%; width:92px; height:18px; transform:translateX(-50%); border-radius:999px; background:rgba(48,35,30,.16); }
    .phone img { display:block; width:100%; border-radius:52px; border:1px solid rgba(255,255,255,.74); }
    .phone.main { left:50%; bottom:0; transform:translateX(-50%); z-index:3; }
    .phone.small-1 { left:54px; bottom:80px; transform:rotate(-7deg); z-index:2; }
    .phone.small-2 { right:54px; bottom:70px; transform:rotate(7deg); z-index:2; }
    footer { position:absolute; left:72px; right:72px; bottom:40px; display:flex; justify-content:space-between; gap:20px; color:#83533c; font-size:18px; font-weight:900; }
    footer span { padding:10px 18px; border-radius:999px; background:rgba(255,255,255,.55); border:1px solid rgba(255,255,255,.72); }
  `;
}

function themeBackground(theme) {
  const themes = {
    warm: "background:radial-gradient(880px 680px at 14% 8%, rgba(255,191,163,.44), transparent 64%),radial-gradient(900px 720px at 92% 18%, rgba(207,230,201,.40), transparent 64%),linear-gradient(180deg,#fffbf7 0%,#f8efe8 52%,#ece2d9 100%);",
    sage: "background:radial-gradient(860px 700px at 16% 8%, rgba(207,230,201,.62), transparent 64%),radial-gradient(900px 740px at 94% 22%, rgba(255,219,204,.52), transparent 66%),linear-gradient(180deg,#fffdf8 0%,#f2f8ed 54%,#e6ede0 100%);",
    blue: "background:radial-gradient(880px 700px at 18% 8%, rgba(234,244,255,.82), transparent 64%),radial-gradient(860px 740px at 92% 18%, rgba(238,232,255,.78), transparent 66%),linear-gradient(180deg,#fbfbff 0%,#eef4ff 54%,#e4e8f6 100%);",
    pink: "background:radial-gradient(900px 700px at 14% 10%, rgba(255,218,229,.66), transparent 64%),radial-gradient(840px 720px at 92% 18%, rgba(238,232,255,.70), transparent 66%),linear-gradient(180deg,#fffafd 0%,#f8edf4 54%,#ebe1e9 100%);"
  };
  return themes[theme] || themes.warm;
}

function mainPhoneWidth(spec) {
  if (spec.id === "app-store") return 660;
  if (spec.height > 1900) return 560;
  return 430;
}

function smallPhoneWidth(spec) {
  if (spec.id === "app-store") return 490;
  if (spec.height > 1900) return 405;
  return 330;
}

function escapeHtml(value) {
  return String(value || "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}
