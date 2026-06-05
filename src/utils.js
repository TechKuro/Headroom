import { PHASE_TYPES, DEFAULT_INITIATIVE, DEFAULT_SETTINGS, HOURS_PER_MONTH } from './constants';

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

/** Fraction of a given month covered by [startDate, endDate]. Returns 0-1. */
export function monthCoverageFraction(startDate, endDate, month) {
  // Handle old YYYY-MM format gracefully
  if (startDate && startDate.length === 7) startDate = startDate + '-01';
  if (endDate && endDate.length === 7) {
    endDate = endDate + '-' + String(lastDayOfMonth(endDate)).padStart(2, '0');
  }

  const days = lastDayOfMonth(month);
  const mStart = `${month}-01`;
  const mEnd = `${month}-${String(days).padStart(2, '0')}`;

  const effStart = startDate > mStart ? startDate : mStart;
  const effEnd = endDate < mEnd ? endDate : mEnd;

  if (effStart > effEnd) return 0;

  const startDay = Number(effStart.slice(8, 10));
  const endDay = Number(effEnd.slice(8, 10));
  return (endDay - startDay + 1) / days;
}

/** Fractional month offset from viewStart (YYYY-MM) to a date (YYYY-MM-DD). */
export function dateOffset(viewStartMonth, date) {
  if (!date) return 0;
  const dm = dateToMonth(date);
  const mo = monthDiff(viewStartMonth, dm);
  if (date.length >= 10) {
    const day = Number(date.slice(8, 10));
    const days = lastDayOfMonth(dm);
    return mo + (day - 1) / days;
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
    const days = lastDayOfMonth(dm);
    return mo + day / days;
  }
  return mo + 1; // YYYY-MM format: treat as whole month
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

/** Migrate a phase from old format (personId, YYYY-MM) to new (personIds, YYYY-MM-DD). */
export function migratePhase(phase) {
  const migrated = { ...phase };
  if (!migrated.personIds) {
    migrated.personIds = migrated.personId ? [migrated.personId] : [];
  }
  delete migrated.personId;
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
    projects: data.projects.map(p => ({
      ...p,
      initiative: { ...DEFAULT_INITIATIVE, ...(p.initiative || {}) },
      checkIns: Array.isArray(p.checkIns) ? p.checkIns : [],
      phases: p.phases.map(ph => migratePhase(ph)),
    })),
  };
}

// --- Urgency weighting (deadline proximity) ---

export function getProjectEndMonth(project) {
  if (project.deadline) return project.deadline;
  let latest = null;
  for (const phase of project.phases) {
    if (!latest || phase.endMonth > latest) latest = phase.endMonth;
  }
  return latest;
}

export function getUrgencyFactor(month, projectEndMonth) {
  if (!projectEndMonth) return 1;
  const remaining = monthDiff(month, dateToMonth(projectEndMonth));
  if (remaining <= 0) return 1;                          // at or past end — full urgency
  return Math.max(0.7, 1.0 - (remaining - 1) * 0.06);   // 1.0 → 0.7 over ~6 months
}

// --- Capacity calculation ---

export function getPhaseIntensity(phase) {
  if (phase.intensityOverride != null) return phase.intensityOverride;
  return PHASE_TYPES[phase.type]?.weight ?? 0;
}

export function getPersonCapacity(personId, month, capacityOverrides = {}) {
  return capacityOverrides[`${personId}-${month}`] ?? 100;
}

export function getProjectHoldFactor(project, month) {
  if (!project.hold) return 1;
  const { startMonth, endMonth, reduction } = project.hold;
  if (month >= startMonth && (endMonth === null || month <= endMonth)) {
    return 1 - (reduction / 100);
  }
  return 1;
}

export function calculateLoad(personId, month, projects, whatIfProject = null) {
  let total = 0;
  const allProjects = whatIfProject ? [...projects, whatIfProject] : projects;
  for (const project of allProjects) {
    const holdFactor = getProjectHoldFactor(project, month);
    const urgency = getUrgencyFactor(month, getProjectEndMonth(project));
    for (const phase of project.phases) {
      if (getPhasePersonIds(phase).includes(personId)) {
        const fraction = monthCoverageFraction(phase.startMonth, phase.endMonth, month);
        if (fraction > 0) {
          total += Math.round(getPhaseIntensity(phase) * fraction * holdFactor * urgency);
        }
      }
    }
  }
  return total;
}

export function getEffectiveUtilisation(load, capacity) {
  if (capacity <= 0) return load > 0 ? 999 : 0;
  return Math.round(load / capacity * 100);
}

export function getLoadColor(load) {
  if (load === 0)   return 'var(--surface-2)';
  if (load <= 60)   return '#16a34a';
  if (load <= 80)   return '#ca8a04';
  if (load <= 100)  return '#ea580c';
  return '#dc2626';
}

export function getLoadTextColor(load) {
  if (load === 0) return 'var(--text-3)';
  return '#fff';
}

// --- ID generation ---

let _id = Date.now();
export function genId() {
  return String(++_id);
}

// --- Active phases for a person in a given month ---

export function getActivePhases(personId, month, projects, whatIfProject = null) {
  const result = [];
  const allProjects = whatIfProject ? [...projects, whatIfProject] : projects;
  for (const project of allProjects) {
    const holdFactor = getProjectHoldFactor(project, month);
    const urgencyFactor = getUrgencyFactor(month, getProjectEndMonth(project));
    for (const phase of project.phases) {
      if (getPhasePersonIds(phase).includes(personId)) {
        const fraction = monthCoverageFraction(phase.startMonth, phase.endMonth, month);
        if (fraction > 0) {
          const baseIntensity = getPhaseIntensity(phase);
          const effectiveIntensity = Math.round(baseIntensity * fraction * holdFactor * urgencyFactor);
          result.push({ ...phase, projectId: project.id, projectName: project.name, projectColor: project.color, initiative: getInitiative(project), isWhatIf: project.isWhatIf || false, holdFactor, urgencyFactor, effectiveIntensity });
        }
      }
    }
  }
  return result;
}

// --- Phases for a person across a month range (for timeline bars) ---

export function getPersonPhases(personId, projects, whatIfProject = null) {
  const result = [];
  const allProjects = whatIfProject ? [...projects, whatIfProject] : projects;
  for (const project of allProjects) {
    const isHeld = !!project.hold;
    for (const phase of project.phases) {
      if (getPhasePersonIds(phase).includes(personId)) {
        result.push({
          ...phase,
          projectId: project.id,
          projectName: project.name,
          projectColor: project.color,
          initiative: getInitiative(project),
          isWhatIf: project.isWhatIf || false,
          isHeld,
          hold: project.hold,
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
 * Estimate labour hours, cost and per-person breakdown for a project.
 *
 * Reuses Headroom's month-intensity model: a phase at intensity I% covering
 * fraction F of a month contributes (I/100) × F × hoursPerMonth person-hours
 * for each assigned person. Urgency and hold weighting are deliberately
 * excluded — those are scheduling/visual amplifiers, not real effort.
 */
export function getProjectLabourSummary(project, blendedRate, hoursPerMonth = HOURS_PER_MONTH) {
  const assignedHoursByPerson = {};
  let totalHours = 0;

  for (const phase of project.phases || []) {
    const intensity = getPhaseIntensity(phase);
    if (intensity <= 0) continue;
    const months = getMonthRange(dateToMonth(phase.startMonth), dateToMonth(phase.endMonth));
    let phaseHoursPerPerson = 0;
    for (const m of months) {
      const fraction = monthCoverageFraction(phase.startMonth, phase.endMonth, m);
      phaseHoursPerPerson += (intensity / 100) * fraction * hoursPerMonth;
    }
    for (const pid of getPhasePersonIds(phase)) {
      assignedHoursByPerson[pid] = (assignedHoursByPerson[pid] || 0) + phaseHoursPerPerson;
      totalHours += phaseHoursPerPerson;
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

// A deadline this many months out (or nearer), and not done, is "approaching".
const NEAR_DEADLINE_MONTHS = 2;

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

/** Distinct months (YYYY-MM) that any of the project's phases span. */
function projectActiveMonths(project) {
  const months = new Set();
  for (const phase of project.phases || []) {
    for (const m of getMonthRange(dateToMonth(phase.startMonth), dateToMonth(phase.endMonth))) {
      months.add(m);
    }
  }
  return [...months];
}

/**
 * Score a project's delivery/commercial risk.
 *
 * @param project  the project to score
 * @param opts.projects          all projects (needed to sum per-person load)
 * @param opts.blendedRate       £/hour, for the ROI factor
 * @param opts.capacityOverrides per-person/month capacity map
 * @param opts.currentMonth      YYYY-MM "now" (injectable for tests)
 * @returns { level, score, factors:[{key,label,severity,points}], needsInfo:[] }
 */
export function getProjectRisk(project, opts = {}) {
  const {
    projects = [],
    blendedRate = 45,
    capacityOverrides = {},
    currentMonth = getCurrentMonth(),
  } = opts;

  const init = getInitiative(project);
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
  if (isDone && init.progress < 100) {
    add('done-incomplete', 'Marked done but under 100%', 'low');
  }

  if (!isDone) {
    // Negative ROI — only meaningful once a value has been estimated.
    if (init.estimatedValue > 0) {
      const { cost } = getProjectLabourSummary(project, blendedRate);
      const { roi } = getRoi(init.estimatedValue, cost);
      if (roi < 0) add('negative-roi', 'Negative ROI', 'high');
    }

    // Overloaded people — an assigned person over 100% in a month THIS project runs.
    const activeMonths = projectActiveMonths(project);
    let overloaded = false;
    for (const pid of assignedIds) {
      for (const m of activeMonths) {
        const load = calculateLoad(pid, m, projects);
        const cap = getPersonCapacity(pid, m, capacityOverrides);
        if (getEffectiveUtilisation(load, cap) > 100) { overloaded = true; break; }
      }
      if (overloaded) break;
    }
    if (overloaded) add('overload', 'Assigned person over capacity', 'high');

    // Behind schedule — progress lagging the share of the timeline elapsed.
    const startMonths = phases.map(p => dateToMonth(p.startMonth)).filter(Boolean);
    const startMonth = startMonths.length ? startMonths.reduce((a, b) => (a < b ? a : b)) : null;
    const endMonth = dateToMonth(getProjectEndMonth(project));
    if (startMonth && endMonth) {
      const total = monthDiff(startMonth, endMonth);
      const elapsed = monthDiff(startMonth, currentMonth);
      if (total > 0 && elapsed > 0) {
        const expected = Math.min(1, elapsed / total) * 100;
        const gap = expected - init.progress;
        if (gap >= BEHIND_HIGH) add('behind', 'Behind schedule', 'high');
        else if (gap >= BEHIND_MED) add('behind', 'Behind schedule', 'med');
      }
    }

    // Near / past deadline.
    if (endMonth) {
      const toDeadline = monthDiff(currentMonth, endMonth);
      if (toDeadline < 0) add('overdue', 'Past deadline', 'high');
      else if (toDeadline <= NEAR_DEADLINE_MONTHS) add('deadline', 'Deadline approaching', 'med');
    }

    // Scheduled work with nobody on it.
    if (phases.length > 0 && assignedIds.size === 0) {
      add('unassigned', 'Scheduled work with no one assigned', 'med');
    }

    // Backlog on paper, but already scheduled to have started.
    if (init.status === 'backlog' && startMonth && startMonth <= currentMonth) {
      add('backlog-started', 'Backlog but already scheduled', 'low');
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
 * (intensity × coverage), unweighted by urgency/hold. "Billable" keys off the
 * initiative `chargeable` flag, which is a different axis from client/internal
 * type. Compare with getPersonUtilisation (the scheduling lens).
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
 * A person's month-by-month utilisation over the given months.
 *
 * This is the SCHEDULING lens — load is urgency/hold-weighted (calculateLoad),
 * measured against capacity (with leave/part-time overrides). util is a
 * percentage; >100 means over capacity. Mirrors what the Heatmap shows.
 */
export function getPersonUtilisation(personId, months, projects, capacityOverrides = {}) {
  return months.map(month => {
    const load = calculateLoad(personId, month, projects);
    const capacity = getPersonCapacity(personId, month, capacityOverrides);
    return { month, load, capacity, util: getEffectiveUtilisation(load, capacity) };
  });
}

/**
 * The commercial + capacity impact of taking on a what-if project on top of
 * the committed plan: added labour hours/cost, projected ROI (if a value is
 * set), and which assigned people it pushes over capacity (and when).
 *
 * "Pushed over" means: in a month the what-if contributes load, that person
 * ends up over 100% AND the what-if is what tipped them past committed work.
 */
export function getWhatIfImpact(whatIfProject, opts = {}) {
  const { projects = [], team = [], blendedRate = 45, capacityOverrides = {} } = opts;
  const summary = getProjectLabourSummary(whatIfProject, blendedRate);
  const init = getInitiative(whatIfProject);
  const { roi, roiPercent } = getRoi(init.estimatedValue, summary.cost);

  // Compare against the committed plan with the what-if excluded.
  const baseProjects = projects.filter(p => p.id !== whatIfProject.id);
  const months = projectActiveMonths(whatIfProject);
  const overloadedPeople = [];
  for (const pid of Object.keys(summary.assignedHoursByPerson)) {
    const hitMonths = [];
    for (const m of months) {
      const cap = getPersonCapacity(pid, m, capacityOverrides);
      const withWhatIf = calculateLoad(pid, m, baseProjects, whatIfProject);
      const without = calculateLoad(pid, m, baseProjects);
      if (withWhatIf > without && getEffectiveUtilisation(withWhatIf, cap) > 100) {
        hitMonths.push(m);
      }
    }
    if (hitMonths.length) {
      overloadedPeople.push({ id: pid, name: team.find(t => t.id === pid)?.name || pid, months: hitMonths });
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

export function findAvailableSlots(team, months, projects, whatIfProject, capacityOverrides, phaseType, duration) {
  const weight = PHASE_TYPES[phaseType]?.weight ?? 100;
  const result = {}; // { personId: Set<month> }

  for (const person of team) {
    const validMonths = new Set();
    for (let i = 0; i <= months.length - duration; i++) {
      let ok = true;
      for (let j = 0; j < duration; j++) {
        const m = months[i + j];
        const load = calculateLoad(person.id, m, projects, whatIfProject);
        const cap = getPersonCapacity(person.id, m, capacityOverrides);
        if (load + weight > cap) { ok = false; break; }
      }
      if (ok) {
        for (let j = 0; j < duration; j++) validMonths.add(months[i + j]);
      }
    }
    if (validMonths.size > 0) result[person.id] = validMonths;
  }
  return result;
}
