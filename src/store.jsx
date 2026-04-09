import React, { createContext, useContext, useReducer, useEffect } from 'react';
import { genId, getCurrentMonth, addMonths } from './utils';
import { PROJECT_COLORS } from './constants';

const STORAGE_KEY = 'headroom-capacity-planner';

// --- Sample data ---

function createSampleData() {
  const now = getCurrentMonth();
  const team = [
    { id: genId(), name: 'Alice', role: 'Full-stack' },
    { id: genId(), name: 'Bob', role: 'Backend' },
    { id: genId(), name: 'Charlie', role: 'Frontend' },
    { id: genId(), name: 'Dana', role: 'DevOps' },
  ];

  const projects = [
    {
      id: genId(),
      name: 'Portal Redesign',
      color: PROJECT_COLORS[0],
      deadline: addMonths(now, 5),
      phases: [
        { id: genId(), personId: team[0].id, type: 'scoping',       startMonth: addMonths(now, -1), endMonth: now,               intensityOverride: null },
        { id: genId(), personId: team[0].id, type: 'active-build',  startMonth: addMonths(now, 1),  endMonth: addMonths(now, 3), intensityOverride: null },
        { id: genId(), personId: team[2].id, type: 'active-build',  startMonth: addMonths(now, 1),  endMonth: addMonths(now, 4), intensityOverride: null },
        { id: genId(), personId: team[0].id, type: 'final-push',    startMonth: addMonths(now, 4),  endMonth: addMonths(now, 5), intensityOverride: null },
      ],
    },
    {
      id: genId(),
      name: 'API Migration',
      color: PROJECT_COLORS[1],
      deadline: addMonths(now, 3),
      phases: [
        { id: genId(), personId: team[1].id, type: 'active-build',  startMonth: addMonths(now, -2), endMonth: addMonths(now, 1), intensityOverride: null },
        { id: genId(), personId: team[3].id, type: 'active-build',  startMonth: addMonths(now, 0),  endMonth: addMonths(now, 2), intensityOverride: 60 },
        { id: genId(), personId: team[1].id, type: 'final-push',    startMonth: addMonths(now, 2),  endMonth: addMonths(now, 3), intensityOverride: null },
      ],
    },
    {
      id: genId(),
      name: 'Mobile App',
      color: PROJECT_COLORS[2],
      deadline: addMonths(now, 8),
      phases: [
        { id: genId(), personId: team[2].id, type: 'scoping',       startMonth: now,               endMonth: addMonths(now, 1), intensityOverride: null },
        { id: genId(), personId: team[2].id, type: 'waiting',       startMonth: addMonths(now, 2),  endMonth: addMonths(now, 3), intensityOverride: null },
        { id: genId(), personId: team[2].id, type: 'active-build',  startMonth: addMonths(now, 5),  endMonth: addMonths(now, 7), intensityOverride: null },
        { id: genId(), personId: team[2].id, type: 'handover',      startMonth: addMonths(now, 8),  endMonth: addMonths(now, 8), intensityOverride: null },
      ],
    },
    {
      id: genId(),
      name: 'Data Pipeline',
      color: PROJECT_COLORS[3],
      deadline: addMonths(now, 4),
      phases: [
        { id: genId(), personId: team[3].id, type: 'scoping',       startMonth: addMonths(now, -1), endMonth: now,               intensityOverride: null },
        { id: genId(), personId: team[1].id, type: 'active-build',  startMonth: addMonths(now, 2),  endMonth: addMonths(now, 3), intensityOverride: null },
        { id: genId(), personId: team[3].id, type: 'active-build',  startMonth: addMonths(now, 1),  endMonth: addMonths(now, 3), intensityOverride: null },
        { id: genId(), personId: team[3].id, type: 'final-push',    startMonth: addMonths(now, 4),  endMonth: addMonths(now, 4), intensityOverride: null },
      ],
    },
  ];

  return { team, projects };
}

// --- State shape ---

function getInitialState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed.team && parsed.projects) return parsed;
    }
  } catch { /* ignore */ }
  return createSampleData();
}

// --- Reducer ---

function reducer(state, action) {
  switch (action.type) {
    // Team
    case 'ADD_TEAM_MEMBER':
      return { ...state, team: [...state.team, action.payload] };
    case 'UPDATE_TEAM_MEMBER':
      return { ...state, team: state.team.map(m => m.id === action.payload.id ? { ...m, ...action.payload } : m) };
    case 'REMOVE_TEAM_MEMBER': {
      const id = action.payload;
      return {
        ...state,
        team: state.team.filter(m => m.id !== id),
        projects: state.projects.map(p => ({
          ...p,
          phases: p.phases.filter(ph => ph.personId !== id),
        })),
      };
    }

    // Projects
    case 'ADD_PROJECT':
      return { ...state, projects: [...state.projects, action.payload] };
    case 'UPDATE_PROJECT':
      return { ...state, projects: state.projects.map(p => p.id === action.payload.id ? { ...p, ...action.payload } : p) };
    case 'REMOVE_PROJECT':
      return { ...state, projects: state.projects.filter(p => p.id !== action.payload) };

    // Phases
    case 'ADD_PHASE': {
      const { projectId, phase } = action.payload;
      return {
        ...state,
        projects: state.projects.map(p =>
          p.id === projectId ? { ...p, phases: [...p.phases, phase] } : p
        ),
      };
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
      return {
        ...state,
        projects: state.projects.map(p =>
          p.id === projectId ? { ...p, phases: p.phases.filter(ph => ph.id !== phaseId) } : p
        ),
      };
    }

    // Bulk import
    case 'IMPORT_DATA':
      return { team: action.payload.team, projects: action.payload.projects };

    default:
      return state;
  }
}

// --- Context ---

const StoreContext = createContext(null);
const DispatchContext = createContext(null);

export function StoreProvider({ children }) {
  const [state, dispatch] = useReducer(reducer, null, getInitialState);

  // Persist to localStorage on every change
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch { /* quota exceeded, etc. */ }
  }, [state]);

  return (
    <StoreContext.Provider value={state}>
      <DispatchContext.Provider value={dispatch}>
        {children}
      </DispatchContext.Provider>
    </StoreContext.Provider>
  );
}

export function useStore() {
  return useContext(StoreContext);
}

export function useDispatch() {
  return useContext(DispatchContext);
}
