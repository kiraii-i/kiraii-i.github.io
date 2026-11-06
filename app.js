/* Lunar Landing Site Navigator — standalone static build.
 * No server, no build step. Data lives in this browser (localStorage + IndexedDB).
 * Scientific rule: unknown values are null / "Unavailable", never 0. UTC everywhere. */
(() => {
"use strict";

/* ───────── helpers ───────── */
const $ = (s, r = document) => r.querySelector(s);
const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const uid = () => (crypto.randomUUID ? crypto.randomUUID() : String(Date.now()) + Math.random().toString(16).slice(2));
const store = {
  get(k, d) { try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : d; } catch { return d; } },
  set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* storage blocked: stay in-memory */ } },
};
function toast(msg, bad) {
  const el = document.createElement("div");
  el.className = "toast" + (bad ? " bad" : ""); el.textContent = msg;
  $("#toasts").appendChild(el); setTimeout(() => el.remove(), 3200);
}
const sourceLabel = (u) => { try { return new URL(u).hostname.replace(/^www\./, ""); } catch { return u; } };

/* ───────── icons (inline, lucide-style) ───────── */
const P = {
  moon: '<path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z"/>',
  dash: '<rect x="3" y="3" width="7" height="9" rx="1"/><rect x="14" y="3" width="7" height="5" rx="1"/><rect x="14" y="12" width="7" height="9" rx="1"/><rect x="3" y="16" width="7" height="5" rx="1"/>',
  kanban: '<path d="M6 5v11M12 5v6M18 5v14"/>',
  map: '<path d="M14.1 3.2 9 5 4 3v15l5 2 5.1-1.8L20 21V6z"/><path d="M9 5v15M14 3.5v15.5"/>',
  tele: '<path d="m10.065 12.493-6.18 1.318a.934.934 0 0 1-1.108-.702l-.537-2.15a1.07 1.07 0 0 1 .691-1.265l13.504-4.44"/><path d="m13.56 11.747 4.332-.924"/><path d="m16 21-3.105-6.21"/><path d="M16.485 5.94a2 2 0 0 1 1.455-2.425l1.09-.272a1 1 0 0 1 1.212.727l1.515 6.06a1 1 0 0 1-.727 1.213l-1.09.272a2 2 0 0 1-2.425-1.455z"/><path d="m6.158 8.633 1.114 4.456"/><path d="m8 21 3.105-6.21"/><circle cx="12" cy="13" r="2"/>',
  cal: '<rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/><circle cx="12" cy="16" r="1.5"/>',
  scale: '<path d="M12 3v18M5 7h14M5 7l-3 7a4 4 0 0 0 6 0zM19 7l-3 7a4 4 0 0 0 6 0z"/>',
  flag: '<path d="M4 22V4a1 1 0 0 1 .4-.8A6 6 0 0 1 8 2c3 0 5 2 8 2a6 6 0 0 0 4-1.5.5.5 0 0 1 .8.4v10a1 1 0 0 1-.4.8A6 6 0 0 1 16 14c-3 0-5-2-8-2a6 6 0 0 0-4 1.5"/>',
  book: '<path d="M4 19.5v-15A2.5 2.5 0 0 1 6.5 2H19a1 1 0 0 1 1 1v18a1 1 0 0 1-1 1H6.5a1 1 0 0 1 0-5H20"/>',
  spark: '<path d="M9.94 14.06 8 20l-1.94-5.94L0 12l6.06-2.06L8 4l1.94 5.94L16 12zM19 3v4M21 5h-4M19 17v4M21 19h-4"/>',
  users: '<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75"/>',
  menu: '<path d="M4 6h16M4 12h16M4 18h16"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  pen: '<path d="M17 3a2.85 2.85 0 0 1 4 4L7.5 20.5 2 22l1.5-5.5z"/>',
  trash: '<path d="M3 6h18M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>',
  upload: '<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M17 8l-5-5-5 5M12 3v12"/>',
  copy: '<rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>',
  ext: '<path d="M15 3h6v6M10 14 21 3M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/>',
  sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.41"/>',
  earth: '<circle cx="12" cy="12" r="10"/><path d="M21.54 15H17a2 2 0 0 0-2 2v4.54M7 3.34V5a3 3 0 0 0 3 3 2 2 0 0 1 2 2c0 1.1.9 2 2 2a2 2 0 0 0 2-2c0-1.1.9-2 2-2h3.17M11 21.95V18a2 2 0 0 0-2-2 2 2 0 0 1-2-2v-1a2 2 0 0 0-2-2H2.05"/>',
  shield: '<path d="M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z"/><path d="m9 12 2 2 4-4"/>',
  check: '<path d="M20 6 9 17l-5-5"/>',
  flow: '<rect x="3" y="3" width="8" height="8" rx="2"/><path d="M7 11v4a2 2 0 0 0 2 2h4"/><rect x="13" y="13" width="8" height="8" rx="2"/>',
  folder: '<path d="M20 20a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-7.9a2 2 0 0 1-1.69-.9L9.6 3.9A2 2 0 0 0 7.93 3H4a2 2 0 0 0-2 2v13a2 2 0 0 0 2 2z"/>',
  dl: '<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3"/>',
};
const ic = (n, cls = "") => `<svg class="${cls}" viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${P[n]}</svg>`;

/* ───────── domain data (from the original app) ───────── */
const ROLES = {
  GIS: { member: "Member 1", title: "GIS & Remote Sensing Lead" },
  PY: { member: "Member 2", title: "Python & Scientific Computing Lead" },
  AI: { member: "Member 4", title: "AI Workflow & Data Management Lead" },
  WEB: { member: "Member 3", title: "Web/UI/UX & Integration Lead" },
};
const STATUSES = [["todo", "To Do"], ["in_progress", "In Progress"], ["review", "Review"], ["done", "Done"]];
const PRIORITIES = ["high", "medium", "low"];
const TRACKS = { core: "Core work", learning: "Lunar Science & Site Familiarization" };
const HACKATHON_START_UTC = Date.UTC(2026, 10, 13, 0, 0, 0);
const SITES = [
  { id: "shackleton", name: "Shackleton Crater", lat: null },
  { id: "malapert", name: "Malapert Massif", lat: null },
];
const AZ = "Degrees clockwise from local North (0° = N, 90° = E), measured in the local topocentric horizon plane — to be confirmed against the SPICE pipeline.";
const EL = "Degrees above the ideal (geometric) horizon plane; terrain not included.";
const REQUIRED = ["source", "coordinate_frame", "projection", "units", "resolution_m", "timestamp_utc", "verification_status"];

const T = (code, title, role, prio, due, deliv, desc = "", status = "todo") => ({ id: uid(), code, title, description: desc, deliverables: deliv, owner_role: role, priority: prio, status, due_date: due, track: "core", source_links: [], updated_at: new Date().toISOString() });
const SEED = () => [
  T("GIS-01", "Collect LOLA DEM and metadata for both study areas", "GIS", "high", "2026-11-06", "DEM files + metadata sheet (source, frame, resolution)"),
  T("GIS-02", "Generate hillshade, slope, and aspect products", "GIS", "high", "2026-11-07", "Hillshade/slope/aspect rasters"),
  T("GIS-03", "Build local horizon profile (360 directions, 1° increments) for verified reference point(s), if feasible", "GIS", "high", "2026-11-09", "horizon_profile.csv (azimuth_deg, horizon_elev_deg)"),
  T("GIS-04", "Compare Python Sun/Earth azimuth/elevation against matching local horizon for terrain occlusion", "GIS", "medium", "2026-11-10", "Occlusion comparison notes"),
  T("GIS-05", "Prepare map-ready layers and metadata package", "GIS", "medium", "2026-11-11", "Tiles/GeoTIFFs + metadata JSON"),
  T("GIS-06", "Document candidate-area screening criteria and limitations", "GIS", "medium", "2026-11-12", "Criteria + limitations doc"),
  T("PY-01", "Set up Python environment and dependencies", "PY", "high", "2026-11-06", "requirements.txt, env instructions"),
  T("PY-02", "Acquire/document SPICE kernels and reference frames", "PY", "high", "2026-11-07", "Kernel list with provenance"),
  T("PY-03", "Compute Sun position at selected site/time", "PY", "high", "2026-11-08", "Function + test output"),
  T("PY-04", "Compute Earth position at selected site/time", "PY", "high", "2026-11-08", "Function + test output"),
  T("PY-05", "Compute elevation, azimuth, and geometric visibility", "PY", "high", "2026-11-09", "elev/az module"),
  T("PY-06", "Generate UTC time-series/timeline", "PY", "medium", "2026-11-10", "Timeline JSON"),
  T("PY-07", "Integrate verified GIS horizon profile", "PY", "medium", "2026-11-11", "terrain_visible flags"),
  T("PY-08", "Expose documented JSON/API output", "PY", "medium", "2026-11-12", "FastAPI endpoints + schema doc"),
  T("WEB-01", "Build dashboard and navigation", "WEB", "high", "2026-11-06", "Dashboard + nav", "", "in_progress"),
  T("WEB-02", "Build task board and shared persistence", "WEB", "high", "2026-11-07", "Shared task board", "", "in_progress"),
  T("WEB-03", "Build GIS Explorer and layer controls", "WEB", "high", "2026-11-08", "GIS Explorer page"),
  T("WEB-04", "Build scientific analysis and timeline views", "WEB", "medium", "2026-11-09", "Analysis + timeline pages"),
  T("WEB-05", "Build site comparison and sources pages", "WEB", "medium", "2026-11-10", "Comparison + resources pages"),
  T("WEB-06", "Integrate Python API and GIS outputs", "WEB", "medium", "2026-11-11", "Live data wiring"),
  T("WEB-07", "Responsive QA, presentation, screenshots, demo video backup", "WEB", "medium", "2026-11-12", "Slides, screenshots, demo video"),
  T("AI-01", "AI-Assisted Development Workflow & Code Literacy", "AI", "high", "2026-11-08", "Documented repeatable development workflow", "Learn to use an AI provider to understand, plan, implement and review changes across the entire website."),
  T("AI-02", "AI Provider Evaluation & Prompt Library", "AI", "high", "2026-11-08", "Provider comparison and reusable prompt library", "Evaluate Claude and Manus using the same project tasks; compare quality, context, file handling, coding workflow and practical limits."),
  T("AI-03", "AI Builder Workflow & Project Handoff", "AI", "high", "2026-11-09", "Handoff checklist and project context brief", "Create a safe workflow for handing project context and selected files between the team and the chosen AI tool."),
  T("AI-04", "Website Data Manager & Validation", "AI", "high", "2026-11-10", "Data validation checklist and reviewed records", "Organize project records and check metadata, units, provenance, verification status and missing values."),
  T("AI-05", "Project File Library & Linking", "AI", "medium", "2026-11-10", "Organized, tagged and linked project files", "Maintain the shared file library and link files to tasks, sites and project records where applicable."),
  T("AI-06", "Provider-Agnostic AI Assistant Integration Plan", "AI", "medium", "2026-11-11", "Provider-neutral architecture note", "Document a future server-side provider adapter, context retrieval, security and rate-limit design without enabling a live provider."),
  T("AI-07", "AI Quality, Safety & Team Training", "AI", "medium", "2026-11-12", "Team checklist and short training guide", "Train teammates on prompt hygiene, source checking, code review, secrets handling and human approval."),
];

const PROMPTS = [
  ["Build a website feature", "You are helping develop Lunar Landing Site Navigator. First inspect the existing project structure and conventions. Implement this feature without rebuilding unrelated parts: [FEATURE]. Preserve existing routes, task IDs, database data and responsive styling. Explain files changed, migrations needed, tests run, and anything still incomplete. Never invent lunar science values."],
  ["Debug an issue", "Debug this issue in Lunar Landing Site Navigator: [ERROR / EXPECTED / ACTUAL]. Inspect the relevant code and trace the root cause before editing. Make the smallest safe fix, preserve existing behavior, add or update a test, and report the exact files changed and verification performed. Do not expose secrets."],
  ["Review code and data", "Review this change as a senior engineer and scientific-data reviewer. Check TypeScript correctness, security/RLS, mobile responsiveness, accessibility, error/loading states, data provenance, units, coordinate reference systems and whether unknown values are incorrectly represented as zero. Do not assume unverified lunar values are true. Return findings by severity with file references."],
  ["Prepare a safe handoff", "Prepare a concise handoff for another AI provider. Summarize the project goal, current architecture, relevant files, task IDs, decisions, constraints, exact requested change, tests and known limitations. Do not include .env files, API keys, passwords, tokens or private user data."],
];

const LINKS = [
  ["Data", "NASA PGDA — LOLA South Pole data", "https://pgda.gsfc.nasa.gov/products/78"],
  ["Data", "LOLA PDS archive", "https://pds-geosciences.wustl.edu/missions/lro/lola.htm"],
  ["Data", "LROC archive", "https://pds.lroc.im-ldi.com/data/"],
  ["Data", "LRO data products", "https://science.nasa.gov/mission/lro/data-products/"],
  ["Data", "NASA Moon Trek", "https://trek.nasa.gov/moon/"],
  ["GIS", "QGIS", "https://qgis.org/"],
  ["GIS", "QGIS documentation", "https://docs.qgis.org/latest/en/docs/user_manual/"],
  ["Geometry", "NAIF SPICE", "https://naif.jpl.nasa.gov/naif/"],
  ["Geometry", "NAIF tutorials", "https://naif.jpl.nasa.gov/naif/tutorials.html"],
  ["Geometry", "SpiceyPy", "https://spiceypy.readthedocs.io/"],
  ["Web", "FastAPI tutorial", "https://fastapi.tiangolo.com/tutorial/"],
  ["Web", "React", "https://react.dev/learn"],
];
const LUNAR_SCIENCE = [
  ["NASA", "Lunar South Pole Region (Moonbase environment)", "https://www.nasa.gov/reference/moonbase-environment/"],
  ["NASA", "Shackleton Crater: illuminated rim, shadowed interior", "https://science.nasa.gov/resource/shackleton-craters-illuminated-rim-shadowed-interior/"],
  ["NASA", "Illumination map of the Moon's south pole", "https://science.nasa.gov/resource/illumination-map-of-the-moons-south-pole/"],
  ["LPI", "Lunar South Pole Atlas", "https://www.lpi.usra.edu/lunar/lunar-south-pole-atlas/"],
  ["NASA PGDA", "South Pole LOLA DEMs", "https://pgda.gsfc.nasa.gov/products/78"],
  ["NASA", "Malapert region image", "https://science.nasa.gov/image-detail/20100618/"],
  ["NASA", "Moon Trek", "https://trek.nasa.gov/moon/"],
  ["QGIS", "QGIS user manual", "https://docs.qgis.org/latest/en/docs/user_manual/"],
];
const EXAMPLE_SITE = { site_id: "shackleton", name: "Shackleton Crater", kind: "study_area", description: "Named study area near the lunar south pole. No reference point selected yet.", latitude_deg: null, longitude_deg: null, elevation_m: null, coordinate_frame: null, coordinate_source: null, verification_status: "pending_verification" };
const NULLBODY = { elevation_deg: null, azimuth_deg: null, geometric_visible: null, terrain_visible: null };
const EXAMPLE_ANALYSIS = { site_id: "shackleton", timestamp_utc: "2026-11-13T12:00:00Z", reference_frame: null, kernel_provenance: null, units: { angles: "deg" }, azimuth_convention: AZ, sun: NULLBODY, earth: NULLBODY, data_status: "uncomputed" };
const CRITERIA = [
  ["Terrain slope", "Slope from LOLA DEM (GIS-02); report units, resolution, and DEM source.", "GIS"],
  ["Illumination", "Sun geometric windows (PY-06) + terrain occlusion via horizon profile (GIS-04).", "PY + GIS"],
  ["Earth visibility", "Earth elevation over time (PY-05) + terrain occlusion.", "PY + GIS"],
  ["Communications geometry", "Earth line-of-sight geometry only; actual link availability is out of scope.", "PY"],
  ["Data coverage", "DEM/imagery coverage and resolution over the study area, from product metadata.", "GIS"],
  ["Operational constraints", "Documented qualitative constraints with citations.", "Team"],
];
const MILESTONES = [
  ["Nov 6–11, 2026", "Preparation sprint", "Data, SPICE pipeline, app scaffolding"],
  ["Nov 12, 2026", "Feature freeze", "Only fixes, docs, presentation after this"],
  ["Nov 13–14, 2026", "NASA Space Apps hackathon", "Demo, submission, backup video"],
];
const NAV = [
  ["dashboard", "Overview", "dash"], ["tasks", "Team Tasks", "kanban"], ["gis", "GIS Explorer", "map"],
  ["analysis", "Scientific Analysis", "tele"], ["timeline", "Mission Timeline", "cal"], ["compare", "Site Comparison", "scale"],
  ["deliverables", "Deliverables", "flag"], ["resources", "Resources & Method", "book"], ["ai-workspace", "AI Workspace", "spark"], ["team", "Team & Access", "users"],
];

/* ───────── state ───────── */
/* Shared mode: tasks, activity, files and members live in the artifact's db and sync live to
 * everyone with the link. If the db is unavailable (opened outside a viewer), falls back to this browser. */
const cloud = { db: null, assets: null, user: null, uid: null, mode: "loading", canWrite: true, canAdmin: false };
let tasks = [], activity = [], members = [];
let profile = store.get("lsn.profile", { name: "", role: "" });
const ui = { member: "all", prio: "all", track: "all", site: "shackleton", layers: { "Landing Sites": true, "Candidate Areas": true }, report: null, provider: "undecided", utc: new Date().toISOString().slice(0, 16), api: null, apiBusy: false, tl: null, files: [], filesErr: "" };
const saveTasks = () => { if (cloud.mode === "local") store.set("lsn.tasks", tasks); };
const clean = (t) => { const { id, ...rest } = t; return rest; };
const sortTasks = () => tasks.sort((a, b) => String(a.due_date || "9").localeCompare(String(b.due_date || "9")) || String(a.code).localeCompare(String(b.code)));
async function persist(t) {
  if (cloud.mode !== "shared") { saveTasks(); return; }
  try { await cloud.db.collection("tasks").doc(t.id).set(clean(t)); } catch (e) { writeFail(e); }
}
async function removeTask(t) {
  if (cloud.mode !== "shared") { saveTasks(); return; }
  try { await cloud.db.collection("tasks").doc(t.id).delete(); } catch (e) { writeFail(e); }
}
function writeFail(e) {
  toast(e && e.code === "invalid_argument" ? "You need Contributor access to change shared data. Ask the owner to share the link with edit access." : "Could not save: " + ((e && e.message) || "unknown error"), true);
}
function log(message) {
  const a = { actor_name: profile.name || "A teammate", message, created_at: new Date().toISOString() };
  if (cloud.mode === "shared") { cloud.db.collection("activity").add(a).catch(() => {}); return; }
  activity.unshift({ id: uid(), ...a }); activity = activity.slice(0, 50); store.set("lsn.activity", activity);
}
const progress = (xs) => xs.length ? Math.round((xs.filter((t) => t.status === "done").length / xs.length) * 100) : 0;
const statusLabel = (s) => (STATUSES.find((x) => x[0] === s) || [])[1];
const apiBase = () => (window.SCIENCE_API_URL || "").replace(/\/$/, "") || null;

/* ───────── IndexedDB file library ───────── */
const idb = {
  db: null,
  open() {
    return new Promise((res, rej) => {
      if (this.db) return res(this.db);
      if (!window.indexedDB) return rej(new Error("IndexedDB unavailable in this browser."));
      const r = indexedDB.open("lsn-files", 1);
      r.onupgradeneeded = () => r.result.createObjectStore("files", { keyPath: "id" });
      r.onsuccess = () => { this.db = r.result; res(this.db); };
      r.onerror = () => rej(r.error);
    });
  },
  async tx(mode, fn) {
    const db = await this.open();
    return new Promise((res, rej) => { const t = db.transaction("files", mode); const out = fn(t.objectStore("files")); t.oncomplete = () => res(out.result); t.onerror = () => rej(t.error); });
  },
  all() { return this.tx("readonly", (s) => s.getAll()); },
  put(f) { return this.tx("readwrite", (s) => s.put(f)); },
  del(id) { return this.tx("readwrite", (s) => s.delete(id)); },
};
async function loadFiles() {
  if (cloud.mode === "shared") return;
  try { ui.files = (await idb.all()).sort((a, b) => b.created_at.localeCompare(a.created_at)); ui.filesErr = ""; }
  catch (e) { ui.files = []; ui.filesErr = e.message; }
  if (route() === "ai-workspace") render();
}

/* ───────── layout pieces ───────── */
const header = (eyebrow, title, acts = "") => `<div class="header"><div><div class="eyebrow">${esc(eyebrow)}</div><h1>${esc(title)}</h1></div>${acts ? `<div class="acts">${acts}</div>` : ""}</div>`;
const panel = (title, body, { cls = "", action = "" } = {}) => `<section class="panel ${cls}">${title || action ? `<div class="ph">${title ? `<h2 class="eyebrow strong">${title}</h2>` : "<span></span>"}${action}</div>` : ""}${body}</section>`;
const empty = (title, body = "") => `<div class="empty"><b>${title}</b>${body ? `<div>${body}</div>` : ""}</div>`;
const badge = (txt, v = "") => `<span class="badge ${v}">${txt}</span>`;
const siteSelect = () => `<select class="w52" data-change="site" aria-label="Study area">${SITES.map((s) => `<option value="${s.id}" ${ui.site === s.id ? "selected" : ""}>${s.name}</option>`).join("")}</select>`;
const brand = () => `<div class="brand"><div class="logo">${ic("moon")}</div><div><b>Lunar Landing</b><span class="eyebrow">Site Navigator</span></div></div>`;
const navList = (cur) => `<nav aria-label="Main">${NAV.map(([k, l, i]) => `<a href="#${k}" data-nav class="${cur === k ? "active" : ""}">${ic(i)}${l}</a>`).join("")}</nav>`;
function shell(cur, body) {
  const foot = `<div class="foot"><div class="mono muted trunc" style="padding:0 .25rem .5rem">${esc(profile.name || "Local workspace")}</div><a class="btn ghost sm" style="width:100%;justify-content:flex-start" href="#home">${ic("moon")} Home</a></div>`;
  return `<div class="shell stars">
    <aside><div class="brand-wrap">${brand()}</div>${navList(cur)}${foot}</aside>
    <header class="mobbar">${brand()}<button class="btn ghost icon big" data-act="drawer" aria-label="Open navigation">${ic("menu")}</button></header>
    <div class="drawer" id="drawer"><div class="scrim" data-act="drawer"></div><div class="panel"><div class="brand-wrap" style="padding:1.25rem 0">${brand()}</div>${navList(cur)}${foot}</div></div>
    <main><div class="wrap">${body}</div></main></div>`;
}

/* ───────── pages ───────── */
function landing() {
  return `<div class="hero stars"><div class="grid-bg" style="position:absolute;inset:0;opacity:.6" aria-hidden="true"></div>
  <div class="inner"><div class="logo">${ic("moon")}</div>
  <div class="eyebrow">NASA Space Apps Challenge · Nov 13–14, 2026</div>
  <h1>Lunar Landing Site Navigator</h1>
  <p class="lead">Team mission control for the Shackleton Crater and Malapert Massif study areas — shared tasks, GIS layers, Sun/Earth geometry and a transparent, evidence-first site comparison.</p>
  <div class="cta"><a class="btn lg" href="#dashboard">Enter mission control</a><a class="btn lg outline" href="#team">Team &amp; Access</a></div>
  <p class="mono xs muted" style="margin-top:2rem">No NASA measurements are shown until sourced and verified.</p></div></div>`;
}

function countdownHTML() {
  const diff = Math.max(0, HACKATHON_START_UTC - Date.now());
  if (diff === 0) return `<div class="primary" style="font-size:1.5rem;font-weight:600">Hackathon is live</div>`;
  const d = Math.floor(diff / 864e5), h = Math.floor((diff % 864e5) / 36e5), m = Math.floor((diff % 36e5) / 6e4);
  return `<div class="cd">${[["days", d], ["hrs", h], ["min", m]].map(([l, v]) => `<div><div class="n">${String(v).padStart(2, "0")}</div><div class="eyebrow">${l}</div></div>`).join("")}</div>`;
}

function dashboard() {
  const pct = progress(tasks), open = tasks.filter((t) => t.status !== "done");
  const road = open.filter((t) => t.priority === "high").slice(0, 6);
  return header("Mission overview", "Team Dashboard", badge("UTC", "info")) + `
  <div class="g g4">
    ${panel("Countdown to Nov 13, 2026 00:00 UTC", `<div id="cd">${countdownHTML()}</div><p class="xs muted" style="margin-top:.75rem">Feature freeze Nov 12 · Hackathon Nov 13–14, 2026</p>`, { cls: "span2x" })}
    ${panel("Task progress", `<div class="big">${pct}%</div><div class="progress mt"><i style="width:${pct}%"></i></div><p class="xs muted" style="margin-top:.5rem">${tasks.filter((t) => t.status === "done").length} of ${tasks.length} tasks done</p>`)}
    ${panel("Integration status", `<ul class="sm" style="display:grid;gap:.5rem">
      <li class="row between">Task storage ${cloud.mode === "shared" ? badge("Shared · live", "live") : cloud.mode === "loading" ? badge("Connecting…", "pending") : badge("This browser only", "pending")}</li>
      <li class="row between">SPICE / Python API ${apiBase() ? badge("Configured", "live") : badge("Not connected", "pending")}</li>
      <li class="row between">GIS layers ${badge("Not connected", "pending")}</li>
      <li class="row between">Horizon profile ${badge("Not computed", "pending")}</li></ul>`)}
  </div>
  <div class="g gl3 mt">
    ${panel("Priority roadmap", road.length ? `<ul class="divide">${road.map((t) => `<li class="row sm" style="padding:.5rem 0"><span class="mono xs primary" style="width:4rem">${esc(t.code)}</span><span class="flex1 trunc">${esc(t.title)}</span><span class="mono xs muted">${esc(t.due_date)}</span></li>`).join("")}</ul>` : empty("No open high-priority tasks"), { cls: "span2", action: `<a class="xs link" href="#tasks">Open board →</a>` })}
    ${panel("Team workload", `<div style="display:grid;gap:1rem">${Object.keys(ROLES).map((r) => { const m = tasks.filter((t) => t.owner_role === r); return `<div><div class="row between sm"><span>${ROLES[r].member} · <span class="muted">${r}</span></span><span class="mono xs muted">${m.filter((t) => t.status !== "done").length} open</span></div><div class="progress thin" style="margin-top:.375rem"><i style="width:${progress(m)}%"></i></div></div>`; }).join("")}</div>`)}
  </div>
  ${panel("Recent activity", activity.length ? `<ul class="sm" style="display:grid;gap:.5rem">${activity.slice(0, 15).map((a) => `<li><span class="mono xs muted" style="display:inline-block;min-width:11rem">${esc(new Date(a.created_at).toISOString().replace("T", " ").slice(0, 16))} UTC</span><span class="primary">${esc(a.actor_name)}</span> ${esc(a.message)}</li>`).join("")}</ul>` : empty("No activity yet", "Changes on the task board will appear here."), { cls: "mt" })}`;
}

function tasksPage() {
  const f = tasks.filter((t) => (ui.member === "all" || t.owner_role === ui.member) && (ui.prio === "all" || t.priority === ui.prio) && (ui.track === "all" || t.track === ui.track));
  const sel = (key, w, opts, label) => `<select class="${w}" data-change="${key}" aria-label="${label}">${opts.map(([v, l]) => `<option value="${esc(v)}" ${ui[key] === v ? "selected" : ""}>${esc(l)}</option>`).join("")}</select>`;
  const acts = sel("member", "w44", [["all", "All members"], ...Object.keys(ROLES).map((r) => [r, `${ROLES[r].member} · ${r}`])], "Filter by member")
    + sel("prio", "w36", [["all", "All priorities"], ...PRIORITIES.map((p) => [p, p[0].toUpperCase() + p.slice(1)])], "Filter by priority")
    + sel("track", "w56", [["all", "All tracks"], ...Object.entries(TRACKS)], "Filter by track")
    + `<button class="btn" data-act="new-task">${ic("plus")} New task</button>`;
  const cols = STATUSES.map(([id, label]) => {
    const items = f.filter((t) => t.status === id);
    return `<section class="col"><h2><span class="eyebrow strong">${label}</span><span class="mono xs muted">${items.length}</span></h2><div class="items">
      ${items.length ? "" : `<div class="drop">Empty</div>`}
      ${items.map((t) => `<article class="card">
        <div class="row between"><span class="mono xs primary">${esc(t.code)}</span><div class="row" style="gap:.125rem"><button class="btn ghost icon" data-act="edit" data-id="${t.id}" aria-label="Edit ${esc(t.code)}">${ic("pen")}</button><button class="btn ghost icon" data-act="del" data-id="${t.id}" aria-label="Delete ${esc(t.code)}">${ic("trash")}</button></div></div>
        <p class="t">${esc(t.title)}</p>
        ${t.track === "learning" ? `<div style="margin-top:.25rem">${badge("Learning track", "info")}</div>` : ""}
        ${t.deliverables ? `<p class="xs muted" style="margin-top:.25rem">↳ ${esc(t.deliverables)}</p>` : ""}
        ${(t.source_links || []).map((u) => `<div><a class="mono tiny link" href="${esc(u)}" target="_blank" rel="noreferrer noopener">Source: ${esc(sourceLabel(u))} ↗</a></div>`).join("")}
        <div class="row" style="margin-top:.5rem;flex-wrap:wrap;gap:.375rem">${badge(t.owner_role)}${badge(t.priority, "cap " + t.priority)}${t.due_date ? `<span class="mono tiny muted" style="margin-left:auto">Due ${esc(t.due_date)}</span>` : ""}</div>
        <select class="s" style="margin-top:.5rem" data-status="${t.id}" aria-label="Status of ${esc(t.code)}">${STATUSES.map(([v, l]) => `<option value="${v}" ${t.status === v ? "selected" : ""}>${l}</option>`).join("")}</select>
      </article>`).join("")}</div></section>`;
  }).join("");
  return header(cloud.mode === "shared" ? "Shared · syncs live for everyone with the link" : "Saved in this browser", "Team Tasks", acts) + `<div class="board">${cols}</div>`;
}

function taskDialog(t) {
  const v = t || { code: "", title: "", description: "", deliverables: "", owner_role: "WEB", priority: "medium", status: "todo", due_date: "2026-11-12", track: "core", source_links: [] };
  const o = (arr, cur) => arr.map(([k, l]) => `<option value="${esc(k)}" ${cur === k ? "selected" : ""}>${esc(l)}</option>`).join("");
  const d = $("#dlg");
  d.innerHTML = `<h2>${t ? "Edit " + esc(t.code) : "New task"}</h2><form class="form" id="tf" method="dialog">
    <div class="three"><div><label class="l" for="f-code">Code</label><input class="input" id="f-code" name="code" value="${esc(v.code)}" placeholder="WEB-08"></div><div><label class="l" for="f-title">Title</label><input class="input" id="f-title" name="title" required value="${esc(v.title)}"></div></div>
    <div><label class="l" for="f-desc">Description</label><textarea id="f-desc" name="description">${esc(v.description)}</textarea></div>
    <div><label class="l" for="f-del">Deliverables</label><input class="input" id="f-del" name="deliverables" value="${esc(v.deliverables)}"></div>
    <div><label class="l" for="f-src">Source links (one URL per line)</label><textarea class="mono xs" id="f-src" name="source_links">${esc((v.source_links || []).join("\n"))}</textarea></div>
    <div><label class="l" for="f-track">Track</label><select id="f-track" name="track">${o(Object.entries(TRACKS), v.track)}</select></div>
    <div class="two">
      <div><label class="l" for="f-own">Owner</label><select id="f-own" name="owner_role">${o(Object.keys(ROLES).map((r) => [r, `${ROLES[r].member} · ${r}`]), v.owner_role)}</select></div>
      <div><label class="l" for="f-pri">Priority</label><select id="f-pri" name="priority">${o(PRIORITIES.map((p) => [p, p[0].toUpperCase() + p.slice(1)]), v.priority)}</select></div>
      <div><label class="l" for="f-sta">Status</label><select id="f-sta" name="status">${o(STATUSES, v.status)}</select></div>
      <div><label class="l" for="f-due">Due date</label><input class="input" type="date" id="f-due" name="due_date" value="${esc(v.due_date || "")}"></div></div>
    <div class="end"><button type="button" class="btn outline" data-act="close">Cancel</button><button class="btn" type="submit">Save</button></div></form>`;
  d.showModal();
  $("#tf").onsubmit = (e) => {
    e.preventDefault();
    const fd = new FormData(e.target), g = (k) => String(fd.get(k) ?? "");
    const next = { code: g("code").trim(), title: g("title").trim(), description: g("description"), deliverables: g("deliverables"), owner_role: g("owner_role"), priority: g("priority"), status: g("status"), due_date: g("due_date") || null, track: g("track"), source_links: g("source_links").split("\n").map((x) => x.trim()).filter((u) => /^https?:\/\//i.test(u)), updated_at: new Date().toISOString() };
    if (!next.title) return;
    let saved = t;
    if (t) { Object.assign(t, next); log(`edited ${next.code} “${next.title}”`); }
    else { saved = { id: uid(), ...next }; tasks.push(saved); log(`created ${next.code || "task"} “${next.title}”`); }
    persist(saved); d.close(); toast(cloud.mode === "shared" ? "Saved for everyone" : "Saved"); render();
  };
}

function gis() {
  const cfg = SITES.find((s) => s.id === ui.site);
  const LAYERS = ["Landing Sites", "LOLA Elevation", "Hillshade", "Slope", "Aspect", "Sun Visibility", "Earth Visibility", "Candidate Areas"];
  const active = LAYERS.filter((l) => ui.layers[l]);
  const r = ui.report;
  const rep = !r ? "" : `<div class="xs" style="margin-top:.75rem"><div class="mono">${esc(r.name)}</div>${r.parseError ? `<p class="err" style="margin-top:.25rem">${esc(r.parseError)}</p>` : r.ok ? `<p class="ok" style="margin-top:.25rem">Provenance complete. Ready to hand to WEB-06 for tiling.</p>` : `<ul class="warn" style="margin-top:.25rem">${r.missing.map((m) => `<li>Missing: ${esc(m)}</li>`).join("")}${r.warnings.map((w) => `<li>${esc(w)}</li>`).join("")}</ul>`}<p class="muted" style="margin-top:.5rem">Checked in your browser only — nothing is uploaded.</p></div>`;
  return header("Geospatial", "GIS Explorer", siteSelect()) + `<div class="g g-gis">
    ${panel("", `<div class="map grid-bg"><svg viewBox="0 0 400 250" role="img" aria-label="Schematic placeholder for ${esc(cfg.name)}. Not georeferenced."><defs><radialGradient id="g" cx="50%" cy="50%" r="50%"><stop offset="0%" stop-color="var(--primary)" stop-opacity=".12"/><stop offset="100%" stop-color="var(--primary)" stop-opacity="0"/></radialGradient></defs>
      <circle cx="200" cy="125" r="110" fill="url(#g)"/>${[30, 60, 90].map((n) => `<circle cx="200" cy="125" r="${n}" fill="none" stroke="var(--primary)" stroke-opacity=".25" stroke-dasharray="3 4"/>`).join("")}
      <line x1="200" y1="10" x2="200" y2="240" stroke="var(--primary)" stroke-opacity=".15"/><line x1="60" y1="125" x2="340" y2="125" stroke="var(--primary)" stroke-opacity=".15"/>
      ${ui.layers["Candidate Areas"] ? `<rect x="150" y="85" width="100" height="80" fill="none" stroke="var(--warning)" stroke-dasharray="5 4" stroke-opacity=".8"/>` : ""}
      <text x="200" y="128" text-anchor="middle" fill="var(--foreground)" font-size="11">${esc(cfg.name)}</text>
      <text x="200" y="143" text-anchor="middle" fill="var(--muted-fg)" font-size="7" font-family="monospace">STUDY AREA · POSITION NOT VERIFIED</text></svg>
      <div class="tl">${badge("Schematic · not to scale", "demo")}${badge("No terrain data", "pending")}</div>
      <div class="br">CRS: pending (target Moon polar stereographic, e.g. IAU_2015:30135) · Lat/Lon: ${cfg.lat ?? "Pending verification"} · Not WGS84</div></div>
      <div style="border-top:1px solid var(--border);padding:1rem" class="sm"><div class="eyebrow" style="margin-bottom:.5rem">Active layers</div>${active.length ? `<ul class="g g2" style="gap:.25rem">${active.map((l) => `<li class="row between">${l}${badge("No data connected", "pending")}</li>`).join("")}</ul>` : `<span class="muted">None selected</span>`}</div>`, { cls: "flush" })}
    <div class="g">
      ${panel("Layers", `<div style="display:grid;gap:.625rem">${LAYERS.map((l) => `<div class="row between"><span class="sm">${l}</span><span class="sw ${ui.layers[l] ? "on" : ""}" role="switch" tabindex="0" aria-checked="${!!ui.layers[l]}" aria-label="${l}" data-layer="${l}"></span></div>`).join("")}</div>`)}
      ${panel("Connect data", `<p class="xs muted">Validate a layer's metadata sidecar before integration. Required fields:</p><p class="mono tiny primary" style="margin-top:.25rem">${REQUIRED.join(", ")}</p>
        <label class="upload">${ic("upload")} Choose metadata .json<input class="sr" type="file" accept="application/json,.json" data-file="layer"></label>${rep}`)}
    </div></div>
    <div class="mt">${empty("Why no real map yet?", "Lunar rasters need a Moon coordinate reference system (IAU 2015 lunar CRS, south-polar stereographic). Standard Leaflet/Web Mercator assumes Earth (WGS84) and would distort polar data. Integration plan: GIS lead exports Cloud-Optimized GeoTIFF tiles in a lunar polar stereographic CRS → WEB lead renders with a custom-CRS map (e.g. OpenLayers with a registered proj4 definition).")}</div>`;
}

const fmtAngle = (v) => (v === null || v === undefined || Number.isNaN(v) ? "Unavailable" : `${Number(v).toFixed(2)}°`);
function bodyPanel(name, icon, g, note) {
  const vis = !g || g.geometric_visible === null || g.geometric_visible === undefined ? badge("Unavailable", "pending") : g.geometric_visible ? badge("Above ideal horizon", "live") : badge("Below ideal horizon");
  return panel(name, `<dl class="g" style="grid-template-columns:1fr 1fr;gap:.75rem">
    <div><dt class="eyebrow">Elevation</dt><dd class="mono" style="margin-top:.25rem;font-size:1.5rem">${fmtAngle(g?.elevation_deg)}</dd></div>
    <div><dt class="eyebrow">Azimuth</dt><dd class="mono" style="margin-top:.25rem;font-size:1.5rem">${fmtAngle(g?.azimuth_deg)}</dd></div>
    <div><dt class="eyebrow">Geometric</dt><dd style="margin-top:.25rem">${vis}</dd></div>
    <div><dt class="eyebrow">Terrain</dt><dd style="margin-top:.25rem">${badge("Not computed", "pending")}</dd></div></dl><p class="xs muted" style="margin-top:.75rem">${note}</p>`, { action: icon });
}
function analysis() {
  const iso = ui.utc ? `${ui.utc}:00Z` : "";
  const d = ui.api && ui.api.kind === "ok" ? ui.api.data : null;
  return header("Geometry · SPICE", "Scientific Analysis", siteSelect() + `<div class="row" style="gap:.5rem"><label class="mono xs" for="utc">UTC</label><input class="input" style="width:13rem" id="utc" type="datetime-local" value="${esc(ui.utc)}" data-utc></div>`)
    + (!apiBase() ? `<div class="mb">${empty("SPICE backend not connected", "Values stay “Unavailable” until the Python/SpiceyPy API (PY-08) is deployed and SCIENCE_API_URL is set in config.js. Nothing on this page is estimated.")}</div>` : "")
    + (ui.api?.kind === "error" ? `<div class="mb">${empty("API error", esc(ui.api.message))}</div>` : "")
    + (ui.apiBusy ? `<p class="sm muted mb">Computing…</p>` : "")
    + `<div class="g g2">${bodyPanel("Sun", `<span class="warn">${ic("sun")}</span>`, d?.sun, "Sun above the ideal horizon is not proof of power availability — terrain may block it.")}${bodyPanel("Earth", `<span class="primary">${ic("earth")}</span>`, d?.earth, "Geometric visibility is not communications availability — terrain may block line of sight.")}</div>`
    + panel("Metadata", `<dl class="dl-grid c2 sm">
      <div><dt class="eyebrow">Timestamp</dt><dd class="mono">${esc(iso || "—")}</dd></div>
      <div><dt class="eyebrow">Reference frame</dt><dd class="mono">${esc(d?.reference_frame ?? "Pending (e.g. MOON_ME / topocentric)")}</dd></div>
      <div><dt class="eyebrow">Kernel provenance</dt><dd class="mono">${esc(d?.kernel_provenance?.join(", ") ?? "Pending")}</dd></div>
      <div><dt class="eyebrow">Data status</dt><dd class="mono">${esc(d?.data_status ?? "uncomputed")}</dd></div>
      <div style="grid-column:1/-1"><dt class="eyebrow">Azimuth convention</dt><dd class="muted">${AZ}</dd></div>
      <div style="grid-column:1/-1"><dt class="eyebrow">Elevation convention</dt><dd class="muted">${EL}</dd></div>
      <div style="grid-column:1/-1"><dt class="eyebrow">Observer point</dt><dd class="muted">Pending verification — the API must reject requests until a sourced reference point exists for the study area.</dd></div></dl>`, { cls: "mt" });
}

const TL0 = Date.parse("2026-11-13T00:00:00Z"), TL1 = Date.parse("2026-11-15T00:00:00Z");
function track(label, wins, emptyTxt, color) {
  return `<div class="track"><div class="sm">${label}</div><div class="bar">${wins === null ? `<div class="in">${emptyTxt}</div>` : wins.map((w) => { const a = Math.max(0, (Date.parse(w.start_utc) - TL0) / (TL1 - TL0)), b = Math.min(1, (Date.parse(w.end_utc) - TL0) / (TL1 - TL0)); return `<div class="w" style="left:${a * 100}%;width:${(b - a) * 100}%;background:${color}"></div>`; }).join("")}</div></div>`;
}
function timeline() {
  const d = ui.tl && ui.tl.kind === "ok" ? ui.tl.data : null;
  const ticks = Array.from({ length: 9 }, (_, i) => TL0 + (i * (TL1 - TL0)) / 8);
  return header("UTC · Nov 13–14, 2026", "Mission Timeline", siteSelect())
    + (!apiBase() ? `<div class="mb">${empty("Uncomputed", "Windows appear only after the Python timeline (PY-06) is served by the API. No illustrative windows are drawn.")}</div>` : "")
    + (ui.tl?.kind === "error" ? `<div class="mb">${empty("API error", esc(ui.tl.message))}</div>` : "")
    + panel("", `<div style="display:grid;gap:.75rem">
      <div class="ticks-row"><div></div><div class="ticks">${ticks.map((t) => `<span>${new Date(t).toISOString().slice(5, 13).replace("T", " ")}h</span>`).join("")}</div></div>
      ${track("Sun · geometric", d?.sun_geometric ?? null, "Not computed — awaiting SPICE output", "oklch(.8 .14 80/70%)")}
      ${track("Earth · geometric", d?.earth_geometric ?? null, "Not computed — awaiting SPICE output", "oklch(.8 .13 210/70%)")}
      <div class="track"><div class="sm">Terrain visibility</div><div class="bar hatch"><div class="in">Not computed — local horizon profile required</div></div></div></div>
      <div class="row" style="margin-top:1rem;flex-wrap:wrap;gap:.5rem">${badge("All times UTC", "info")}${badge("Geometric ≠ comms availability")}${badge("Sun above ideal horizon ≠ power")}</div>`);
}

function compare() {
  return header("Evidence first", "Site Comparison")
    + `<div class="mb">${empty("No overall winner or suitability score", "This page deliberately does not rank sites. Each criterion shows a value only once it is sourced, with its provenance.")}</div>`
    + panel("", `<div class="scroll-x"><table><thead><tr><th class="eyebrow">Criterion</th>${SITES.map((s) => `<th class="eyebrow">${s.name}</th>`).join("")}<th class="eyebrow">Method · owner</th></tr></thead><tbody>
      ${CRITERIA.map(([n, m, o]) => `<tr><td style="font-weight:500">${n}</td>${SITES.map(() => `<td>${badge("Pending data", "pending")}</td>`).join("")}<td class="xs muted">${m} <span class="mono primary">[${o}]</span></td></tr>`).join("")}</tbody></table></div>`, { cls: "flush" });
}

function deliverables() {
  return header("Schedule", "Deliverables & Milestones")
    + panel("Milestones", `<ol class="g g3">${MILESTONES.map(([d, l, n]) => `<li class="ms"><div class="mono xs primary">${d}</div><div style="margin-top:.25rem;font-weight:500">${l}</div><div class="xs muted">${n}</div></li>`).join("")}</ol>`)
    + `<div class="g gl3 mt" style="grid-template-columns:repeat(auto-fit,minmax(min(100%,17rem),1fr))">${Object.keys(ROLES).map((r) => { const m = tasks.filter((t) => t.owner_role === r); return panel(`${ROLES[r].member} · ${r}`, `<div class="sm" style="font-weight:500;margin-bottom:.75rem">${ROLES[r].title}</div><ul style="display:grid;gap:.75rem">${m.map((t) => `<li class="sm"><div class="row between"><span class="mono xs primary">${esc(t.code)}</span><span class="mono tiny muted">${esc(t.due_date)}</span></div><div style="margin-top:.25rem">${esc(t.title)}</div>${t.deliverables ? `<div class="xs muted">↳ ${esc(t.deliverables)}</div>` : ""}<div style="margin-top:.25rem">${badge(statusLabel(t.status), t.status === "done" ? "live" : "pending")}</div></li>`).join("")}</ul>`, { action: `<span class="mono xs muted">${progress(m)}%</span>` }); }).join("")}</div>`;
}

function resources() {
  const lnk = ([c, n, u]) => `<li><a href="${esc(u)}" target="_blank" rel="noreferrer noopener" class="row sm hov" style="padding:.5rem 0;border-bottom:1px solid var(--border)"><span class="mono tiny muted" style="width:5rem;text-transform:uppercase">${esc(c)}</span><span class="flex1">${esc(n)}</span><span class="muted">${ic("ext")}</span></a></li>`;
  return header("Provenance & method", "Resources & Methodology") + `<div class="g gl2">
    ${panel("Sources", `<ul>${LINKS.map(lnk).join("")}</ul>`)}
    ${panel("Provenance fields (required per dataset)", `<p class="mono xs muted">source · coordinate_frame · projection · units · resolution_m · timestamp_utc · kernel_provenance (SPICE) · azimuth_convention · verification_status</p>`)}
    ${panel("Lunar Science &amp; Site Familiarization (learning track, Member 1)", `<ul class="g g2" style="gap:0 1.5rem">${LUNAR_SCIENCE.map(lnk).join("")}</ul><div class="xs muted" style="margin-top:.75rem;display:grid;gap:.375rem"><p><span style="color:var(--foreground)">Attribution notes (as described by the sources):</span> the LPI Lunar South Pole Atlas presents a LOLA-derived south-polar map and identifies Shackleton and Malapert. NASA PGDA product 78 includes 5 m/pixel GeoTIFF DEMs in south-polar stereographic X/Y coordinates with MOON_ME/DE421 metadata.</p><p class="warn">Check the coordinate frame, projection, datum/radius, units and NoData value of each specific product before GIS processing. Nothing from these sources is loaded into this app yet.</p></div>`, { cls: "span-all" })}
    ${panel("Conventions", `<dl class="sm" style="display:grid;gap:.75rem">
      <div><dt class="eyebrow">Time</dt><dd>All scientific timestamps are UTC (ISO 8601, “Z” suffix).</dd></div>
      <div><dt class="eyebrow">Azimuth</dt><dd>${AZ}</dd></div><div><dt class="eyebrow">Elevation</dt><dd>${EL}</dd></div>
      <div><dt class="eyebrow">Coordinates</dt><dd>Moon body-fixed (planetocentric, IAU 2015 lunar CRS). Study-area points stay null until a sourced, verified value exists.</dd></div>
      <div><dt class="eyebrow">Map projection</dt><dd>South-polar stereographic on the lunar sphere — never Earth WGS84 / Web Mercator.</dd></div>
      <div><dt class="eyebrow">Unknown values</dt><dd>Always <code>null</code>, never 0.</dd></div></dl>`)}
    ${panel("Limitations", `<ul class="list sm muted"><li>Geometric visibility is not actual communications availability.</li><li>Sun above the ideal horizon is not proof of power availability.</li><li>Terrain may block Sun or Earth; terrain_visible stays null until a verified local horizon profile is integrated.</li><li>No validated landing suitability is claimed. Comparison shows criteria, not a winner.</li><li>Any seeded/example numbers are labelled DEMO DATA.</li></ul>`)}
    ${panel("Site config schema (example)", `<pre>${esc(JSON.stringify(EXAMPLE_SITE, null, 2))}</pre>`, { cls: "span-all" })}
    ${panel("Analysis output schema (example, uncomputed)", `<pre>${esc(JSON.stringify(EXAMPLE_ANALYSIS, null, 2))}</pre>`, { cls: "span-all" })}
    ${panel("API integration boundary", `<ol class="list sm"><li>Python lead serves FastAPI with <code>GET /analysis?site_id&amp;timestamp_utc</code> and <code>GET /timeline?site_id&amp;start_utc&amp;end_utc</code> returning the schemas above (CORS enabled for this site's domain).</li><li>Set <code>window.SCIENCE_API_URL</code> in <code>config.js</code> to the API base URL.</li><li>Analysis and Timeline pages switch from “Unavailable” to live values automatically — no redesign.</li><li>GIS lead exports lunar polar-stereographic COG tiles + metadata JSON; validate via GIS Explorer → Connect data.</li></ol>`, { cls: "span-all" })}
  </div>`;
}

function aiWorkspace() {
  const total = ui.files.reduce((s, f) => s + f.size_bytes, 0);
  const fl = ui.filesErr ? `<p class="sm err" style="margin-top:1rem">${esc(ui.filesErr)}</p>` : `<div class="divide" style="margin-top:1rem">${ui.files.map((f) => `<div class="row between" style="padding:.5rem 0"><div class="flex1"><p class="sm trunc" style="font-weight:500">${esc(f.name)}</p><p class="xs muted">${Math.round(f.size_bytes / 1024)} KB · ${esc(f.review_status)} · ${esc((f.tags || []).join(", "))}</p></div>${f.url ? `<a class="btn outline sm" href="${esc(f.url)}" target="_blank" rel="noreferrer noopener">Open</a>` : ""}<button class="btn ghost icon" data-act="rmfile" data-id="${f.id}" aria-label="Remove ${esc(f.name)}">${ic("trash")}</button></div>`).join("")}${ui.files.length ? "" : `<p class="sm muted" style="padding:.75rem 0">No files yet.</p>`}</div>`;
  const prov = [["undecided", "Not decided yet"], ["claude", "Testing Claude"], ["manus", "Testing Manus"], ["both", "Testing both"], ["selected", "Provider selected (record decision in team notes)"]];
  return header("AI workflow · shared team guide", "AI Workspace", badge("Provider-neutral") + badge("No live AI connection", "secondary")) + `
  <div class="g g3d" style="grid-template-columns:repeat(auto-fit,minmax(min(100%,20rem),1fr))">
    ${panel("What this workspace is for", `<div class="row" style="align-items:flex-start"><div style="border-radius:.5rem;background:oklch(.8 .13 210/10%);padding:.5rem" class="primary">${ic("spark")}</div><div class="sm" style="display:grid;gap:.5rem"><p>Use an AI tool to help build, modify, explain and review the <strong>entire website</strong>—not just to create a chatbot. The AI lead manages prompts, context and handoffs; the Web lead owns implementation, integration, testing and deployment.</p><p class="muted">This page is a team guide and file library. Claude and Manus are not connected here, and no AI model is currently running inside the website.</p></div></div>`, { cls: "span2" })}
    ${panel("AI lead · Member 4", `<p class="sm" style="font-weight:500">AI Workflow &amp; Data Management Lead</p><p class="sm muted" style="margin-top:.5rem">Evaluate providers, maintain prompts, prepare project context, organize files and review AI-generated work with the team.</p><p class="xs muted" style="margin-top:.75rem">WEB lead remains responsible for shipping code and maintaining the application.</p>`)}
  </div>
  ${panel("Claude vs Manus · choose by testing, not assumptions", `<div class="g g2"><div class="box p4"><h3>Claude</h3><p class="sm muted" style="margin-top:.25rem">Evaluate for code understanding, long-context reasoning, careful edits and review. Confirm current plan limits, repository access and file handling in the team's actual account.</p><a class="sm link" style="display:inline-block;margin-top:.75rem" href="https://claude.ai/" target="_blank" rel="noreferrer noopener">Open Claude ↗</a></div><div class="box p4"><h3>Manus</h3><p class="sm muted" style="margin-top:.25rem">Evaluate for agent-style multi-step execution, browser workflows and project tasks. Confirm current coding environment, repository workflow, file limits and review controls before choosing.</p><a class="sm link" style="display:inline-block;margin-top:.75rem" href="https://manus.im/" target="_blank" rel="noreferrer noopener">Open Manus ↗</a></div></div>
    <div style="margin-top:1rem;max-width:28rem"><label class="l">Team's current evaluation status</label><select data-change="provider">${prov.map(([v, l]) => `<option value="${v}" ${ui.provider === v ? "selected" : ""}>${l}</option>`).join("")}</select><p class="xs muted" style="margin-top:.5rem">Local page selection only; it does not connect an account.</p></div>`, { cls: "mt" })}
  ${panel("Whole-website AI development workflow", `<div class="steps">${[["01", "Understand", "Give the AI the project brief, architecture and exact task. Ask it to inspect before editing."], ["02", "Plan", "Request a small implementation plan, affected files, risks and database migration needs."], ["03", "Build", "Work on one bounded feature. Keep changes in version control and never paste secrets."], ["04", "Verify", "Run tests, inspect the diff, review scientific sources and have a human approve the result."]].map(([n, t, d]) => `<div class="box"><div class="mono xs primary">${n}</div><h3 style="margin-top:.25rem">${t}</h3><p class="sm muted" style="margin-top:.25rem">${d}</p></div>`).join("")}</div>`, { cls: "mt" })}
  ${panel("Copy-ready prompt library", `<div style="display:grid;gap:.75rem">${PROMPTS.map(([t, b], i) => `<div class="box"><div class="row between" style="flex-wrap:wrap;margin-bottom:.5rem"><h3 style="font-weight:500">${t}</h3><button class="btn outline sm" data-act="copy" data-i="${i}">${ic("copy")} Copy prompt</button></div><p class="xs muted" style="line-height:1.6">${esc(b)}</p></div>`).join("")}</div>`, { cls: "mt" })}
  <div class="g gl2 mt">
    ${panel("Project file library", `<div class="row xs muted" style="margin-bottom:.75rem">${ic("folder")} ${ui.files.length} files · ${(total / 1048576).toFixed(2)} MB ${cloud.mode === "shared" ? "shared with the team" : "stored in this browser"}</div>
      ${cloud.mode === "shared" && !cloud.assets ? `<p class="sm warn" style="margin-bottom:.5rem">Uploading needs Contributor access. Ask the owner to share the link with edit access.</p>` : `<div style="display:grid;gap:.5rem"><div><label class="l" for="pf">Add a project file (max 10 MB)</label><input class="input" id="pf" type="file" accept=".pdf,.json,.txt,.csv,.png,.jpg,.jpeg,.tif,.tiff"></div><div><label class="l" for="pt">Tags (comma separated)</label><input class="input" id="pt" placeholder="LOLA, Shackleton, metadata"></div><button class="btn" data-act="upload">${ic("upload")} Add to library</button></div>`}${fl}
      <p class="xs muted" style="margin-top:.75rem">${cloud.mode === "shared" ? "Files are visible to everyone with the link." : "Files stay in this browser and are not uploaded anywhere."} Keep the files your team shares with Claude or Manus here. No automatic provider sync is claimed.</p>`)}
    ${panel("Data quality &amp; safe handoff", `<div class="sm" style="display:grid;gap:.75rem">
      <div class="row" style="align-items:flex-start;gap:.5rem"><span class="primary">${ic("shield")}</span><p>Keep API keys, passwords, tokens and private credentials out of prompts, source code and uploaded project files.</p></div>
      <div class="row" style="align-items:flex-start;gap:.5rem"><span class="primary">${ic("check")}</span><p>Every scientific value needs a source, units, coordinate reference/frame, timestamp where relevant, processing method and verification status.</p></div>
      <div class="row" style="align-items:flex-start;gap:.5rem"><span class="primary">${ic("flow")}</span><p>AI-generated code and lunar analysis are proposals until reviewed and tested by a teammate. Unknown values remain null—not zero.</p></div>
      <ol class="list muted"><li>Download only the files relevant to the task.</li><li>Give the AI the task ID, project constraints and expected output.</li><li>Ask it to list every changed file and any assumptions.</li><li>Review the diff and run tests before merging.</li><li>Upload the final output and record its source/provenance.</li></ol></div>`)}
  </div>
  ${panel("Future live AI assistant · architecture only", `<p class="sm muted">If the team later decides to embed an assistant, use a server-side endpoint with a provider adapter, server-held credentials, explicit file retrieval permissions, rate limits, error handling and user confirmation for consequential actions. Keep the provider replaceable. No API key field or live model call is enabled in this build.</p>`, { cls: "mt" })}`;
}

function team() {
  const roleOpts = `<option value="">Choose your role</option>` + Object.keys(ROLES).map((r) => `<option value="${r}" ${profile.role === r ? "selected" : ""}>${ROLES[r].member} — ${ROLES[r].title}</option>`).join("");
  return header("Collaboration", "Team & Access") + `<div class="g gl2">
    ${panel("Your profile", `<div style="display:grid;gap:.75rem"><div><label class="l" for="dn">Display name</label><input class="input" id="dn" value="${esc(profile.name)}"></div><div><label class="l" for="rl">Team role</label><select id="rl">${roleOpts}</select></div><div><button class="btn" data-act="save-profile">Save</button></div></div>`)}
    ${panel(cloud.mode === "shared" ? "Shared workspace" : "Share the workspace with teammates", `<p class="sm muted" style="margin-bottom:.75rem">${cloud.mode === "shared" ? "Everyone who opens this link sees the same board. Tasks, activity, profiles and project files update live for all of them. People need Contributor (edit) access on the link to change anything; viewers can only read. Export is a backup copy." : "This copy is not connected to a shared store: each browser keeps its own board. Export to back it up or hand it to a teammate."}</p>
      <div class="row" style="flex-wrap:wrap"><button class="btn outline" data-act="export">${ic("copy")} Export JSON</button><button class="btn outline" data-act="import-paste">${ic("upload")} Import JSON</button><label class="btn outline" style="cursor:pointer">${ic("upload")} From file<input class="sr" type="file" accept="application/json,.json" data-file="import"></label>${cloud.mode !== "shared" || cloud.canAdmin ? `<button class="btn ghost" data-act="reset">Reset to seed tasks</button>` : ""}</div>
      <p class="xs muted" style="margin-top:.75rem">For live multi-user sync, connect a backend (the original project used Supabase) — see README.</p>`)}
  </div>
  ${panel("Members", cloud.mode === "shared"
      ? (members.length ? `<ul class="divide">${members.map((m) => `<li class="row between sm" style="padding:.5rem 0"><span>${esc(m.name || "Unnamed")}${m.id === cloud.uid ? ` <span class="xs muted">(you)</span>` : ""}</span><span class="mono xs primary">${m.role ? esc(m.role + " · " + (ROLES[m.role]?.title || "")) : "No role yet"}</span></li>`).join("")}</ul><p class="xs muted" style="margin-top:.75rem">${members.length} of 4 teammates have saved a profile.</p>` : empty("No profiles yet", "Save your name and role above and you will appear here for everyone."))
      : `<ul class="divide">${Object.keys(ROLES).map((r) => `<li class="row between sm" style="padding:.5rem 0"><span>${ROLES[r].member}${profile.role === r ? ` <span class="xs muted">(you${profile.name ? ": " + esc(profile.name) : ""})</span>` : ""}</span><span class="mono xs primary">${r} · ${ROLES[r].title}</span></li>`).join("")}</ul>`, { cls: "mt" })}`;
}

/* ───────── router ───────── */
const PAGES = { dashboard, tasks: tasksPage, gis, analysis, timeline, compare, deliverables, resources, "ai-workspace": aiWorkspace, team };
const TITLES = { dashboard: "Overview", tasks: "Team Tasks", gis: "GIS Explorer", analysis: "Scientific Analysis", timeline: "Mission Timeline", compare: "Site Comparison", deliverables: "Deliverables & Milestones", resources: "Resources & Methodology", "ai-workspace": "AI Workspace", team: "Team & Access" };
const route = () => { const h = location.hash.replace(/^#\/?/, "").split("?")[0]; return h === "home" ? "" : h; };
function render() {
  const r = route(), app = $("#app");
  const y = window.scrollY;
  if (!r) { app.innerHTML = landing(); document.title = "Lunar Landing Site Navigator — NASA Space Apps team"; return; }
  const page = PAGES[r];
  if (!page) { location.hash = "#dashboard"; return; }
  app.innerHTML = shell(r, page());
  document.title = `${TITLES[r]} — Lunar Landing Site Navigator`;
  window.scrollTo(0, y);
}
async function fetchApi() {
  const base = apiBase(); if (!base) return;
  const r = route(); ui.apiBusy = true; render();
  try {
    if (r === "analysis" && ui.utc) { const res = await fetch(`${base}/analysis?site_id=${ui.site}&timestamp_utc=${encodeURIComponent(ui.utc + ":00Z")}`); ui.api = res.ok ? { kind: "ok", data: await res.json() } : { kind: "error", message: `API responded ${res.status}` }; }
    if (r === "timeline") { const res = await fetch(`${base}/timeline?site_id=${ui.site}&start_utc=${encodeURIComponent("2026-11-13T00:00:00Z")}&end_utc=${encodeURIComponent("2026-11-15T00:00:00Z")}`); ui.tl = res.ok ? { kind: "ok", data: await res.json() } : { kind: "error", message: `API responded ${res.status}` }; }
  } catch (e) { const er = { kind: "error", message: e instanceof Error ? e.message : "Network error" }; ui.api = er; ui.tl = er; }
  ui.apiBusy = false; render();
}
function validateLayer(o) {
  o = o || {};
  const missing = REQUIRED.filter((k) => o[k] === undefined || o[k] === null || o[k] === "");
  const p = String(o.projection ?? "").toLowerCase(), warnings = [];
  if (p.includes("4326") || p.includes("wgs84") || p.includes("3857")) warnings.push("Earth CRS detected (WGS84/Web Mercator). Lunar data needs a Moon CRS, e.g. IAU_2015:30135 polar stereographic.");
  return { ok: !missing.length && !warnings.length, missing, warnings };
}
function importData(d) {
  if (!d || !Array.isArray(d.tasks)) throw new Error("No tasks array found.");
  tasks = d.tasks.map((x) => ({ id: uid(), code: "", title: "Untitled", description: "", deliverables: "", owner_role: "WEB", priority: "medium", status: "todo", due_date: null, track: "core", source_links: [], updated_at: new Date().toISOString(), ...x }));
  if (cloud.mode === "shared") { const imp = tasks.slice(); Promise.all(imp.map((x) => cloud.db.collection("tasks").doc(x.id).set(clean(x)))).then(() => toast(`Imported ${imp.length} tasks`)).catch(writeFail); }
  else { if (Array.isArray(d.activity)) activity = d.activity; saveTasks(); store.set("lsn.activity", activity); toast(`Imported ${tasks.length} tasks`); }
  render();
}
function download(name, blob) {
  const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = name; document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 2000);
}

/* ───────── events ───────── */
function armed(b, label) {
  if (b.dataset.armed) return true;
  b.dataset.armed = "1"; const old = b.innerHTML; b.textContent = label; b.classList.add("outline");
  setTimeout(() => { if (b.isConnected) { delete b.dataset.armed; b.innerHTML = old; } }, 3500);
  return false;
}
document.addEventListener("click", async (e) => {
  const nav = e.target.closest("[data-nav]"); if (nav) { $("#drawer")?.classList.remove("open"); return; }
  const lay = e.target.closest("[data-layer]"); if (lay) { ui.layers[lay.dataset.layer] = !ui.layers[lay.dataset.layer]; render(); return; }
  const b = e.target.closest("[data-act]"); if (!b) return;
  const id = b.dataset.id, act = b.dataset.act;
  if (act === "drawer") $("#drawer").classList.toggle("open");
  else if (act === "close") $("#dlg").close();
  else if (act === "new-task") taskDialog(null);
  else if (act === "edit") taskDialog(tasks.find((t) => t.id === id));
  else if (act === "del") { const t = tasks.find((x) => x.id === id); if (t && armed(b, "Click again to delete")) { tasks = tasks.filter((x) => x.id !== id); removeTask(t); log(`deleted ${t.code} “${t.title}”`); render(); } }
  else if (act === "copy") { try { await navigator.clipboard.writeText(PROMPTS[+b.dataset.i][1]); toast("Prompt copied"); } catch { toast("Clipboard access was blocked by the browser", true); } }
  else if (act === "save-profile") {
    profile = { name: $("#dn").value.trim(), role: $("#rl").value }; store.set("lsn.profile", profile);
    if (cloud.mode === "shared" && cloud.uid) { try { await cloud.db.collection("members").doc(cloud.uid).set({ name: profile.name, role: profile.role }); } catch (er) { writeFail(er); return; } }
    toast("Profile saved"); render(); }
  else if (act === "export") { const d = $("#dlg"); const json = JSON.stringify({ version: 1, exported_at: new Date().toISOString(), tasks, activity, profile }, null, 2); d.innerHTML = `<h2>Export board</h2><p class="sm muted" style="margin-bottom:.75rem">Copy this JSON and save it in a file. A teammate can paste it into Import.</p><textarea id="exp" class="mono xs" style="min-height:14rem" readonly>${esc(json)}</textarea><div class="end" style="margin-top:.75rem"><button class="btn outline" data-act="close">Close</button><button class="btn" data-act="copyexp">${ic("copy")} Copy JSON</button></div>`; d.showModal(); }
  else if (act === "copyexp") { const ta = $("#exp"); ta.select(); try { await navigator.clipboard.writeText(ta.value); toast("Copied"); } catch { toast("Press Ctrl/Cmd+C to copy", true); } }
  else if (act === "import-paste") { const d = $("#dlg"); d.innerHTML = `<h2>Import board</h2><textarea id="imp" class="mono xs" style="min-height:14rem" placeholder="Paste exported JSON here"></textarea><div class="end" style="margin-top:.75rem"><button class="btn outline" data-act="close">Cancel</button><button class="btn" data-act="do-import">Import</button></div>`; d.showModal(); }
  else if (act === "do-import") { try { importData(JSON.parse($("#imp").value)); $("#dlg").close(); } catch (er) { toast("Import failed: " + er.message, true); } }
  else if (act === "reset") { if (armed(b, "Click again to reset all tasks")) {
    const old = tasks.slice(); tasks = SEED(); activity = [];
    if (cloud.mode === "shared") { try { await Promise.all(old.map((x) => cloud.db.collection("tasks").doc(x.id).delete())); await Promise.all(tasks.map((x) => cloud.db.collection("tasks").doc(x.id).set(clean(x)))); } catch (er) { writeFail(er); } }
    else { saveTasks(); store.set("lsn.activity", activity); }
    toast("Tasks reset"); render(); } }
  else if (act === "upload") {
    const f = $("#pf").files[0]; if (!f) { toast("Choose a file first", true); return; }
    const okExt = /\.(pdf|json|txt|csv|png|jpe?g|tiff?)$/i.test(f.name);
    if (!okExt || f.size < 1 || f.size > 10 * 1048576) { toast("Choose PDF, JSON, TXT, CSV, PNG, JPG or TIFF up to 10 MB.", true); return; }
    const tags = $("#pt").value.split(",").map((s) => s.trim()).filter(Boolean);
    try {
      if (cloud.mode === "shared") {
        if (!cloud.assets) { toast("Uploading needs Contributor access on this link.", true); return; }
        b.disabled = true; const up = await cloud.assets.upload(f);
        const id = uid();
        await cloud.db.collection("files").doc(id).set({ name: f.name, mime_type: f.type, size_bytes: f.size, tags, review_status: "pending", created_at: new Date().toISOString(), asset_id: up.id, url: up.url, by: profile.name || "A teammate" });
        log(`added file “${f.name}”`); toast("File shared with the team");
      } else { await idb.put({ id: uid(), name: f.name, mime_type: f.type, size_bytes: f.size, tags, review_status: "pending", created_at: new Date().toISOString(), blob: f }); toast("File added to the library"); await loadFiles(); }
    } catch (er) { toast(er && er.code === "unsupported_type" ? "That file type is not supported." : (er && er.message) || "Could not store file", true); }
    finally { b.disabled = false; }
  }
  else if (act === "dl") { const f = ui.files.find((x) => x.id === id); if (f) download(f.name, f.blob); }
  else if (act === "rmfile") { const f = ui.files.find((x) => x.id === id); if (f && armed(b, "Click again to remove")) { if (cloud.mode === "shared") { try { await cloud.db.collection("files").doc(id).delete(); if (cloud.assets && f.asset_id) cloud.assets.delete(f.asset_id).catch(() => {}); } catch (er) { writeFail(er); } } else { await idb.del(id); await loadFiles(); } } }
});
document.addEventListener("keydown", (e) => { const s = e.target.closest?.("[data-layer]"); if (s && (e.key === " " || e.key === "Enter")) { e.preventDefault(); s.click(); } });
document.addEventListener("change", async (e) => {
  const t = e.target;
  if (t.dataset.status) { const k = tasks.find((x) => x.id === t.dataset.status); if (k) { k.status = t.value; k.updated_at = new Date().toISOString(); persist(k); log(`moved ${k.code} to ${statusLabel(t.value)}`); render(); } }
  else if (t.dataset.change) {
    const k = t.dataset.change; ui[k] = t.value;
    if (k === "site") { ui.api = null; ui.tl = null; render(); fetchApi(); } else render();
  }
  else if (t.dataset.utc !== undefined) { ui.utc = t.value; fetchApi(); }
  else if (t.dataset.file === "layer") {
    const f = t.files[0]; if (!f) return;
    try { ui.report = { name: f.name, ...validateLayer(JSON.parse(await f.text())) }; } catch { ui.report = { name: f.name, parseError: "Not valid JSON. Upload the layer's metadata sidecar (.json)." }; }
    render();
  }
  else if (t.dataset.file === "import") {
    const f = t.files[0]; if (!f) return;
    try { importData(JSON.parse(await f.text())); } catch (er) { toast("Import failed: " + er.message, true); }
  }
});
window.addEventListener("hashchange", () => { window.scrollTo(0, 0); render(); if (["analysis", "timeline"].includes(route())) fetchApi(); });
setInterval(() => { const c = $("#cd"); if (c) c.innerHTML = countdownHTML(); }, 30000);

/* re-render from a live update without wiping what someone is typing */
let pendingRender = false;
function softRender() {
  const a = document.activeElement;
  if (a && a.closest && a.closest("#app") && /^(INPUT|TEXTAREA)$/.test(a.tagName) && a.type !== "file") { pendingRender = true; return; }
  render();
}
document.addEventListener("focusout", () => { if (pendingRender) setTimeout(() => { pendingRender = false; render(); }, 0); });

async function initCloud() {
  const use = window.claude && window.claude.use ? (n) => window.claude.use(n).catch(() => null) : null;
  const db = use ? await use("db") : null;
  if (!db) { // not inside a viewer: browser-only mode
    cloud.mode = "local";
    tasks = store.get("lsn.tasks", null);
    if (!Array.isArray(tasks) || !tasks.length) { tasks = SEED(); store.set("lsn.tasks", tasks); }
    activity = store.get("lsn.activity", []);
    render(); loadFiles(); return;
  }
  cloud.db = db; cloud.mode = "shared";
  cloud.assets = await use("assets");
  cloud.user = await use("user");
  try { cloud.uid = cloud.user && cloud.user.id ? await cloud.user.id() : null; } catch { cloud.uid = null; }
  try { cloud.canAdmin = !!(cloud.user && cloud.user.canEdit && cloud.user.canEdit()); } catch { /* ignore */ }
  const fail = () => { /* listener error: keep what we have */ };
  db.collection("tasks").onSnapshot((snap) => { tasks = snap.docs.map((d) => ({ id: d.id, ...d.data() })); sortTasks(); cloud.loaded = true; softRender(); }, fail);
  db.collection("activity").orderBy("created_at", "desc").limit(15).onSnapshot((snap) => { activity = snap.docs.map((d) => ({ id: d.id, ...d.data() })); softRender(); }, fail);
  db.collection("files").orderBy("created_at", "desc").onSnapshot((snap) => { ui.files = snap.docs.map((d) => ({ id: d.id, ...d.data() })); ui.filesErr = ""; softRender(); }, fail);
  db.collection("members").onSnapshot((snap) => { members = snap.docs.map((d) => ({ id: d.id, ...d.data() })); softRender(); }, fail);
  // a timer so an empty or slow store never leaves the board blank forever
  setTimeout(() => { if (!cloud.loaded) { cloud.loaded = true; softRender(); } }, 10000);
}
render();
if (["analysis", "timeline"].includes(route())) fetchApi();
initCloud();
})();
