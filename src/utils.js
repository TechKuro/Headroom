import { PHASE_TYPES } from './constants';

// --- Month arithmetic (YYYY-MM strings) ---

export function getCurrentMonth() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

export function parseMonth(m) {
  const [y, mo] = m.split('-').map(Number);
  return { year: y, month: mo };
}

export function monthToString(year, month) {
  return `${year}-${String(month).padStart(2, '0')}`;
}

export function addMonths(m, n) {
  const { year, month } = parseMonth(m);
  const total = (year * 12 + (month - 1)) + n;
  return monthToString(Math.floor(total / 12), (total % 12) + 1);
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
  const remaining = monthDiff(month, projectEndMonth);
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
      if (phase.personId === personId && month >= phase.startMonth && month <= phase.endMonth) {
        total += Math.round(getPhaseIntensity(phase) * holdFactor * urgency);
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
      if (phase.personId === personId && month >= phase.startMonth && month <= phase.endMonth) {
        const baseIntensity = getPhaseIntensity(phase);
        const effectiveIntensity = Math.round(baseIntensity * holdFactor * urgencyFactor);
        result.push({ ...phase, projectId: project.id, projectName: project.name, projectColor: project.color, isWhatIf: project.isWhatIf || false, holdFactor, urgencyFactor, effectiveIntensity });
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
      if (phase.personId === personId) {
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

export function stackBars(bars) {
  const sorted = [...bars].sort((a, b) => {
    if (a.startMonth !== b.startMonth) return a.startMonth < b.startMonth ? -1 : 1;
    return monthDiff(a.startMonth, a.endMonth) > monthDiff(b.startMonth, b.endMonth) ? -1 : 1;
  });
  const rows = [];
  for (const bar of sorted) {
    let placed = false;
    for (let i = 0; i < rows.length; i++) {
      const last = rows[i][rows[i].length - 1];
      if (bar.startMonth > last.endMonth) {
        rows[i].push(bar);
        bar._row = i;
        placed = true;
        break;
      }
    }
    if (!placed) {
      bar._row = rows.length;
      rows.push([bar]);
    }
  }
  return { bars: sorted, rowCount: rows.length };
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
