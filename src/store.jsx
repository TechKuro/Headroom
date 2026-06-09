import React, { createContext, useContext, useReducer, useEffect } from 'react';
import { genId, getCurrentDate, addDays, getWorkingDayRange, migrateData } from './utils';
import { PROJECT_COLORS, DEFAULT_INITIATIVE, DEFAULT_SETTINGS } from './constants';
import { addToast } from './toast';
import * as docManager from './docManager';

const MAX_HISTORY = 50;

// --- Sample data (half-day allocation) ---

function mondayOfCurrentWeek() {
  let d = getCurrentDate();
  while (new Date(d + 'T12:00:00').getDay() !== 1) d = addDays(d, -1);
  return d;
}

export function createSampleData() {
  const monday = mondayOfCurrentWeek();
  const days = getWorkingDayRange(monday, addDays(monday, 13)); // 10 working days (2 weeks)
  const team = [
    { id: genId(), name: 'Alice', role: 'Full-stack' },
    { id: genId(), name: 'Bob', role: 'Backend' },
    { id: genId(), name: 'Charlie', role: 'Frontend' },
    { id: genId(), name: 'Dana', role: 'DevOps' },
  ];
  const [alice, bob, charlie, dana] = team.map(t => t.id);

  const slot = (personId, di, half) => ({ date: days[di], half, personId });
  const mkPhase = (type, slots) => {
    const dates = slots.map(s => s.date).sort();
    return {
      id: genId(), type, slots,
      personIds: [...new Set(slots.map(s => s.personId))],
      startMonth: dates[0], endMonth: dates[dates.length - 1],
    };
  };

  const projects = [
    {
      id: genId(), name: 'Portal Redesign', color: PROJECT_COLORS[0], start: monday, deadline: addDays(monday, 25),
      initiative: { type: 'client', status: 'progress', estimatedValue: 80000, chargeable: true, valueNote: 'Fixed-price engagement', description: 'Customer portal UX overhaul' },
      phases: [
        mkPhase('active-build', [
          slot(alice, 0, 'am'), slot(alice, 0, 'pm'), slot(alice, 1, 'am'), slot(alice, 1, 'pm'),
          slot(alice, 2, 'am'), slot(charlie, 5, 'am'), slot(charlie, 5, 'pm'),
        ]),
      ],
    },
    {
      id: genId(), name: 'API Migration', color: PROJECT_COLORS[1], start: monday, deadline: addDays(monday, 18),
      initiative: { type: 'internal', status: 'progress', estimatedValue: 30000, chargeable: false, valueNote: 'Reduced infra spend', description: 'Migrate legacy API to v2' },
      phases: [
        mkPhase('active-build', [slot(bob, 0, 'am'), slot(bob, 0, 'pm'), slot(bob, 1, 'am')]),
      ],
    },
    {
      id: genId(), name: 'Mobile App', color: PROJECT_COLORS[2], start: addDays(monday, 10), deadline: addDays(monday, 60),
      initiative: { type: 'client', status: 'backlog', estimatedValue: 120000, chargeable: true, valueNote: 'New client contract', description: 'Native mobile companion app' },
      phases: [
        mkPhase('scoping', [slot(charlie, 2, 'am'), slot(charlie, 2, 'pm'), slot(charlie, 3, 'am'), slot(charlie, 3, 'pm')]),
      ],
    },
    {
      id: genId(), name: 'Data Pipeline', color: PROJECT_COLORS[3], start: monday, deadline: addDays(monday, 30),
      initiative: { type: 'internal', status: 'progress', estimatedValue: 45000, chargeable: false, valueNote: 'Analytics enablement', description: 'Realtime data pipeline' },
      phases: [
        // Bob day-1 AM here collides with API Migration day-1 AM → a deliberate double-booking demo.
        mkPhase('active-build', [slot(dana, 0, 'am'), slot(dana, 1, 'pm'), slot(bob, 1, 'am'), slot(bob, 2, 'am'), slot(bob, 2, 'pm')]),
      ],
    },
  ];

  // Charlie on leave day-4 (both halves) — availability/leave demo.
  const capacityOverrides = {
    [`${charlie}-${days[4]}-am`]: true,
    [`${charlie}-${days[4]}-pm`]: true,
  };

  const rndProjects = [
    {
      id: genId(), name: 'Realtime pipeline R&D', status: 'active', accountingPeriods: 'FY 2026',
      advanceSought: 'Sub-second analytics over a high-volume event stream.',
      technologicalUncertainty: 'Whether existing OSS stream processors can meet the latency budget at our volumes.',
      baseline: 'Off-the-shelf batch tooling cannot achieve the required latency; no readily-deducible solution.',
      howResolved: 'Prototype + benchmark candidate architectures.', competentProfessional: 'Dana (DevOps lead)',
      trackerProjectIds: [projects[3].id], // Data Pipeline
    },
  ];

  const grants = [
    {
      id: genId(), funder: 'Innovate UK', reference: 'IUK-2026-0042', budget: 250000,
      start: days[0], end: addDays(monday, 365), claimCadence: 'quarterly',
      iarMilestones: 'Q1, Q2, Q3, Q4',
      workPackages: [
        { id: genId(), name: 'WP1 — Architecture & benchmarking' },
        { id: genId(), name: 'WP2 — Pipeline implementation' },
      ],
    },
  ];

  return { team, projects, capacityOverrides, rndProjects, grants, settings: { ...DEFAULT_SETTINGS } };
}

// --- State shape ---

// Reads the active document from docManager's cache (hydrated by
// docManager.init() before this provider mounts). Falls back to sample data.
function getInitialState() {
  const data = docManager.getActiveDocData();
  if (data?.team && data?.projects) return migrateData(data);
  return migrateData(createSampleData());
}

// --- Core reducer ---

// Apply a new slot set to a phase: rebuild personIds from slots and widen the
// phase's planning window to cover them.
function applySlots(phase, slots) {
  const dates = slots.map(s => s.date).sort();
  const next = { ...phase, slots, personIds: [...new Set(slots.map(s => s.personId))] };
  if (dates.length) {
    if (!next.startMonth || dates[0] < next.startMonth) next.startMonth = dates[0];
    if (!next.endMonth || dates[dates.length - 1] > next.endMonth) next.endMonth = dates[dates.length - 1];
  }
  return next;
}

// Replace one phase via a mapper, leaving everything else untouched.
function mapPhase(state, projectId, phaseId, fn) {
  return {
    ...state,
    projects: state.projects.map(p =>
      p.id !== projectId ? p : { ...p, phases: p.phases.map(ph => ph.id !== phaseId ? ph : fn(ph)) }
    ),
  };
}

function reducer(state, action) {
  switch (action.type) {
    // Team
    case 'ADD_TEAM_MEMBER':
      return { ...state, team: [...state.team, action.payload] };
    case 'UPDATE_TEAM_MEMBER':
      return { ...state, team: state.team.map(m => m.id === action.payload.id ? { ...m, ...action.payload } : m) };
    case 'REMOVE_TEAM_MEMBER': {
      const id = action.payload;
      // Also clean up capacity overrides for this person
      const newOverrides = {};
      for (const [key, val] of Object.entries(state.capacityOverrides)) {
        if (!key.startsWith(id + '-')) newOverrides[key] = val;
      }
      return {
        ...state,
        team: state.team.filter(m => m.id !== id),
        projects: state.projects.map(p => ({
          ...p,
          phases: p.phases
            .map(ph => {
              const slots = (ph.slots || []).filter(s => s.personId !== id);
              return { ...ph, slots, personIds: (ph.personIds || []).filter(pid => pid !== id) };
            })
            .filter(ph => ph.personIds.length > 0),
        })),
        capacityOverrides: newOverrides,
      };
    }

    // Projects
    case 'ADD_PROJECT':
      return { ...state, projects: [...state.projects, action.payload] };
    case 'IMPORT_PROJECTS': // append a batch (e.g. from a CSV) in one undo step
      return { ...state, projects: [...state.projects, ...action.payload] };
    case 'UPDATE_PROJECT':
      return { ...state, projects: state.projects.map(p => p.id === action.payload.id ? { ...p, ...action.payload } : p) };
    case 'UPDATE_INITIATIVE': {
      const { projectId, initiative } = action.payload;
      return {
        ...state,
        projects: state.projects.map(p =>
          p.id === projectId
            ? { ...p, initiative: { ...DEFAULT_INITIATIVE, ...p.initiative, ...initiative } }
            : p
        ),
      };
    }
    case 'ADD_CHECKIN_NOTE': {
      const { projectId, note } = action.payload;
      return {
        ...state,
        projects: state.projects.map(p =>
          p.id === projectId ? { ...p, checkIns: [...(p.checkIns || []), note] } : p
        ),
      };
    }
    case 'DELETE_CHECKIN_NOTE': {
      const { projectId, noteId } = action.payload;
      return {
        ...state,
        projects: state.projects.map(p =>
          p.id === projectId ? { ...p, checkIns: (p.checkIns || []).filter(n => n.id !== noteId) } : p
        ),
      };
    }
    case 'REMOVE_PROJECT':
      return { ...state, projects: state.projects.filter(p => p.id !== action.payload) };

    // Phases
    case 'ADD_PHASE': {
      const { projectId, phase } = action.payload;
      return { ...state, projects: state.projects.map(p => p.id === projectId ? { ...p, phases: [...p.phases, phase] } : p) };
    }
    case 'UPDATE_PHASE': {
      const { projectId, phase } = action.payload;
      return {
        ...state,
        projects: state.projects.map(p =>
          p.id === projectId
            ? { ...p, phases: p.phases.map(ph => {
                if (ph.id !== phase.id) return ph;
                const merged = { ...ph, ...phase };
                // Keep personIds in step with slots whenever slots are part of the patch.
                if ('slots' in phase) merged.personIds = [...new Set((merged.slots || []).map(s => s.personId))];
                return merged;
              }) }
            : p
        ),
      };
    }
    case 'REMOVE_PHASE': {
      const { projectId, phaseId } = action.payload;
      return { ...state, projects: state.projects.map(p => p.id === projectId ? { ...p, phases: p.phases.filter(ph => ph.id !== phaseId) } : p) };
    }

    // Half-day slot allocation
    case 'ALLOCATE_SLOT': {
      const { projectId, phaseId, personId, date, half } = action.payload;
      return mapPhase(state, projectId, phaseId, ph => {
        if ((ph.slots || []).some(s => s.personId === personId && s.date === date && s.half === half)) return ph;
        return applySlots(ph, [...(ph.slots || []), { personId, date, half }]);
      });
    }
    case 'DEALLOCATE_SLOT': {
      const { projectId, phaseId, personId, date, half } = action.payload;
      return mapPhase(state, projectId, phaseId, ph =>
        applySlots(ph, (ph.slots || []).filter(s => !(s.personId === personId && s.date === date && s.half === half))));
    }
    case 'ALLOCATE_SLOTS_BATCH': {
      const { projectId, phaseId, add = [], remove = [] } = action.payload;
      const same = (a, b) => a.personId === b.personId && a.date === b.date && a.half === b.half;
      return mapPhase(state, projectId, phaseId, ph => {
        let slots = (ph.slots || []).filter(s => !remove.some(r => same(r, s)));
        for (const s of add) if (!slots.some(x => same(x, s))) slots = [...slots, s];
        return applySlots(ph, slots);
      });
    }

    // Leave (per half-day slot availability)
    case 'SET_SLOT_LEAVE': {
      const { personId, date, half, off } = action.payload;
      const key = `${personId}-${date}-${half}`;
      const next = { ...state.capacityOverrides };
      if (off) next[key] = true; else delete next[key];
      return { ...state, capacityOverrides: next };
    }
    case 'SET_SLOT_LEAVE_BATCH': {
      const next = { ...state.capacityOverrides };
      for (const { personId, date, half, off } of action.payload) {
        const key = `${personId}-${date}-${half}`;
        if (off) next[key] = true; else delete next[key];
      }
      return { ...state, capacityOverrides: next };
    }

    // Settings
    case 'SET_BLENDED_RATE':
      return { ...state, settings: { ...state.settings, blendedRate: action.payload } };

    // R&D projects (the tax unit)
    case 'ADD_RND_PROJECT':
      return { ...state, rndProjects: [...(state.rndProjects || []), action.payload] };
    case 'UPDATE_RND_PROJECT':
      return { ...state, rndProjects: (state.rndProjects || []).map(r => r.id === action.payload.id ? { ...r, ...action.payload } : r) };
    case 'REMOVE_RND_PROJECT':
      return { ...state, rndProjects: (state.rndProjects || []).filter(r => r.id !== action.payload) };

    // Grants + work packages
    case 'ADD_GRANT':
      return { ...state, grants: [...(state.grants || []), action.payload] };
    case 'UPDATE_GRANT':
      return { ...state, grants: (state.grants || []).map(g => g.id === action.payload.id ? { ...g, ...action.payload } : g) };
    case 'REMOVE_GRANT':
      return { ...state, grants: (state.grants || []).filter(g => g.id !== action.payload) };
    case 'ADD_WORK_PACKAGE': {
      const { grantId, workPackage } = action.payload;
      return { ...state, grants: (state.grants || []).map(g => g.id === grantId ? { ...g, workPackages: [...(g.workPackages || []), workPackage] } : g) };
    }
    case 'UPDATE_WORK_PACKAGE': {
      const { grantId, workPackage } = action.payload;
      return { ...state, grants: (state.grants || []).map(g => g.id === grantId ? { ...g, workPackages: (g.workPackages || []).map(w => w.id === workPackage.id ? { ...w, ...workPackage } : w) } : g) };
    }
    case 'REMOVE_WORK_PACKAGE': {
      const { grantId, workPackageId } = action.payload;
      return { ...state, grants: (state.grants || []).map(g => g.id === grantId ? { ...g, workPackages: (g.workPackages || []).filter(w => w.id !== workPackageId) } : g) };
    }

    // Bulk import
    case 'IMPORT_DATA':
      return migrateData({ team: action.payload.team, projects: action.payload.projects, capacityOverrides: action.payload.capacityOverrides || {}, settings: action.payload.settings });

    default:
      return state;
  }
}

// --- Undo/redo wrapper ---

function undoableReducer(history, action) {
  switch (action.type) {
    case 'LOAD_DOCUMENT': {
      return { past: [], present: migrateData(action.payload), future: [] };
    }
    case 'UNDO': {
      if (history.past.length === 0) return history;
      const previous = history.past[history.past.length - 1];
      return {
        past: history.past.slice(0, -1),
        present: previous,
        future: [history.present, ...history.future.slice(0, MAX_HISTORY)],
      };
    }
    case 'REDO': {
      if (history.future.length === 0) return history;
      const next = history.future[0];
      return {
        past: [...history.past.slice(-MAX_HISTORY), history.present],
        present: next,
        future: history.future.slice(1),
      };
    }
    default: {
      const newPresent = reducer(history.present, action);
      if (newPresent === history.present) return history;
      return {
        past: [...history.past.slice(-(MAX_HISTORY - 1)), history.present],
        present: newPresent,
        future: [],
      };
    }
  }
}

// --- Contexts ---

const StoreContext = createContext(null);
const DispatchContext = createContext(null);
const HistoryContext = createContext({ canUndo: false, canRedo: false });

export function StoreProvider({ children }) {
  const [history, dispatch] = useReducer(undoableReducer, null, () => ({
    past: [],
    present: getInitialState(),
    future: [],
  }));

  // Persist present state to the active document (debounced; async-safe for the
  // cloud backend, harmless for localStorage).
  useEffect(() => {
    const activeId = docManager.getActiveDocId();
    if (!activeId) return;
    const t = setTimeout(() => {
      // While a conflict is unresolved, hold off — saving would clobber the
      // other user's work. The ConflictBanner drives the reload/overwrite choice.
      const conflict = docManager.getConflict();
      if (conflict && conflict.id === activeId) return;
      docManager.saveDoc(activeId, history.present).catch(() => {
        addToast('Failed to save — your latest changes may not be persisted.', 'error');
      });
    }, 600);
    return () => clearTimeout(t);
  }, [history.present]);

  // Cloud only: when the tab regains focus, check whether someone else has
  // saved over the plan we're editing (no-op in local mode).
  useEffect(() => {
    function onFocus() { docManager.checkActiveFreshness(); }
    function onVisible() { if (!document.hidden) docManager.checkActiveFreshness(); }
    window.addEventListener('focus', onFocus);
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      window.removeEventListener('focus', onFocus);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, []);

  return (
    <StoreContext.Provider value={history.present}>
      <DispatchContext.Provider value={dispatch}>
        <HistoryContext.Provider value={{ canUndo: history.past.length > 0, canRedo: history.future.length > 0 }}>
          {children}
        </HistoryContext.Provider>
      </DispatchContext.Provider>
    </StoreContext.Provider>
  );
}

export function useStore() { return useContext(StoreContext); }
export function useDispatch() { return useContext(DispatchContext); }
export function useHistory() { return useContext(HistoryContext); }
