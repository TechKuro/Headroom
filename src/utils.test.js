import { describe, it, expect } from 'vitest';
import {
  addMonths, monthDiff, getMonthRange, monthToString,
  isWorkingDay, getWorkingDayRange, enumerateSlots, slotKey, isSlotAvailable,
  getPhasePersonIds, getPhaseIntensity,
  migratePhase, migrateData,
  getInitiative, getProjectLabourSummary, getRoi, getProjectRisk,
  getPersonSlotMap, getPersonDayLoad, getOverCommitment, getPersonUtilisation, getPlannedByDayProject,
  getPersonWorkload, getWhatIfImpact, findAvailableSlots,
  claimableHours, daysAfter, isLateConfirmation, isQualifying, classificationComplete,
  formatCurrency, formatSignedCurrency, formatHours,
} from './utils';
import { DEFAULT_INITIATIVE, DEFAULT_SETTINGS, HOURS_PER_HALF_DAY } from './constants';

// A working week (Mon–Fri) and the following Monday, for fixtures.
const WK = ['2025-06-02', '2025-06-03', '2025-06-04', '2025-06-05', '2025-06-06']; // Mon–Fri
const SAT = '2025-06-07';
const NEXT_MON = '2025-06-09';

const slot = (personId, di, half = 'am') => ({ personId, date: WK[di], half });
// Build a phase from slots, deriving personIds + window the way the store does.
const phase = (slots, extra = {}) => {
  const dates = slots.map(s => s.date).sort();
  return {
    id: 'ph', type: 'active-build', slots,
    personIds: [...new Set(slots.map(s => s.personId))],
    startMonth: dates[0], endMonth: dates[dates.length - 1], ...extra,
  };
};

describe('month arithmetic (kept for deadlines/risk)', () => {
  it('adds months across a year boundary and clamps the day', () => {
    expect(addMonths('2025-11', 3)).toBe('2026-02');
    expect(addMonths('2025-01-31', 1)).toBe('2025-02-28');
  });
  it('monthDiff and getMonthRange', () => {
    expect(monthDiff('2025-01', '2025-04')).toBe(3);
    expect(getMonthRange('2025-01', '2025-03')).toEqual(['2025-01', '2025-02', '2025-03']);
    expect(monthToString(2025, 3)).toBe('2025-03');
  });
});

describe('working-day & slot helpers', () => {
  it('isWorkingDay excludes weekends', () => {
    expect(isWorkingDay(WK[0])).toBe(true);   // Mon
    expect(isWorkingDay(SAT)).toBe(false);     // Sat
    expect(isWorkingDay('2025-06-08')).toBe(false); // Sun
  });

  it('getWorkingDayRange returns Mon–Fri inclusive, skipping the weekend', () => {
    expect(getWorkingDayRange(WK[0], '2025-06-08')).toEqual(WK);
    expect(getWorkingDayRange(WK[0], NEXT_MON)).toEqual([...WK, NEXT_MON]);
  });

  it('enumerateSlots yields am+pm per working day', () => {
    const slots = enumerateSlots(WK[0], WK[1]);
    expect(slots).toEqual([
      { date: WK[0], half: 'am' }, { date: WK[0], half: 'pm' },
      { date: WK[1], half: 'am' }, { date: WK[1], half: 'pm' },
    ]);
  });

  it('slotKey and isSlotAvailable', () => {
    expect(slotKey('p1', WK[0], 'am')).toBe(`p1-${WK[0]}-am`);
    const overrides = { [`p1-${WK[0]}-am`]: true };
    expect(isSlotAvailable('p1', WK[0], 'am', overrides)).toBe(false);
    expect(isSlotAvailable('p1', WK[0], 'pm', overrides)).toBe(true);
  });
});

describe('phase helpers', () => {
  it('getPhasePersonIds reads new, legacy and empty shapes', () => {
    expect(getPhasePersonIds({ personIds: ['a', 'b'] })).toEqual(['a', 'b']);
    expect(getPhasePersonIds({ personId: 'a' })).toEqual(['a']);
    expect(getPhasePersonIds({})).toEqual([]);
  });
  it('getPhaseIntensity still resolves a type weight (label/colour use only)', () => {
    expect(getPhaseIntensity({ type: 'active-build', intensityOverride: null })).toBe(100);
    expect(getPhaseIntensity({ type: 'waiting' })).toBe(10);
  });
});

describe('migratePhase / migrateData (saved-plan safety)', () => {
  it('upgrades a legacy phase and defaults slots to []', () => {
    const out = migratePhase({ personId: 'a', startMonth: '2025-01', endMonth: '2025-03' });
    expect(out.personIds).toEqual(['a']);
    expect(out.personId).toBeUndefined();
    expect(out.startMonth).toBe('2025-01-01');
    expect(out.endMonth).toBe('2025-03-31');
    expect(out.slots).toEqual([]); // old month-model phase carries no allocation
  });

  it('preserves existing slots', () => {
    const slots = [{ personId: 'a', date: WK[0], half: 'am' }];
    expect(migratePhase({ personIds: ['a'], slots }).slots).toBe(slots);
  });

  it('migrateData fills slots/initiative/settings defaults', () => {
    const out = migrateData({ team: [], projects: [{ id: 'x', name: 'X', phases: [{ personIds: ['a'] }] }] });
    expect(out.settings).toEqual(DEFAULT_SETTINGS);
    expect(out.projects[0].initiative).toEqual(DEFAULT_INITIATIVE);
    expect(out.projects[0].phases[0].slots).toEqual([]);
  });
});

describe('getInitiative', () => {
  it('returns defaults, then overlays stored fields', () => {
    expect(getInitiative(undefined)).toEqual(DEFAULT_INITIATIVE);
    expect(getInitiative({ initiative: { type: 'client', estimatedValue: 1000 } }))
      .toEqual({ ...DEFAULT_INITIATIVE, type: 'client', estimatedValue: 1000 });
  });
});

describe('getProjectLabourSummary (slot-based)', () => {
  const rate = 100;

  it('hours = allocated half-days × 4, cost = hours × rate', () => {
    const p = { initiative: { type: 'internal' }, phases: [phase([slot('p1', 0), slot('p1', 1), slot('p1', 2)])] };
    const s = getProjectLabourSummary(p, rate);
    expect(s.totalHours).toBe(3 * HOURS_PER_HALF_DAY);     // 12
    expect(s.cost).toBe(3 * HOURS_PER_HALF_DAY * rate);
    expect(s.assignedHoursByPerson).toEqual({ p1: 3 * HOURS_PER_HALF_DAY });
  });

  it('counts each person their own slots', () => {
    const p = { phases: [phase([slot('p1', 0), slot('p1', 0, 'pm'), slot('p2', 0)])] };
    const s = getProjectLabourSummary(p, rate);
    expect(s.assignedHoursByPerson).toEqual({ p1: 8, p2: 4 });
    expect(s.totalHours).toBe(12);
  });

  it('routes hours to client vs internal by initiative type', () => {
    const slots = [slot('p1', 0), slot('p1', 1)];
    expect(getProjectLabourSummary({ initiative: { type: 'client' }, phases: [phase(slots)] }, rate).clientHours).toBe(8);
    expect(getProjectLabourSummary({ initiative: { type: 'internal' }, phases: [phase(slots)] }, rate).internalHours).toBe(8);
  });

  it('an unallocated phase contributes nothing', () => {
    expect(getProjectLabourSummary({ phases: [phase([])] }, rate).totalHours).toBe(0);
  });
});

describe('getRoi', () => {
  it('value minus cost, with a divide-by-zero guard', () => {
    expect(getRoi(10000, 4000)).toEqual({ roi: 6000, roiPercent: 150 });
    expect(getRoi(5000, 0)).toEqual({ roi: 5000, roiPercent: 0 });
    expect(getRoi(undefined, 2000).roi).toBe(-2000);
  });
});

describe('slot map / over-commitment', () => {
  const a = { id: 'A', name: 'A', color: '#f00', phases: [phase([slot('p1', 0), slot('p1', 1, 'pm')])] };
  const b = { id: 'B', name: 'B', color: '#0f0', phases: [phase([slot('p1', 0)])] }; // collides with A on WK0 am

  it('getPersonSlotMap counts claims per slot', () => {
    const map = getPersonSlotMap('p1', [a, b]);
    expect((map.get(`${WK[0]}|am`) || []).length).toBe(2); // double-booked
    expect((map.get(`${WK[1]}|pm`) || []).length).toBe(1);
  });

  it('getPersonDayLoad reports counts and double-booking', () => {
    expect(getPersonDayLoad('p1', WK[0], [a, b])).toEqual({ am: 2, pm: 0, halvesFilled: 1, doubleBooked: true });
    expect(getPersonDayLoad('p1', WK[1], [a, b])).toEqual({ am: 0, pm: 1, halvesFilled: 1, doubleBooked: false });
  });

  it('getOverCommitment lists each double-booked slot per person', () => {
    const oc = getOverCommitment([{ id: 'p1', name: 'Pat' }], [a, b]);
    expect(oc).toHaveLength(1);
    expect(oc[0].id).toBe('p1');
    expect(oc[0].slots).toEqual([{ date: WK[0], half: 'am', claims: expect.any(Array) }]);
  });

  it('getPersonUtilisation reports daily fill % and over flag', () => {
    const u = getPersonUtilisation('p1', [WK[0], WK[1]], [a, b]);
    expect(u[0]).toMatchObject({ date: WK[0], halvesFilled: 1, doubleBooked: true, util: 50 });
    expect(u[1]).toMatchObject({ date: WK[1], halvesFilled: 1, util: 50 });
  });
});

describe('getPlannedByDayProject (timesheet pre-fill)', () => {
  it('groups a person\'s slots into per-day, per-project hours', () => {
    const a = { id: 'A', name: 'A', color: '#f00', phases: [phase([slot('p1', 0), slot('p1', 0, 'pm'), slot('p1', 1)])] };
    const rows = getPlannedByDayProject('p1', [WK[0], WK[1]], [a]);
    expect(rows).toEqual([
      { date: WK[0], trackerProjectId: 'A', projectName: 'A', projectColor: '#f00', hours: 8 },
      { date: WK[1], trackerProjectId: 'A', projectName: 'A', projectColor: '#f00', hours: 4 },
    ]);
  });

  it('splits a day across projects (4h each)', () => {
    const a = { id: 'A', name: 'A', color: '#f00', phases: [phase([slot('p1', 0, 'am')])] };
    const b = { id: 'B', name: 'B', color: '#0f0', phases: [phase([slot('p1', 0, 'pm')])] };
    const rows = getPlannedByDayProject('p1', [WK[0]], [a, b]);
    expect(rows).toHaveLength(2);
    expect(rows.map(r => r.hours)).toEqual([4, 4]);
  });

  it('returns nothing for a person with no planned slots', () => {
    const a = { id: 'A', name: 'A', color: '#f00', phases: [phase([slot('p1', 0)])] };
    expect(getPlannedByDayProject('nobody', [WK[0]], [a])).toEqual([]);
  });
});

describe('getProjectRisk', () => {
  const NOW = '2025-06';
  const keys = r => r.factors.map(f => f.key).sort();
  const baseInit = { type: 'client', status: 'progress', progress: 50, estimatedValue: 1_000_000 };

  it('a healthy, single-booked project is Low', () => {
    const p = { id: 'a', name: 'Healthy', deadline: '2025-12-31', initiative: baseInit, phases: [phase([slot('p1', 0), slot('p1', 1)])] };
    const r = getProjectRisk(p, { projects: [p], blendedRate: 100, currentMonth: NOW });
    expect(r.level).toBe('low');
    expect(r.factors).toEqual([]);
    expect(r.needsInfo).toEqual([]);
  });

  it('negative ROI alone is At risk', () => {
    const p = { id: 'a', name: 'Loss', deadline: '2025-12-31', initiative: { ...baseInit, type: 'internal', estimatedValue: 500 }, phases: [phase([slot('p1', 0), slot('p1', 1)])] };
    const r = getProjectRisk(p, { projects: [p], blendedRate: 100, currentMonth: NOW }); // cost 800 > 500
    expect(keys(r)).toEqual(['negative-roi']);
    expect(r.level).toBe('at-risk');
  });

  it('a double-booked assignee fires the overload factor', () => {
    const a = { id: 'a', name: 'A', deadline: '2025-12-31', initiative: baseInit, phases: [phase([slot('p1', 0)])] };
    const b = { id: 'b', name: 'B', deadline: '2025-12-31', initiative: baseInit, phases: [phase([slot('p1', 0)])] };
    const r = getProjectRisk(a, { projects: [a, b], blendedRate: 100, currentMonth: NOW });
    expect(keys(r)).toContain('overload');
    expect(r.level).toBe('at-risk');
  });

  it('scheduled work with nobody assigned is Watch', () => {
    const p = { id: 'a', name: 'Orphan', deadline: '2025-12-31', initiative: baseInit, phases: [phase([])] };
    const r = getProjectRisk(p, { projects: [p], blendedRate: 100, currentMonth: NOW });
    expect(keys(r)).toEqual(['unassigned']);
    expect(r.level).toBe('watch');
  });

  it('done-but-incomplete is the only factor allowed on a done project', () => {
    const p = { id: 'a', name: 'Shipped', initiative: { ...baseInit, status: 'done', progress: 80, estimatedValue: 0 }, phases: [phase([slot('p1', 0)])] };
    const r = getProjectRisk(p, { projects: [p], blendedRate: 100, currentMonth: NOW });
    expect(keys(r)).toEqual(['done-incomplete']);
    expect(r.level).toBe('watch');
  });

  it('reports data gaps separately from the score', () => {
    // no initiative (all defaults), future-dated slots → no factors fire
    const p = { id: 'a', name: 'Blank', phases: [phase([{ personId: 'p1', date: '2025-09-01', half: 'am' }])] };
    const r = getProjectRisk(p, { projects: [p], blendedRate: 100, currentMonth: NOW });
    expect(r.needsInfo.sort()).toEqual(['metadata', 'value']);
    expect(r.factors).toEqual([]);
    expect(r.level).toBe('low');
  });
});

describe('getPersonWorkload', () => {
  const client = { id: 'a', name: 'A', color: '#f00', initiative: { type: 'client', chargeable: true }, phases: [phase([slot('p1', 0), slot('p1', 1)])] };
  const internal = { id: 'b', name: 'B', color: '#0f0', initiative: { type: 'internal', chargeable: false }, phases: [phase([slot('p1', 2), slot('p1', 3)])] };

  it('splits hours by type and billable flag and totals cost', () => {
    const w = getPersonWorkload('p1', [client, internal], 100);
    expect(w.totalHours).toBe(4 * HOURS_PER_HALF_DAY);   // 16
    expect(w.clientHours).toBe(8);
    expect(w.internalHours).toBe(8);
    expect(w.billableHours).toBe(8);
    expect(w.billablePct).toBe(50);
    expect(w.cost).toBe(16 * 100);
    expect(w.byProject).toHaveLength(2);
  });

  it('zeroes a person with no allocation', () => {
    const w = getPersonWorkload('nobody', [client], 100);
    expect(w.totalHours).toBe(0);
    expect(w.byProject).toEqual([]);
  });
});

describe('getWhatIfImpact', () => {
  const committed = { id: 'c', name: 'Committed', phases: [phase([slot('p1', 0)])] }; // p1 WK0 am
  const team = [{ id: 'p1', name: 'Pat' }];

  it('reports added hours and cost', () => {
    const wif = { id: 'w', name: 'New', phases: [phase([slot('p2', 0), slot('p2', 1)])] };
    const r = getWhatIfImpact(wif, { projects: [committed], team, blendedRate: 100 });
    expect(r.addedHours).toBe(2 * HOURS_PER_HALF_DAY);
    expect(r.addedCost).toBe(2 * HOURS_PER_HALF_DAY * 100);
  });

  it('projects ROI when an estimated value is set', () => {
    const wif = { id: 'w', name: 'New', initiative: { estimatedValue: 20000 }, phases: [phase([slot('p2', 0), slot('p2', 1)])] };
    const r = getWhatIfImpact(wif, { projects: [committed], team, blendedRate: 100 });
    expect(r.roi).toBe(20000 - 2 * HOURS_PER_HALF_DAY * 100);
    expect(Math.round(r.roiPercent)).toBe(2400);
  });

  it('flags the days a what-if double-books someone', () => {
    const wif = { id: 'w', name: 'New', phases: [phase([slot('p1', 0), slot('p1', 1)])] }; // WK0 am collides
    const r = getWhatIfImpact(wif, { projects: [committed], team, blendedRate: 100 });
    expect(r.overloadedPeople).toEqual([{ id: 'p1', name: 'Pat', days: [WK[0]] }]);
  });

  it('does not flag a person who stays clear', () => {
    const wif = { id: 'w', name: 'New', phases: [phase([slot('p2', 0)])] };
    const r = getWhatIfImpact(wif, { projects: [committed], team, blendedRate: 100 });
    expect(r.overloadedPeople).toEqual([]);
  });
});

describe('findAvailableSlots', () => {
  const team = [{ id: 'p1', name: 'Pat' }, { id: 'p2', name: 'Sam' }];
  const projects = [{ id: 'c', name: 'C', phases: [phase([slot('p1', 0)])] }]; // p1 busy WK0 am

  it('a single free working day (duration 1)', () => {
    const res = findAvailableSlots(team, WK, projects, null, {}, 1);
    expect(res.p1.has(`${WK[0]}|am`)).toBe(false); // WK0 not fully free for p1
    expect(res.p1.has(`${WK[1]}|am`)).toBe(true);
    expect(res.p2.has(`${WK[0]}|am`)).toBe(true);  // p2 fully free
  });

  it('leave removes a day from availability', () => {
    const overrides = { [`p2-${WK[1]}-am`]: true };
    const res = findAvailableSlots(team, WK, projects, null, overrides, 1);
    expect(res.p2.has(`${WK[1]}|am`)).toBe(false);
  });
});

describe('R&D time validation (§4)', () => {
  it('claimableHours caps at the scheme limit', () => {
    expect(claimableHours(6, 8)).toBe(6);
    expect(claimableHours(10, 8)).toBe(8);     // only the cap is claimable
    expect(claimableHours(50, 40)).toBe(40);
    expect(claimableHours(-3, 8)).toBe(0);
    expect(claimableHours(undefined, 8)).toBe(0);
  });

  it('daysAfter counts whole days from work date to confirmation', () => {
    expect(daysAfter('2025-06-02', '2025-06-02T15:00:00Z')).toBe(0);
    expect(daysAfter('2025-06-02', '2025-06-05T10:00:00Z')).toBe(2);
    expect(daysAfter('2025-06-02', '2025-06-20T10:00:00Z')).toBe(17);
  });

  it('isLateConfirmation flags confirmations well after the work', () => {
    expect(isLateConfirmation('2025-06-02', '2025-06-04T10:00:00Z')).toBe(false); // 2 days
    expect(isLateConfirmation('2025-06-02', '2025-06-20T10:00:00Z')).toBe(true);  // 17 days
    expect(isLateConfirmation('2025-06-02', '2025-06-11T10:00:00Z', 5)).toBe(true); // custom threshold
    expect(isLateConfirmation(null, null)).toBe(false);
  });

  it('isQualifying / classificationComplete enforce funding source on qualifying', () => {
    expect(isQualifying('qualifying_direct')).toBe(true);
    expect(isQualifying('qualifying_indirect')).toBe(true);
    expect(isQualifying('non_qualifying')).toBe(false);
    expect(isQualifying(null)).toBe(false);
    // non-qualifying / unset never needs a funding source
    expect(classificationComplete('non_qualifying', null)).toBe(true);
    expect(classificationComplete(null, null)).toBe(true);
    // qualifying requires one
    expect(classificationComplete('qualifying_direct', null)).toBe(false);
    expect(classificationComplete('qualifying_direct', 'grant_funded')).toBe(true);
  });
});

describe('formatting', () => {
  it('formatCurrency rounds and groups', () => {
    expect(formatCurrency(1234.5)).toBe('£1,235');
    expect(formatCurrency(null)).toBe('£0');
  });
  it('formatSignedCurrency always shows a sign', () => {
    expect(formatSignedCurrency(1000)).toBe('+£1,000');
    expect(formatSignedCurrency(-1000)).toBe('-£1,000');
    expect(formatSignedCurrency(0)).toBe('£0');
  });
  it('formatHours suffixes h', () => {
    expect(formatHours(160)).toBe('160h');
    expect(formatHours(0)).toBe('0h');
  });
});
