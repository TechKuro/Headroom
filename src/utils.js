import { PHASE_TYPES, DEFAULT_INITIATIVE, DEFAULT_SETTINGS, HOURS_PER_HALF_DAY, HALVES, WORKING_DAYS, LATE_CONFIRMATION_DAYS, MAX_HOURS_PER_DAY, MAX_HOURS_PER_WEEK } from './constants';

// --- Month arithmetic (YYYY-MM strings) ---

export function getCurrentMonth() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

export function getCurrentDate() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export function parseMonth(m) {
  const [y, mo] = m.split('-').map(Number);
  return { year: y, month: mo };
}

export function monthToString(year, month) {
  return `${year}-${String(month).padStart(2, '0')}`;
}

export function addMonths(m, n) {
  const parts = m.split('-');
  const year = Number(parts[0]);
  const month = Number(parts[1]);
  const total = (year * 12 + (month - 1)) + n;
  const newYear = Math.floor(total / 12);
  const newMonth = (total % 12) + 1;
  if (parts.length >= 3) {
    // Date format (YYYY-MM-DD): preserve day, clamp to last day of new month
    const day = Number(parts[2]);
    const maxDay = new Date(newYear, newMonth, 0).getDate();
    const clampedDay = Math.min(day, maxDay);
    return `${newYear}-${String(newMonth).padStart(2, '0')}-${String(clampedDay).padStart(2, '0')}`;
  }
  return monthToString(newYear, newMonth);
}

export function addDays(date, n) {
  const d = new Date(date + 'T12:00:00');
  d.setDate(d.getDate() + n);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

// Whole calendar days from `from` to `to` (positive when `to` is later). Noon
// anchoring sidesteps DST. Both args are YYYY-MM-DD strings.
export function dayDiff(from, to) {
  const a = new Date(from + 'T12:00:00');
  const b = new Date(to + 'T12:00:00');
  return Math.round((b - a) / 86400000);
}

export function monthDiff(a, b) {
  const pa = parseMonth(a);
  const pb = parseMonth(b);
  return (pb.year * 12 + pb.month) - (pa.year * 12 + pa.month);
}

export function monthLabel(m) {
  const { year, month } = parseMonth(m);
  const names = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  return `${names[month - 1]} ${year}`;
}

export function monthLabelShort(m) {
  const { year, month } = parseMonth(m);
  const names = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  return `${names[month - 1]} '${String(year).slice(2)}`;
}

export function getMonthRange(start, end) {
  const months = [];
  let current = start;
  while (current <= end) {
    months.push(current);
    current = addMonths(current, 1);
  }
  return months;
}

// --- Date helpers (YYYY-MM-DD) ---

export function dateToMonth(d) {
  return d ? d.slice(0, 7) : d;
}

export function lastDayOfMonth(yearMonth) {
  const { year, month } = parseMonth(yearMonth);
  return new Date(year, month, 0).getDate();
}

/** Fractional month offset from viewStart (YYYY-MM) to a date (YYYY-MM-DD). */
export function dateOffset(viewStartMonth, date) {
  if (!date) return 0;
  const dm = dateToMonth(date);
  const mo = monthDiff(viewStartMonth, dm);
  if (date.length >= 10) {
    const day = Number(date.slice(8, 10));
    return mo + (day - 1) / lastDayOfMonth(dm);
  }
  return mo;
}

/** Fractional month offset to the END of a date (i.e. includes that day). */
export function dateOffsetEnd(viewStartMonth, date) {
  if (!date) return 0;
  const dm = dateToMonth(date);
  const mo = monthDiff(viewStartMonth, dm);
  if (date.length >= 10) {
    const day = Number(date.slice(8, 10));
    return mo + day / lastDayOfMonth(dm);
  }
  return mo + 1;
}

export function formatDateShort(d) {
  if (!d) return '';
  const parts = d.split('-');
  if (parts.length < 3) return monthLabelShort(d);
  const names = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  return `${Number(parts[2])} ${names[Number(parts[1]) - 1]} '${parts[0].slice(2)}`;
}

// --- Phase data helpers ---

/** Returns array of person IDs (handles both old personId and new personIds format). */
export function getPhasePersonIds(phase) {
  if (phase.personIds) return phase.personIds;
  if (phase.personId) return [phase.personId];
  return [];
}

/** Migrate a phase to the current shape (personIds[], YYYY-MM-DD dates, slots[]). */
export function migratePhase(phase) {
  const migrated = { ...phase };
  if (!migrated.personIds) {
    migrated.personIds = migrated.personId ? [migrated.personId] : [];
  }
  delete migrated.personId;
  // Half-day allocations. Old (month-model) phases have none — default to empty
  // so they load without crashing (they simply carry no allocation/cost).
  if (!Array.isArray(migrated.slots)) migrated.slots = [];
  if (migrated.startMonth && migrated.startMonth.length === 7) {
    migrated.startMonth = migrated.startMonth + '-01';
  }
  if (migrated.endMonth && migrated.endMonth.length === 7) {
    migrated.endMonth = migrated.endMonth + '-' + String(lastDayOfMonth(migrated.endMonth)).padStart(2, '0');
  }
  return migrated;
}

/**
 * Migrate a whole document to the current shape, filling safe defaults so
 * plans saved before the initiative/settings/check-in layers still load.
 * Pure and side-effect free — used by the store on load/import and covered by
 * tests, since a silent change here can corrupt saved plans.
 */
export function migrateData(data) {
  return {
    ...data,
    capacityOverrides: data.capacityOverrides || {},
    settings: { ...DEFAULT_SETTINGS, ...(data.settings || {}) },
    rndProjects: Array.isArray(data.rndProjects) ? data.rndProjects : [],
    grants: Array.isArray(data.grants) ? data.grants : [],
    projects: data.projects.map(p => ({
      ...p,
      initiative: { ...DEFAULT_INITIATIVE, ...(p.initiative || {}) },
      checkIns: Array.isArray(p.checkIns) ? p.checkIns : [],
      phases: p.phases.map(ph => migratePhase(ph)),
    })),
  };
}

// --- Project end (deadline) ---

export function getProjectEndMonth(project) {
  if (project.deadline) return project.deadline;
  let latest = null;
  for (const phase of project.phases) {
    if (!latest || phase.endMonth > latest) latest = phase.endMonth;
  }
  return latest;
}

// Phase intensity is now a label/colour concern only — no longer feeds cost or
// load. Kept so views can still shade bars by type weight if they want.
export function getPhaseIntensity(phase) {
  if (phase.intensityOverride != null) return phase.intensityOverride;
  return PHASE_TYPES[phase.type]?.weight ?? 0;
}

// --- Half-day slot model ---

/** Is this YYYY-MM-DD a working day (Mon–Fri)? */
export function isWorkingDay(date) {
  // Parse at noon to dodge timezone/DST edge cases (same trick as addDays).
  return WORKING_DAYS.includes(new Date(date + 'T12:00:00').getDay());
}

/** Working days (YYYY-MM-DD, Mon–Fri) from start to end inclusive. */
export function getWorkingDayRange(startDate, endDate) {
  const days = [];
  let d = startDate;
  while (d <= endDate) {
    if (isWorkingDay(d)) days.push(d);
    d = addDays(d, 1);
  }
  return days;
}

/** Every half-day slot {date, half} across the working days in [start,end]. */
export function enumerateSlots(startDate, endDate) {
  const slots = [];
  for (const date of getWorkingDayRange(startDate, endDate)) {
    for (const half of HALVES) slots.push({ date, half });
  }
  return slots;
}

/** Canonical key for a person's half-day slot (leave overrides + lookups). */
export function slotKey(personId, date, half) {
  return `${personId}-${date}-${half}`;
}

/** A slot is available unless leave has marked it unavailable. */
export function isSlotAvailable(personId, date, half, capacityOverrides = {}) {
  return !capacityOverrides[slotKey(personId, date, half)];
}

/**
 * Map of a person's allocations keyed 'date|half' → array of claims
 * ({ projectId, projectName, projectColor, phaseId }). Per slot: length 0 free,
 * 1 committed, ≥2 double-booked (over-committed). The core over-commitment
 * primitive — build once per render and look up per cell.
 */
export function getPersonSlotMap(personId, projects, whatIfProject = null) {
  const map = new Map();
  const all = whatIfProject ? [...projects, whatIfProject] : projects;
  for (const project of all) {
    for (const phase of project.phases || []) {
      for (const slot of phase.slots || []) {
        if (slot.personId !== personId) continue;
        const key = `${slot.date}|${slot.half}`;
        const arr = map.get(key) || [];
        arr.push({ projectId: project.id, projectName: project.name, projectColor: project.color, phaseId: phase.id });
        map.set(key, arr);
      }
    }
  }
  return map;
}

/** A person's allocation counts for one day, with double-book detection. */
export function getPersonDayLoad(personId, date, projects, whatIfProject = null, slotMap = null) {
  const map = slotMap || getPersonSlotMap(personId, projects, whatIfProject);
  const am = (map.get(`${date}|am`) || []).length;
  const pm = (map.get(`${date}|pm`) || []).length;
  return { am, pm, halvesFilled: (am > 0 ? 1 : 0) + (pm > 0 ? 1 : 0), doubleBooked: am > 1 || pm > 1 };
}

/** Every (person, date, half) booked more than once, across all projects. */
export function getOverCommitment(team, projects, whatIfProject = null) {
  const result = [];
  for (const person of team) {
    const map = getPersonSlotMap(person.id, projects, whatIfProject);
    const slots = [];
    for (const [key, claims] of map) {
      if (claims.length > 1) {
        const [date, half] = key.split('|');
        slots.push({ date, half, claims });
      }
    }
    if (slots.length) result.push({ id: person.id, name: person.name, slots });
  }
  return result;
}

/**
 * Pre-fill rows for the R&D timesheet: a person's planned half-day allocation
 * over `days`, grouped per (working day × tracker project), with hours =
 * slots × 4. The engineer confirms/edits these into actual TimeEntry records.
 */
export function getPlannedByDayProject(personId, days, projects) {
  const map = getPersonSlotMap(personId, projects);
  const rows = [];
  for (const date of days) {
    const byProject = new Map();
    for (const half of HALVES) {
      for (const c of (map.get(`${date}|${half}`) || [])) {
        const p = byProject.get(c.projectId)
          || { date, trackerProjectId: c.projectId, projectName: c.projectName, projectColor: c.projectColor, slots: 0 };
        p.slots += 1;
        byProject.set(c.projectId, p);
      }
    }
    for (const p of byProject.values()) {
      rows.push({ date: p.date, trackerProjectId: p.trackerProjectId, projectName: p.projectName, projectColor: p.projectColor, hours: p.slots * HOURS_PER_HALF_DAY });
    }
  }
  return rows;
}

// load/capacity as a percentage (capacity in halves; e.g. 1 of 2 halves = 50%).
export function getEffectiveUtilisation(load, capacity) {
  if (capacity <= 0) return load > 0 ? 999 : 0;
  return Math.round(load / capacity * 100);
}

// Colour by utilisation %: empty / part day (green) / full day (amber) / over (red).
export function getLoadColor(util) {
  if (util <= 0)   return 'var(--surface-2)';
  if (util <= 50)  return '#16a34a';
  if (util <= 100) return '#ca8a04';
  return '#dc2626';
}

export function getLoadTextColor(util) {
  if (util <= 0) return 'var(--text-3)';
  return '#fff';
}

// --- ID generation ---

let _id = Date.now();
export function genId() {
  return String(++_id);
}

// --- Active phases for a person on a given day ---

// A phase is "active" for a person on a date if they hold a slot that day.
export function getActivePhases(personId, date, projects, whatIfProject = null) {
  const result = [];
  const allProjects = whatIfProject ? [...projects, whatIfProject] : projects;
  for (const project of allProjects) {
    for (const phase of project.phases || []) {
      const halves = (phase.slots || []).filter(s => s.personId === personId && s.date === date).map(s => s.half);
      if (halves.length) {
        result.push({
          ...phase, projectId: project.id, projectName: project.name, projectColor: project.color,
          initiative: getInitiative(project), isWhatIf: project.isWhatIf || false, halves,
        });
      }
    }
  }
  return result;
}

// --- Phases for a person across the timeline (for bars) ---

export function getPersonPhases(personId, projects, whatIfProject = null) {
  const result = [];
  const allProjects = whatIfProject ? [...projects, whatIfProject] : projects;
  for (const project of allProjects) {
    for (const phase of project.phases || []) {
      if (getPhasePersonIds(phase).includes(personId)) {
        result.push({
          ...phase,
          projectId: project.id,
          projectName: project.name,
          projectColor: project.color,
          initiative: getInitiative(project),
          isWhatIf: project.isWhatIf || false,
        });
      }
    }
  }
  return result;
}

// --- Stack overlapping bars ---

// Each project occupies a single row regardless of whether its phases happen
// to touch or overlap each other — the project reads as one continuous track.
// Different projects are packed against each other only when their spans
// don't collide.
export function stackBars(bars) {
  const projectMap = new Map();
  for (const bar of bars) {
    const arr = projectMap.get(bar.projectId) || [];
    arr.push(bar);
    projectMap.set(bar.projectId, arr);
  }

  const projects = [];
  for (const [projectId, projBars] of projectMap) {
    const sorted = [...projBars].sort((a, b) =>
      a.startMonth < b.startMonth ? -1 : a.startMonth > b.startMonth ? 1 : 0
    );
    let earliestStart = sorted[0].startMonth;
    let latestEnd = sorted[0].endMonth;
    for (const bar of sorted) {
      if (bar.startMonth < earliestStart) earliestStart = bar.startMonth;
      if (bar.endMonth > latestEnd) latestEnd = bar.endMonth;
    }
    projects.push({ projectId, phases: sorted, earliestStart, latestEnd });
  }

  projects.sort((a, b) => a.earliestStart < b.earliestStart ? -1 : 1);

  const globalRows = []; // [{ lastEnd }]
  for (const project of projects) {
    let target = globalRows.findIndex(r => r.lastEnd < project.earliestStart);
    if (target === -1) {
      target = globalRows.length;
      globalRows.push({ lastEnd: '' });
    }
    for (const bar of project.phases) bar._row = target;
    if (project.latestEnd > globalRows[target].lastEnd) globalRows[target].lastEnd = project.latestEnd;
  }

  // Record the start of the next bar on the same row so renderers can snap
  // a bar's width against its neighbour rather than overlapping it.
  const byRow = new Map();
  for (const bar of bars) {
    if (bar._row == null) continue;
    const arr = byRow.get(bar._row) || [];
    arr.push(bar);
    byRow.set(bar._row, arr);
  }
  for (const rowBars of byRow.values()) {
    rowBars.sort((a, b) => a.startMonth < b.startMonth ? -1 : 1);
    for (let i = 0; i < rowBars.length; i++) {
      const next = rowBars[i + 1];
      rowBars[i]._nextStart = next?.startMonth ?? null;
      rowBars[i]._nextProjectId = next?.projectId ?? null;
    }
  }

  return { bars, rowCount: globalRows.length };
}

// --- Initiative / commercial calculations ---

/** Normalise a project's initiative metadata, filling safe defaults. */
export function getInitiative(project) {
  return { ...DEFAULT_INITIATIVE, ...(project?.initiative || {}) };
}

/**
 * Labour hours, cost and per-person breakdown for a project, from its half-day
 * slot allocations: each allocated slot = HOURS_PER_HALF_DAY hours for that
 * person. Cost = total hours × blendedRate. Client/internal split keys off the
 * initiative type. (Phase-type intensity no longer affects cost.)
 */
export function getProjectLabourSummary(project, blendedRate) {
  const assignedHoursByPerson = {};
  let totalHours = 0;

  for (const phase of project.phases || []) {
    for (const slot of phase.slots || []) {
      assignedHoursByPerson[slot.personId] = (assignedHoursByPerson[slot.personId] || 0) + HOURS_PER_HALF_DAY;
      totalHours += HOURS_PER_HALF_DAY;
    }
  }

  const isClient = getInitiative(project).type === 'client';
  return {
    totalHours,
    cost: totalHours * blendedRate,
    assignedHoursByPerson,
    clientHours: isClient ? totalHours : 0,
    internalHours: isClient ? 0 : totalHours,
  };
}

/**
 * Delivery progress from confirmed engineer time vs planned work.
 * pct = confirmed ÷ planned hours, capped at 100 for display. Returns
 * pct = null when nothing is planned (a ratio would be meaningless), and
 * flags overrun when more has been delivered than was planned.
 */
export function getProgress(plannedHours, confirmedHours) {
  if (!(plannedHours > 0)) return { pct: null, overrun: false };
  const raw = (confirmedHours / plannedHours) * 100;
  return { pct: Math.min(100, Math.round(raw)), overrun: confirmedHours > plannedHours };
}

/** ROI from estimated value and labour cost. */
export function getRoi(estimatedValue, cost) {
  const roi = (estimatedValue || 0) - cost;
  const roiPercent = cost > 0 ? (roi / cost) * 100 : 0;
  return { roi, roiPercent };
}

// --- Risk scoring ---
//
// Each signal that fires contributes points by severity; the total maps to a
// band. Tuned so a single strong signal reads "At risk" and it takes two to
// reach "Critical". Data-completeness gaps are surfaced separately (needsInfo)
// and never added to the score — a project with no value estimate is unscored,
// not risky. All thresholds are named here so the model can be retuned in one
// place. Every fired factor is returned, so the score is always explainable.

const RISK_POINTS = { high: 3, med: 2, low: 1 };

// expected% − actual% progress gap that counts as behind schedule.
const BEHIND_MED = 20;
const BEHIND_HIGH = 40;

// A deadline this many days out (or nearer), and not done, is "approaching".
const NEAR_DEADLINE_DAYS = 14;

function riskLevelFromScore(score) {
  if (score >= 6) return 'critical';
  if (score >= 3) return 'at-risk';
  if (score >= 1) return 'watch';
  return 'low';
}

/** True when the initiative has never been edited away from its defaults. */
function isDefaultInitiative(init) {
  return Object.keys(DEFAULT_INITIATIVE).every(k => init[k] === DEFAULT_INITIATIVE[k]);
}

/**
 * Score a project's delivery/commercial risk.
 *
 * @param project  the project to score
 * @param opts.projects     all projects (needed to detect cross-project double-booking)
 * @param opts.blendedRate  £/hour, for the ROI factor
 * @param opts.currentDate  YYYY-MM-DD "today" (injectable for tests)
 * @param opts.progress     derived delivery % (confirmed ÷ planned); falls back to the initiative value
 * @returns { level, score, factors:[{key,label,severity,points}], needsInfo:[] }
 */
export function getProjectRisk(project, opts = {}) {
  const {
    projects = [],
    blendedRate = 110,
    currentDate = getCurrentDate(),
    progress,
  } = opts;

  const init = getInitiative(project);
  // Derived delivery progress when supplied (confirmed ÷ planned hours);
  // otherwise fall back to the initiative's own value.
  const pct = progress != null ? progress : init.progress;
  const phases = project.phases || [];
  const assignedIds = new Set();
  for (const ph of phases) for (const id of getPhasePersonIds(ph)) assignedIds.add(id);

  // Data completeness — reported, not scored.
  const needsInfo = [];
  if (!(init.estimatedValue > 0)) needsInfo.push('value');
  if (isDefaultInitiative(init)) needsInfo.push('metadata');

  const factors = [];
  const add = (key, label, severity) =>
    factors.push({ key, label, severity, points: RISK_POINTS[severity] });

  const isDone = init.status === 'done';

  // Consistency flag — the only factor that can fire on a 'done' project.
  if (isDone && pct < 100) {
    add('done-incomplete', 'Marked done but under 100%', 'low');
  }

  if (!isDone) {
    // Negative ROI — only meaningful once a value has been estimated.
    if (init.estimatedValue > 0) {
      const { cost } = getProjectLabourSummary(project, blendedRate);
      const { roi } = getRoi(init.estimatedValue, cost);
      if (roi < 0) add('negative-roi', 'Negative ROI', 'high');
    }

    // Overloaded people — an assigned person double-booked on a slot this project claims.
    let overloaded = false;
    for (const pid of assignedIds) {
      const map = getPersonSlotMap(pid, projects);
      for (const claims of map.values()) {
        if (claims.length > 1 && claims.some(c => c.projectId === project.id)) { overloaded = true; break; }
      }
      if (overloaded) break;
    }
    if (overloaded) add('overload', 'Assigned person double-booked', 'high');

    // Project window (day-level): explicit start, else earliest allocated
    // slot, else the earliest phase window; end = deadline (or last slot).
    let startDate = project.start || null;
    if (!startDate) {
      for (const ph of phases) for (const s of ph.slots || []) {
        if (!startDate || s.date < startDate) startDate = s.date;
      }
    }
    if (!startDate) {
      for (const ph of phases) if (ph.startMonth && (!startDate || ph.startMonth < startDate)) startDate = ph.startMonth;
    }
    const endDate = getProjectEndMonth(project);

    // Behind schedule — delivered progress lagging the share of the timeline elapsed.
    if (startDate && endDate) {
      const total = dayDiff(startDate, endDate);
      const elapsed = dayDiff(startDate, currentDate);
      if (total > 0 && elapsed > 0) {
        const expected = Math.min(1, elapsed / total) * 100;
        const gap = expected - pct;
        if (gap >= BEHIND_HIGH) add('behind', 'Behind schedule', 'high');
        else if (gap >= BEHIND_MED) add('behind', 'Behind schedule', 'med');
      }
    }

    // Near / past deadline.
    if (endDate) {
      const toDeadline = dayDiff(currentDate, endDate);
      if (toDeadline < 0) add('overdue', 'Past deadline', 'high');
      else if (toDeadline <= NEAR_DEADLINE_DAYS) add('deadline', 'Deadline approaching', 'med');
    }

    // Scheduled work with nobody on it.
    if (phases.length > 0 && assignedIds.size === 0) {
      add('unassigned', 'Scheduled work with no one assigned', 'med');
    }

    // Not started / backlog on paper, but already scheduled to have begun.
    if ((init.status === 'backlog' || init.status === 'not-started') && startDate && startDate <= currentDate) {
      add('backlog-started', 'Scheduled but not started', 'low');
    }
  }

  const score = factors.reduce((s, f) => s + f.points, 0);
  return { level: riskLevelFromScore(score), score, factors, needsInfo };
}

// --- Per-person aggregates ---

/**
 * A person's labour across all projects: hours (total / client / internal /
 * billable), cost, and a per-project breakdown sorted by contribution.
 *
 * This is the EFFORT/COST lens — hours come from getProjectLabourSummary
 * (allocated half-days × 4h). "Billable" keys off the initiative `chargeable`
 * flag, a different axis from client/internal type. Compare with
 * getPersonUtilisation (the scheduling lens).
 */
export function getPersonWorkload(personId, projects, blendedRate) {
  let totalHours = 0, clientHours = 0, internalHours = 0, billableHours = 0;
  const byProject = [];
  for (const p of projects) {
    const hours = getProjectLabourSummary(p, blendedRate).assignedHoursByPerson[personId] || 0;
    if (hours <= 0) continue;
    const init = getInitiative(p);
    totalHours += hours;
    if (init.type === 'client') clientHours += hours; else internalHours += hours;
    if (init.chargeable) billableHours += hours;
    byProject.push({ id: p.id, name: p.name, color: p.color, hours });
  }
  byProject.sort((a, b) => b.hours - a.hours);
  return {
    totalHours, clientHours, internalHours, billableHours,
    cost: totalHours * blendedRate,
    billablePct: totalHours > 0 ? (billableHours / totalHours) * 100 : 0,
    byProject,
  };
}

/**
 * A person's working-day utilisation over the given days. SCHEDULING lens:
 * how many half-day slots are filled each day, and whether any half is
 * double-booked. util = filled halves / halves-per-day × 100.
 */
export function getPersonUtilisation(personId, days, projects) {
  const map = getPersonSlotMap(personId, projects);
  return days.map(date => {
    const { am, pm, halvesFilled, doubleBooked } = getPersonDayLoad(personId, date, projects, null, map);
    return { date, am, pm, halvesFilled, doubleBooked, util: Math.round((halvesFilled / HALVES.length) * 100) };
  });
}

/**
 * The commercial + capacity impact of taking on a what-if project on top of
 * the committed plan: added labour hours/cost, projected ROI (if a value is
 * set), and which assigned people it pushes over capacity (and when).
 *
 * "Pushed over" means: the what-if allocates a person to a half-day slot they
 * already have a committed claim on — i.e. it creates a double-booking.
 */
export function getWhatIfImpact(whatIfProject, opts = {}) {
  const { projects = [], team = [], blendedRate = 110 } = opts;
  const summary = getProjectLabourSummary(whatIfProject, blendedRate);
  const init = getInitiative(whatIfProject);
  const { roi, roiPercent } = getRoi(init.estimatedValue, summary.cost);

  // Compare against the committed plan with the what-if excluded.
  const baseProjects = projects.filter(p => p.id !== whatIfProject.id);
  const overloadedPeople = [];
  for (const pid of Object.keys(summary.assignedHoursByPerson)) {
    const baseMap = getPersonSlotMap(pid, baseProjects);
    const days = new Set();
    for (const phase of whatIfProject.phases || []) {
      for (const slot of phase.slots || []) {
        if (slot.personId !== pid) continue;
        if ((baseMap.get(`${slot.date}|${slot.half}`) || []).length >= 1) days.add(slot.date);
      }
    }
    if (days.size) {
      overloadedPeople.push({ id: pid, name: team.find(t => t.id === pid)?.name || pid, days: [...days] });
    }
  }

  return {
    addedHours: summary.totalHours,
    addedCost: summary.cost,
    estimatedValue: init.estimatedValue,
    roi, roiPercent,
    overloadedPeople,
  };
}

// --- R&D time validation (§4) ---

/** Claimable hours = actual capped at the scheme limit (only the cap is claimable). */
export function claimableHours(actual, cap) {
  const a = Number(actual) || 0;
  return Math.max(0, Math.min(a, cap));
}

/** A qualifying classification (direct or indirect) — drives tax treatment. */
export function isQualifying(classification) {
  return classification === 'qualifying_direct' || classification === 'qualifying_indirect';
}

/**
 * §4: a qualifying entry MUST carry a funding source (so grant-funded hours can
 * be segregated in the relief pack). Non-qualifying / unclassified are fine.
 */
export function classificationComplete(classification, fundingSource) {
  if (!isQualifying(classification)) return true;
  return !!fundingSource;
}

/** Whole calendar days between a work date and when it was confirmed. */
export function daysAfter(workDate, confirmedAt) {
  if (!workDate || !confirmedAt) return 0;
  const w = new Date(workDate + 'T12:00:00');
  const c = new Date(confirmedAt);
  return Math.floor((c - w) / 86400000);
}

/** Was this entry confirmed suspiciously long after the work happened? */
export function isLateConfirmation(workDate, confirmedAt, days = LATE_CONFIRMATION_DAYS) {
  if (!workDate || !confirmedAt) return false;
  return daysAfter(workDate, confirmedAt) > days;
}

// --- R&D reporting (Phase 4 packs) ---

function mondayStr(date) {
  let d = String(date).slice(0, 10);
  while (new Date(d + 'T12:00:00').getDay() !== 1) d = addDays(d, -1);
  return d;
}

/**
 * Collapse a raw entry list to the EFFECTIVE set that counts toward a pack:
 * only authorised/locked entries, with any authorised/locked adjusting entry
 * superseding its target's hours (latest wins). Adjusting entries are folded
 * into their target, never counted on their own — so no double-counting.
 */
export function resolveEffectiveEntries(entries) {
  const counts = e => e.status === 'authorised' || e.status === 'locked';
  const adjByTarget = new Map();
  for (const e of entries) {
    if (e.adjusts_entry_id && counts(e)) {
      const cur = adjByTarget.get(e.adjusts_entry_id);
      if (!cur || String(e.created_at) > String(cur.created_at)) adjByTarget.set(e.adjusts_entry_id, e);
    }
  }
  const out = [];
  for (const e of entries) {
    if (e.adjusts_entry_id) continue;
    if (!counts(e)) continue;
    const adj = adjByTarget.get(e.id);
    out.push(adj ? { ...e, hours: Number(adj.hours), description: adj.description ?? e.description, _adjusted: true } : e);
  }
  return out;
}

/**
 * Per-person actual vs claimable hours, applying the day cap then the week cap
 * ("only the cap is claimable"). Input: effective entries with person_id,
 * work_date, hours.
 */
export function getClaimableByPerson(entries, dayCap = MAX_HOURS_PER_DAY, weekCap = MAX_HOURS_PER_WEEK) {
  const byPerson = new Map();
  for (const e of entries) {
    const pid = e.person_id;
    const date = String(e.work_date).slice(0, 10);
    const rec = byPerson.get(pid) || { actual: 0, byDay: new Map(), name: e.person_name || pid };
    const h = Number(e.hours) || 0;
    rec.actual += h;
    rec.byDay.set(date, (rec.byDay.get(date) || 0) + h);
    byPerson.set(pid, rec);
  }
  const out = {};
  for (const [pid, rec] of byPerson) {
    const byWeek = new Map();
    for (const [date, h] of rec.byDay) {
      byWeek.set(mondayStr(date), (byWeek.get(mondayStr(date)) || 0) + Math.min(h, dayCap));
    }
    let claimable = 0;
    for (const wk of byWeek.values()) claimable += Math.min(wk, weekCap);
    out[pid] = { name: rec.name, actual: rec.actual, claimable };
  }
  return out;
}

/** Render rows to CSV (RFC-4180 quoting). */
export function toCsv(headers, rows) {
  const esc = v => {
    const s = v == null ? '' : String(v);
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  return [headers, ...rows].map(r => r.map(esc).join(',')).join('\n');
}

// --- Formatting ---

export function formatCurrency(n) {
  return '£' + Math.round(n || 0).toLocaleString('en-GB');
}

/** Currency with an explicit +/- sign, so colour is never the only signal. */
export function formatSignedCurrency(n) {
  const rounded = Math.round(n || 0);
  const sign = rounded > 0 ? '+' : rounded < 0 ? '-' : '';
  return `${sign}£${Math.abs(rounded).toLocaleString('en-GB')}`;
}

export function formatHours(n) {
  return Math.round(n || 0).toLocaleString('en-GB') + 'h';
}

// --- Availability finder ---

/**
 * People with at least one run of `duration` consecutive working days that are
 * completely free — every half-day unallocated (incl. any what-if) and not on
 * leave. Returns { personId: Set<'date|half'> } of free slots to highlight.
 */
export function findAvailableSlots(team, days, projects, whatIfProject, capacityOverrides = {}, duration = 1) {
  const result = {};
  for (const person of team) {
    const map = getPersonSlotMap(person.id, projects, whatIfProject);
    const dayFree = date => HALVES.every(h =>
      (map.get(`${date}|${h}`) || []).length === 0 && isSlotAvailable(person.id, date, h, capacityOverrides));
    const slots = new Set();
    for (let i = 0; i <= days.length - duration; i++) {
      let ok = true;
      for (let j = 0; j < duration; j++) { if (!dayFree(days[i + j])) { ok = false; break; } }
      if (ok) for (let j = 0; j < duration; j++) for (const h of HALVES) slots.add(`${days[i + j]}|${h}`);
    }
    if (slots.size > 0) result[person.id] = slots;
  }
  return result;
}
