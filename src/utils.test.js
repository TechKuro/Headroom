import { describe, it, expect } from 'vitest';
import {
  addMonths, monthDiff, getMonthRange, monthToString, monthCoverageFraction,
  getPhasePersonIds, getPhaseIntensity,
  migratePhase, migrateData,
  getInitiative, getProjectLabourSummary, getRoi, getProjectRisk,
  calculateLoad, getEffectiveUtilisation,
  formatCurrency, formatSignedCurrency, formatHours,
} from './utils';
import { DEFAULT_INITIATIVE, DEFAULT_SETTINGS, HOURS_PER_MONTH } from './constants';

// A full single-month phase at 100% intensity is the unit we reason about:
// (100/100) × 1.0 coverage × HOURS_PER_MONTH person-hours.
const fullMonthPhase = (overrides = {}) => ({
  id: 'ph1', type: 'active-build', personIds: ['p1'],
  startMonth: '2025-03-01', endMonth: '2025-03-31', intensityOverride: null,
  ...overrides,
});

describe('month arithmetic', () => {
  it('adds months across a year boundary (YYYY-MM)', () => {
    expect(addMonths('2025-11', 3)).toBe('2026-02');
    expect(addMonths('2025-01', -1)).toBe('2024-12');
  });

  it('adds months to a date, clamping the day to the new month length', () => {
    expect(addMonths('2025-01-31', 1)).toBe('2025-02-28'); // Feb has no 31st
    expect(addMonths('2025-03-15', -1)).toBe('2025-02-15');
  });

  it('monthToString zero-pads', () => {
    expect(monthToString(2025, 3)).toBe('2025-03');
  });

  it('monthDiff counts whole months between YYYY-MM', () => {
    expect(monthDiff('2025-01', '2025-04')).toBe(3);
    expect(monthDiff('2025-04', '2025-01')).toBe(-3);
  });

  it('getMonthRange is inclusive of both ends', () => {
    expect(getMonthRange('2025-01', '2025-03')).toEqual(['2025-01', '2025-02', '2025-03']);
    expect(getMonthRange('2025-05', '2025-05')).toEqual(['2025-05']);
  });

  it('monthCoverageFraction returns full, partial and zero coverage', () => {
    expect(monthCoverageFraction('2025-03-01', '2025-03-31', '2025-03')).toBe(1);
    expect(monthCoverageFraction('2025-03-01', '2025-03-15', '2025-03')).toBeCloseTo(15 / 31, 5);
    expect(monthCoverageFraction('2025-03-01', '2025-03-31', '2025-04')).toBe(0);
  });
});

describe('phase helpers', () => {
  it('getPhasePersonIds reads new, legacy and empty shapes', () => {
    expect(getPhasePersonIds({ personIds: ['a', 'b'] })).toEqual(['a', 'b']);
    expect(getPhasePersonIds({ personId: 'a' })).toEqual(['a']);
    expect(getPhasePersonIds({})).toEqual([]);
  });

  it('getPhaseIntensity prefers an explicit override over the type weight', () => {
    expect(getPhaseIntensity({ type: 'active-build', intensityOverride: null })).toBe(100);
    expect(getPhaseIntensity({ type: 'active-build', intensityOverride: 60 })).toBe(60);
    expect(getPhaseIntensity({ type: 'waiting', intensityOverride: null })).toBe(10);
    expect(getPhaseIntensity({ type: 'nonexistent' })).toBe(0);
  });
});

describe('migratePhase (saved-plan safety)', () => {
  it('upgrades a legacy phase: personId → personIds, YYYY-MM → YYYY-MM-DD', () => {
    const out = migratePhase({ personId: 'a', startMonth: '2025-01', endMonth: '2025-03' });
    expect(out.personIds).toEqual(['a']);
    expect(out.personId).toBeUndefined();
    expect(out.startMonth).toBe('2025-01-01');
    expect(out.endMonth).toBe('2025-03-31'); // clamped to last day
  });

  it('leaves an already-migrated phase unchanged', () => {
    const phase = { personIds: ['a', 'b'], startMonth: '2025-01-01', endMonth: '2025-01-31' };
    const out = migratePhase(phase);
    expect(out.personIds).toEqual(['a', 'b']);
    expect(out.startMonth).toBe('2025-01-01');
    expect(out.endMonth).toBe('2025-01-31');
    expect(out.personId).toBeUndefined();
  });

  it('defaults to an empty assignee list when none is present', () => {
    expect(migratePhase({ startMonth: '2025-01', endMonth: '2025-02' }).personIds).toEqual([]);
  });
});

describe('migrateData (document migration)', () => {
  it('fills settings, capacityOverrides and per-project defaults for a bare doc', () => {
    const out = migrateData({ team: [], projects: [{ id: 'x', name: 'X', phases: [] }] });
    expect(out.settings).toEqual(DEFAULT_SETTINGS);
    expect(out.capacityOverrides).toEqual({});
    expect(out.projects[0].initiative).toEqual(DEFAULT_INITIATIVE);
    expect(out.projects[0].checkIns).toEqual([]);
  });

  it('preserves provided settings and merges partial initiative over defaults', () => {
    const out = migrateData({
      team: [], settings: { blendedRate: 75 },
      projects: [{ id: 'x', name: 'X', phases: [], initiative: { type: 'client', progress: 40 } }],
    });
    expect(out.settings.blendedRate).toBe(75);
    expect(out.projects[0].initiative).toEqual({
      ...DEFAULT_INITIATIVE, type: 'client', progress: 40,
    });
  });

  it('migrates each project phase and keeps existing check-ins', () => {
    const out = migrateData({
      team: [],
      projects: [{
        id: 'x', name: 'X', checkIns: [{ id: 'n1', text: 'hi' }],
        phases: [{ personId: 'a', startMonth: '2025-01', endMonth: '2025-02' }],
      }],
    });
    expect(out.projects[0].phases[0].personIds).toEqual(['a']);
    expect(out.projects[0].phases[0].startMonth).toBe('2025-01-01');
    expect(out.projects[0].checkIns).toEqual([{ id: 'n1', text: 'hi' }]);
  });
});

describe('getInitiative', () => {
  it('returns defaults for a project with no initiative', () => {
    expect(getInitiative(undefined)).toEqual(DEFAULT_INITIATIVE);
    expect(getInitiative({})).toEqual(DEFAULT_INITIATIVE);
  });

  it('overlays stored fields onto the defaults', () => {
    expect(getInitiative({ initiative: { type: 'client', estimatedValue: 1000 } }))
      .toEqual({ ...DEFAULT_INITIATIVE, type: 'client', estimatedValue: 1000 });
  });
});

describe('getProjectLabourSummary', () => {
  const rate = 50;

  it('derives hours from intensity × coverage × HOURS_PER_MONTH', () => {
    const project = { initiative: { type: 'internal' }, phases: [fullMonthPhase()] };
    const s = getProjectLabourSummary(project, rate);
    expect(s.totalHours).toBe(HOURS_PER_MONTH);          // 160
    expect(s.cost).toBe(HOURS_PER_MONTH * rate);          // 8000
    expect(s.assignedHoursByPerson).toEqual({ p1: HOURS_PER_MONTH });
  });

  it('counts hours per assigned person (two people doubles the total)', () => {
    const project = { phases: [fullMonthPhase({ personIds: ['p1', 'p2'] })] };
    const s = getProjectLabourSummary(project, rate);
    expect(s.assignedHoursByPerson).toEqual({ p1: HOURS_PER_MONTH, p2: HOURS_PER_MONTH });
    expect(s.totalHours).toBe(HOURS_PER_MONTH * 2);
  });

  it('applies an intensity override and scales by partial coverage', () => {
    const project = { phases: [fullMonthPhase({ intensityOverride: 50, endMonth: '2025-03-15' })] };
    const s = getProjectLabourSummary(project, rate);
    expect(s.totalHours).toBeCloseTo(0.5 * (15 / 31) * HOURS_PER_MONTH, 4);
  });

  it('routes hours to client vs internal by initiative type', () => {
    const client = getProjectLabourSummary({ initiative: { type: 'client' }, phases: [fullMonthPhase()] }, rate);
    expect(client.clientHours).toBe(HOURS_PER_MONTH);
    expect(client.internalHours).toBe(0);

    const internal = getProjectLabourSummary({ initiative: { type: 'internal' }, phases: [fullMonthPhase()] }, rate);
    expect(internal.internalHours).toBe(HOURS_PER_MONTH);
    expect(internal.clientHours).toBe(0);
  });

  it('ignores zero-intensity phases and handles an empty project', () => {
    expect(getProjectLabourSummary({ phases: [] }, rate).totalHours).toBe(0);
    const zero = getProjectLabourSummary({ phases: [fullMonthPhase({ intensityOverride: 0 })] }, rate);
    expect(zero.totalHours).toBe(0);
    expect(zero.assignedHoursByPerson).toEqual({});
  });
});

describe('getRoi', () => {
  it('computes value minus cost and a percentage', () => {
    expect(getRoi(10000, 4000)).toEqual({ roi: 6000, roiPercent: 150 });
  });

  it('reports negative ROI', () => {
    expect(getRoi(1000, 4000).roi).toBe(-3000);
  });

  it('guards against divide-by-zero when there is no cost', () => {
    expect(getRoi(5000, 0)).toEqual({ roi: 5000, roiPercent: 0 });
  });

  it('treats a missing value as zero', () => {
    expect(getRoi(undefined, 2000).roi).toBe(-2000);
  });
});

describe('calculateLoad / getEffectiveUtilisation', () => {
  it('sums weighted intensity for the assigned person in a month', () => {
    const project = {
      id: 'x', name: 'X',
      phases: [{ id: 'ph', type: 'active-build', personIds: ['p1'], startMonth: '2025-06-01', endMonth: '2025-06-30', intensityOverride: null }],
    };
    // month === project end month → urgency factor is 1, no hold → load is the raw 100.
    expect(calculateLoad('p1', '2025-06', [project])).toBe(100);
    expect(calculateLoad('someone-else', '2025-06', [project])).toBe(0);
  });

  it('getEffectiveUtilisation is load/capacity, with a zero-capacity guard', () => {
    expect(getEffectiveUtilisation(100, 100)).toBe(100);
    expect(getEffectiveUtilisation(50, 200)).toBe(25);
    expect(getEffectiveUtilisation(10, 0)).toBe(999);
    expect(getEffectiveUtilisation(0, 0)).toBe(0);
  });
});

describe('getProjectRisk', () => {
  const NOW = '2025-06';
  const factorKeys = r => r.factors.map(f => f.key).sort();

  it('scores a healthy project as Low with no factors', () => {
    const project = {
      id: 'a', name: 'Healthy', deadline: '2025-12-31',
      initiative: { type: 'client', status: 'progress', progress: 50, estimatedValue: 1_000_000 },
      phases: [{ id: 'ph', type: 'active-build', personIds: ['p1'], startMonth: '2025-05-01', endMonth: '2025-12-31', intensityOverride: null }],
    };
    const r = getProjectRisk(project, { projects: [project], blendedRate: 50, currentMonth: NOW });
    expect(r.level).toBe('low');
    expect(r.score).toBe(0);
    expect(r.factors).toEqual([]);
    expect(r.needsInfo).toEqual([]);
  });

  it('flags negative ROI alone as At risk (one High factor)', () => {
    const project = {
      id: 'a', name: 'Loss', deadline: '2025-12-31',
      initiative: { type: 'internal', status: 'progress', progress: 50, estimatedValue: 1000 },
      phases: [{ id: 'ph', type: 'active-build', personIds: ['p1'], startMonth: '2025-05-01', endMonth: '2025-12-31', intensityOverride: null }],
    };
    const r = getProjectRisk(project, { projects: [project], blendedRate: 50, currentMonth: NOW });
    expect(factorKeys(r)).toEqual(['negative-roi']);
    expect(r.score).toBe(3);
    expect(r.level).toBe('at-risk');
  });

  it('stacks overdue + behind into Critical', () => {
    const project = {
      id: 'a', name: 'Late',
      initiative: { type: 'client', status: 'progress', progress: 40, estimatedValue: 1_000_000 },
      phases: [{ id: 'ph', type: 'active-build', personIds: ['p1'], startMonth: '2025-01-01', endMonth: '2025-03-31', intensityOverride: null }],
    };
    const r = getProjectRisk(project, { projects: [project], blendedRate: 50, currentMonth: NOW });
    expect(factorKeys(r)).toEqual(['behind', 'overdue']);
    expect(r.score).toBeGreaterThanOrEqual(6);
    expect(r.level).toBe('critical');
  });

  it('detects an overloaded assigned person across the contributing projects', () => {
    const phase = pid => ({ id: 'ph', type: 'active-build', personIds: [pid], startMonth: '2025-06-01', endMonth: '2025-06-30', intensityOverride: null });
    const a = { id: 'a', name: 'A', deadline: '2025-12-31', initiative: { type: 'client', status: 'progress', progress: 50, estimatedValue: 1_000_000 }, phases: [phase('p1')] };
    const b = { id: 'b', name: 'B', deadline: '2025-12-31', initiative: { type: 'client', status: 'progress', progress: 50, estimatedValue: 1_000_000 }, phases: [phase('p1')] };
    const r = getProjectRisk(a, { projects: [a, b], blendedRate: 50, currentMonth: NOW });
    expect(factorKeys(r)).toContain('overload');
    expect(r.level).toBe('at-risk');
  });

  it('flags scheduled work with nobody assigned (Watch)', () => {
    const project = {
      id: 'a', name: 'Orphan', deadline: '2025-12-31',
      initiative: { type: 'client', status: 'progress', progress: 30, estimatedValue: 1_000_000 },
      phases: [{ id: 'ph', type: 'active-build', personIds: [], startMonth: '2025-05-01', endMonth: '2025-12-31', intensityOverride: null }],
    };
    const r = getProjectRisk(project, { projects: [project], blendedRate: 50, currentMonth: NOW });
    expect(factorKeys(r)).toEqual(['unassigned']);
    expect(r.level).toBe('watch');
  });

  it('exempts done projects from delivery factors, but flags done-but-incomplete', () => {
    const project = {
      id: 'a', name: 'Shipped',
      initiative: { type: 'client', status: 'done', progress: 80, estimatedValue: 0 },
      phases: [{ id: 'ph', type: 'active-build', personIds: ['p1'], startMonth: '2025-01-01', endMonth: '2025-03-31', intensityOverride: null }],
    };
    const r = getProjectRisk(project, { projects: [project], blendedRate: 50, currentMonth: NOW });
    // Past deadline + no value would otherwise fire — done suppresses all of it.
    expect(factorKeys(r)).toEqual(['done-incomplete']);
    expect(r.level).toBe('watch');
  });

  it('reports data gaps separately from the risk score', () => {
    const project = {
      id: 'a', name: 'Blank',
      // no initiative → all defaults (untouched); future-dated phase so no schedule factor fires
      phases: [{ id: 'ph', type: 'active-build', personIds: ['p1'], startMonth: '2025-09-01', endMonth: '2025-09-30', intensityOverride: null }],
    };
    const r = getProjectRisk(project, { projects: [project], blendedRate: 50, currentMonth: NOW });
    expect(r.needsInfo.sort()).toEqual(['metadata', 'value']);
    expect(r.factors).toEqual([]);
    expect(r.level).toBe('low');
  });
});

describe('formatting', () => {
  it('formatCurrency rounds and groups, defaulting nullish to zero', () => {
    expect(formatCurrency(1234.5)).toBe('£1,235');
    expect(formatCurrency(0)).toBe('£0');
    expect(formatCurrency(null)).toBe('£0');
  });

  it('formatSignedCurrency always shows an explicit sign (colour is never the only signal)', () => {
    expect(formatSignedCurrency(1000)).toBe('+£1,000');
    expect(formatSignedCurrency(-1000)).toBe('-£1,000');
    expect(formatSignedCurrency(0)).toBe('£0');
  });

  it('formatHours rounds and suffixes h', () => {
    expect(formatHours(160)).toBe('160h');
    expect(formatHours(0)).toBe('0h');
  });
});
