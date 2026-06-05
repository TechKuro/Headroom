import React, { createContext, useContext, useReducer, useEffect } from 'react';
import { genId, getCurrentMonth, getCurrentDate, addMonths, addDays, migratePhase } from './utils';
import { PROJECT_COLORS, DEFAULT_INITIATIVE, DEFAULT_SETTINGS } from './constants';
import { addToast } from './toast';
import * as docManager from './docManager';

const MAX_HISTORY = 50;

// --- Sample data ---

function toDate(monthStr, isEnd = false) {
  if (isEnd) {
    const [y, m] = monthStr.split('-').map(Number);
    const lastDay = new Date(y, m, 0).getDate();
    return `${monthStr}-${String(lastDay).padStart(2, '0')}`;
  }
  return `${monthStr}-01`;
}

export function createSampleData() {
  const now = getCurrentMonth();
  const team = [
    { id: genId(), name: 'Alice', role: 'Full-stack' },
    { id: genId(), name: 'Bob', role: 'Backend' },
    { id: genId(), name: 'Charlie', role: 'Frontend' },
    { id: genId(), name: 'Dana', role: 'DevOps' },
  ];

  const projects = [
    {
      id: genId(), name: 'Portal Redesign', color: PROJECT_COLORS[0], deadline: addMonths(now, 5),
      initiative: { type: 'client', status: 'progress', progress: 60, estimatedValue: 80000, chargeable: true, valueNote: 'Fixed-price engagement', description: 'Customer portal UX overhaul' },
      phases: [
        { id: genId(), personIds: [team[0].id],           type: 'scoping',       startMonth: toDate(addMonths(now, -1)),      endMonth: toDate(now, true),               intensityOverride: null },
        { id: genId(), personIds: [team[0].id, team[2].id], type: 'active-build', startMonth: toDate(addMonths(now, 1)),       endMonth: toDate(addMonths(now, 3), true),  intensityOverride: null },
        { id: genId(), personIds: [team[0].id],           type: 'final-push',    startMonth: toDate(addMonths(now, 4)),       endMonth: toDate(addMonths(now, 5), true),  intensityOverride: null },
      ],
    },
    {
      id: genId(), name: 'API Migration', color: PROJECT_COLORS[1], deadline: addMonths(now, 3),
      initiative: { type: 'internal', status: 'progress', progress: 40, estimatedValue: 30000, chargeable: false, valueNote: 'Reduced infra spend', description: 'Migrate legacy API to v2' },
      phases: [
        { id: genId(), personIds: [team[1].id],           type: 'active-build',  startMonth: toDate(addMonths(now, -2)),      endMonth: toDate(addMonths(now, 1), true),  intensityOverride: null },
        { id: genId(), personIds: [team[3].id],           type: 'active-build',  startMonth: toDate(addMonths(now, 0)),       endMonth: toDate(addMonths(now, 2), true),  intensityOverride: 60 },
        { id: genId(), personIds: [team[1].id],           type: 'final-push',    startMonth: toDate(addMonths(now, 2)),       endMonth: toDate(addMonths(now, 3), true),  intensityOverride: null },
      ],
    },
    {
      id: genId(), name: 'Mobile App', color: PROJECT_COLORS[2], deadline: addMonths(now, 8),
      initiative: { type: 'client', status: 'backlog', progress: 10, estimatedValue: 120000, chargeable: true, valueNote: 'New client contract', description: 'Native mobile companion app' },
      phases: [
        { id: genId(), personIds: [team[2].id],           type: 'scoping',       startMonth: toDate(now),                     endMonth: toDate(addMonths(now, 1), true),  intensityOverride: null },
        { id: genId(), personIds: [team[2].id],           type: 'waiting',       startMonth: toDate(addMonths(now, 2)),       endMonth: toDate(addMonths(now, 3), true),  intensityOverride: null },
        { id: genId(), personIds: [team[2].id],           type: 'active-build',  startMonth: toDate(addMonths(now, 5)),       endMonth: toDate(addMonths(now, 7), true),  intensityOverride: null },
        { id: genId(), personIds: [team[2].id],           type: 'handover',      startMonth: toDate(addMonths(now, 8)),       endMonth: toDate(addMonths(now, 8), true),  intensityOverride: null },
      ],
    },
    {
      id: genId(), name: 'Data Pipeline', color: PROJECT_COLORS[3], deadline: addMonths(now, 4),
      initiative: { type: 'internal', status: 'progress', progress: 50, estimatedValue: 45000, chargeable: false, valueNote: 'Analytics enablement', description: 'Realtime data pipeline' },
      phases: [
        { id: genId(), personIds: [team[3].id],           type: 'scoping',       startMonth: toDate(addMonths(now, -1)),      endMonth: toDate(now, true),                intensityOverride: null },
        { id: genId(), personIds: [team[1].id, team[3].id], type: 'active-build', startMonth: toDate(addMonths(now, 1)),       endMonth: toDate(addMonths(now, 3), true),  intensityOverride: null },
        { id: genId(), personIds: [team[3].id],           type: 'final-push',    startMonth: toDate(addMonths(now, 4)),       endMonth: toDate(addMonths(now, 4), true),  intensityOverride: null },
      ],
    },
  ];

  const capacityOverrides = {
    [`${team[2].id}-${addMonths(now, 3)}`]: 50, // Charlie half-time demo
  };

  return { team, projects, capacityOverrides, settings: { ...DEFAULT_SETTINGS } };
}

// --- State shape ---

function migrateData(data) {
  return {
    ...data,
    capacityOverrides: data.capacityOverrides || {},
    settings: { ...DEFAULT_SETTINGS, ...(data.settings || {}) },
    projects: data.projects.map(p => ({
      ...p,
      initiative: { ...DEFAULT_INITIATIVE, ...(p.initiative || {}) },
      phases: p.phases.map(ph => migratePhase(ph)),
    })),
  };
}

// Reads the active document from docManager's cache (hydrated by
// docManager.init() before this provider mounts). Falls back to sample data.
function getInitialState() {
  const data = docManager.getActiveDocData();
  if (data?.team && data?.projects) return migrateData(data);
  return migrateData(createSampleData());
}

// --- Core reducer ---

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
            .map(ph => ({ ...ph, personIds: (ph.personIds || []).filter(pid => pid !== id) }))
            .filter(ph => ph.personIds.length > 0),
        })),
        capacityOverrides: newOverrides,
      };
    }

    // Projects
    case 'ADD_PROJECT':
      return { ...state, projects: [...state.projects, action.payload] };
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
            ? { ...p, phases: p.phases.map(ph => ph.id === phase.id ? { ...ph, ...phase } : ph) }
            : p
        ),
      };
    }
    case 'REMOVE_PHASE': {
      const { projectId, phaseId } = action.payload;
      return { ...state, projects: state.projects.map(p => p.id === projectId ? { ...p, phases: p.phases.filter(ph => ph.id !== phaseId) } : p) };
    }

    // Capacity overrides (leave / reduced hours)
    case 'SET_CAPACITY_OVERRIDE':
      return { ...state, capacityOverrides: { ...state.capacityOverrides, [action.payload.key]: action.payload.value } };
    case 'SET_CAPACITY_OVERRIDES_BATCH': {
      const newOverrides = { ...state.capacityOverrides };
      for (const { key, value } of action.payload) {
        if (value === 100 || value === null) {
          delete newOverrides[key];
        } else {
          newOverrides[key] = value;
        }
      }
      return { ...state, capacityOverrides: newOverrides };
    }
    case 'REMOVE_CAPACITY_OVERRIDE': {
      const { [action.payload]: _, ...rest } = state.capacityOverrides;
      return { ...state, capacityOverrides: rest };
    }

    // Project hold
    case 'HOLD_PROJECT': {
      const { projectId, hold } = action.payload;
      return { ...state, projects: state.projects.map(p => p.id === projectId ? { ...p, hold } : p) };
    }
    case 'RESUME_PROJECT': {
      return { ...state, projects: state.projects.map(p => p.id === action.payload ? { ...p, hold: null } : p) };
    }

    // Settings
    case 'SET_BLENDED_RATE':
      return { ...state, settings: { ...state.settings, blendedRate: action.payload } };

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
      docManager.saveDoc(activeId, history.present).catch(() => {
        addToast('Failed to save — your latest changes may not be persisted.', 'error');
      });
    }, 600);
    return () => clearTimeout(t);
  }, [history.present]);

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
