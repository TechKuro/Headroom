export const PHASE_TYPES = {
  scoping:       { label: 'Scoping',              weight: 40,  short: 'SCP' },
  'active-build':{ label: 'Active Build',         weight: 100, short: 'BLD' },
  waiting:       { label: 'Waiting on 3rd Party',  weight: 10,  short: 'W8'  },
  'final-push':  { label: 'Final Push',           weight: 90,  short: 'FIN' },
  handover:      { label: 'Handover',             weight: 30,  short: 'H/O' },
};

export const PROJECT_COLORS = [
  '#ef4444', // red
  '#f97316', // orange
  '#eab308', // yellow
  '#84cc16', // lime
  '#22c55e', // green
  '#10b981', // emerald
  '#14b8a6', // teal
  '#06b6d4', // cyan
  '#0ea5e9', // sky
  '#3b82f6', // blue
  '#6366f1', // indigo
  '#8b5cf6', // violet
  '#d946ef', // fuchsia
  '#ec4899', // pink
  '#f43f5e', // rose
  '#78716c', // stone
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
