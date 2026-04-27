import { PHASE_TYPES } from './constants';

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
          result.push({ ...phase, projectId: project.id, projectName: project.name, projectColor: project.color, isWhatIf: project.isWhatIf || false, holdFactor, urgencyFactor, effectiveIntensity });
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
