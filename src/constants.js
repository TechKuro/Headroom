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
  blendedRate: 45,        // GBP / hour
};

// Approximate working hours in a calendar month — a phase running at 100%
// intensity for a full month is treated as this many person-hours. Kept as a
// single constant so the labour estimate can be refined in one place later.
export const HOURS_PER_MONTH = 160;

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

export const CAPACITY_THRESHOLDS = {
  light:  60,   // green
  moderate: 80, // amber
  heavy: 100,   // red
};

export const MONTH_WIDTH = 120;
export const BAR_HEIGHT = 26;
export const BAR_GAP = 3;
export const ROW_PADDING = 8;

export const PHASE_TEMPLATES = [
  {
    name: 'Standard',
    description: 'Scoping → Build → Final Push → Handover',
    phases: [
      { type: 'scoping', months: 1 },
      { type: 'active-build', months: 3 },
      { type: 'final-push', months: 1 },
      { type: 'handover', months: 1 },
    ],
  },
  {
    name: 'Short Sprint',
    description: 'Scoping → Build → Handover',
    phases: [
      { type: 'scoping', months: 1 },
      { type: 'active-build', months: 2 },
      { type: 'handover', months: 1 },
    ],
  },
  {
    name: 'Long Project',
    description: 'Scoping → Build → Waiting → Final Push → Handover',
    phases: [
      { type: 'scoping', months: 2 },
      { type: 'active-build', months: 5 },
      { type: 'waiting', months: 1 },
      { type: 'final-push', months: 2 },
      { type: 'handover', months: 1 },
    ],
  },
  {
    name: 'Support / Maintenance',
    description: 'Scoping → Handover (light touch)',
    phases: [
      { type: 'scoping', months: 1 },
      { type: 'handover', months: 2 },
    ],
  },
];
