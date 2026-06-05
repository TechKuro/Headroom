export const PHASE_TYPES = {
  scoping:       { label: 'Scoping',              weight: 40,  short: 'SCP' },
  'active-build':{ label: 'Active Build',         weight: 100, short: 'BLD' },
  waiting:       { label: 'Waiting on 3rd Party',  weight: 10,  short: 'W8'  },
  'final-push':  { label: 'Final Push',           weight: 90,  short: 'FIN' },
  handover:      { label: 'Handover',             weight: 30,  short: 'H/O' },
};

// --- Initiative / commercial layer ---

// Default per-project initiative metadata. Applied as a safe fallback wherever
// a project predates the initiative layer (old localStorage docs, imports).
export const DEFAULT_INITIATIVE = {
  type: 'internal',       // 'internal' | 'client'
  status: 'backlog',      // 'done' | 'progress' | 'backlog'
  progress: 0,            // 0-100
  estimatedValue: 0,      // GBP
  description: '',
  chargeable: false,
  valueNote: '',
};

export const INITIATIVE_TYPES = {
  internal: { label: 'Internal' },
  client:   { label: 'Client' },
};

export const INITIATIVE_STATUSES = {
  done:     { label: 'Done' },
  progress: { label: 'In Progress' },
  backlog:  { label: 'Backlog' },
};

// --- Risk scoring ---
// Ordered low → critical. `order` drives sorting; `label` is the badge text.
export const RISK_LEVELS = {
  low:       { label: 'Low',      order: 0 },
  watch:     { label: 'Watch',    order: 1 },
  'at-risk': { label: 'At risk',  order: 2 },
  critical:  { label: 'Critical', order: 3 },
};

// App-level settings persisted with each document.
export const DEFAULT_SETTINGS = {
  blendedRate: 110,       // GBP / hour
};

// --- Half-day allocation model ---
// Work is allocated in half-day slots: each working day (Mon–Fri) has an AM and
// a PM half, and each half is HOURS_PER_HALF_DAY hours. Cost = allocated
// half-days × HOURS_PER_HALF_DAY × blendedRate.
export const HOURS_PER_HALF_DAY = 4;
export const HALVES = ['am', 'pm'];
export const WORKING_DAYS = [1, 2, 3, 4, 5]; // Date.getDay(): Mon–Fri
export const VIEW_DAYS = 10;                 // 2 working weeks shown at once

// Each person has 2 half-day slots per working day.
export const SLOTS_PER_DAY = 2;

// Ordered for stark contrast on consecutive picks: each color is ~opposite or
// well-separated in hue from its neighbour, so the first N projects look as
// distinct as possible.
export const PROJECT_COLORS = [
  '#ef4444', // red
  '#06b6d4', // cyan
  '#eab308', // yellow
  '#8b5cf6', // violet
  '#22c55e', // green
  '#ec4899', // pink
  '#3b82f6', // blue
  '#f97316', // orange
  '#14b8a6', // teal
  '#d946ef', // fuchsia
  '#84cc16', // lime
  '#6366f1', // indigo
  '#f43f5e', // rose
  '#0ea5e9', // sky
  '#a16207', // bronze
  '#475569', // slate
];

// Half-day grid layout (replaces the old month-column layout).
export const SLOT_WIDTH = 30;            // px per half-day (AM/PM) column
export const DAY_WIDTH = SLOT_WIDTH * 2; // a working day spans two halves
export const BAR_HEIGHT = 26;
export const BAR_GAP = 3;
export const ROW_PADDING = 8;

// Phase templates measured in working DAYS. QuickPlanModal lays each phase
// across that many consecutive working days and fills both halves.
export const PHASE_TEMPLATES = [
  {
    name: 'Standard',
    description: 'Scoping → Build → Final Push → Handover',
    phases: [
      { type: 'scoping', days: 2 },
      { type: 'active-build', days: 8 },
      { type: 'final-push', days: 3 },
      { type: 'handover', days: 2 },
    ],
  },
  {
    name: 'Short Sprint',
    description: 'Scoping → Build → Handover',
    phases: [
      { type: 'scoping', days: 1 },
      { type: 'active-build', days: 5 },
      { type: 'handover', days: 2 },
    ],
  },
  {
    name: 'Long Project',
    description: 'Scoping → Build → Waiting → Final Push → Handover',
    phases: [
      { type: 'scoping', days: 3 },
      { type: 'active-build', days: 12 },
      { type: 'waiting', days: 3 },
      { type: 'final-push', days: 4 },
      { type: 'handover', days: 2 },
    ],
  },
  {
    name: 'Support / Maintenance',
    description: 'Scoping → Handover (light touch)',
    phases: [
      { type: 'scoping', days: 2 },
      { type: 'handover', days: 3 },
    ],
  },
];
