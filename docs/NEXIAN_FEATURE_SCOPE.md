# Scope of works: Nexian Initiative features inside Headroom

## Purpose

Headroom should remain the resource/capacity planning application. The objective is not to replace the product or perform the Nexian visual redesign. The objective is to add the useful initiative-tracking capabilities from the Nexian brief into the existing Headroom codebase so the tool can answer commercial and operational questions as well as scheduling questions.

This scope is written as implementation guidance for Claude Code or another coding agent. Preserve existing Headroom functionality unless a task explicitly says otherwise.

## Non-goals

- Do not replace the current application shell with a new single-file prototype.
- Do not remove existing Timeline, Heatmap, Project, What-if, Export/Import, Documents, Availability Finder, undo/redo, or phase editing workflows.
- Do not apply the Nexian visual redesign in this scope. Keep the current Headroom visual language, CSS architecture, and component structure unless a small component-level style is needed for a new feature.
- Do not introduce network integrations yet. Microsoft Planner, HaloPSA, Microsoft Graph, and Microsoft Lists should be represented only as future integration seams.
- Do not migrate persisted user documents destructively. Any schema additions must have safe defaults and preserve old localStorage documents.

## Current Headroom baseline to preserve

Headroom currently has:

- A React/Vite app shell with a top header, document bar, view tabs, sidebar, and main content area.
- Three primary views: `timeline`, `heatmap`, and `project`.
- Team member CRUD and project CRUD from the sidebar.
- Project phases assigned to one or more people.
- Date-based timeline bars with drag editing.
- Project hold, leave/reduced capacity, what-if planning, quick planning, export/import, availability finder, and undo/redo.
- Local document persistence through `docManager`.

The new work should extend this baseline rather than replacing it.

## Desired end state

Headroom should gain an initiative/commercial layer on top of the current resource model:

- A project can optionally carry initiative metadata: type, status, progress, estimated value, description, chargeable flag, and value note.
- The app has a global blended hourly rate used to calculate labour cost and ROI.
- A new Overview view lets the CTO sort and filter initiatives by ROI, cost, progress, type, and status.
- A new Standup view gives person-by-person check-in context and generated prompt questions based on assigned work.
- A new People and cost view ranks engineers by estimated assigned hours and splits their work between client and internal initiatives.
- Existing Timeline and Heatmap continue to work, with only small data enrichments where useful.

## Data model changes

### Add initiative metadata to projects

Extend the existing project record with an optional `initiative` object:

```js
{
  id,
  name,
  color,
  deadline,
  phases,
  hold,
  initiative: {
    type: 'internal' | 'client',
    status: 'done' | 'progress' | 'backlog',
    progress: 0,
    estimatedValue: 0,
    description: '',
    chargeable: false,
    valueNote: ''
  }
}
```

Use safe defaults when `initiative` is absent:

```js
const DEFAULT_INITIATIVE = {
  type: 'internal',
  status: 'backlog',
  progress: 0,
  estimatedValue: 0,
  description: '',
  chargeable: false,
  valueNote: '',
};
```

### Add app-level rate state

Add a persisted blended hourly rate, defaulting to `45` GBP/hour. The rate should be part of saved document data so different documents can use different rates.

Suggested state field:

```js
settings: {
  blendedRate: 45
}
```

Migration rule: if `settings` or `settings.blendedRate` is missing, add the default during state migration.

### Labour-hour calculation

Headroom currently schedules phases by date range, people, and intensity. For initiative calculations, provide a helper that estimates hours from existing phase data.

Recommended first-pass formula:

```text
estimated phase hours = working days in phase range × 8 × intensity% × capacity share
```

Rules:

- Count weekdays only if Headroom already has a working-day helper; otherwise use calendar-day approximation initially and isolate it in one helper for later refinement.
- For multi-person phases, count the phase separately for each assigned person.
- If a phase has `intensityOverride`, use it. Otherwise use the current phase type intensity logic.
- If a project has no phases, estimated hours are `0`.
- Keep this calculation in a utility module so Overview, Standup, and People/cost use the same source of truth.

Suggested helper outputs:

```js
getProjectLabourSummary(project, team, options) => {
  totalHours,
  cost,
  assignedHoursByPerson: { [personId]: hours },
  clientHours,
  internalHours
}
```

### ROI calculation

```text
labour cost = estimated hours × blended rate
ROI = estimated value - labour cost
ROI % = labour cost > 0 ? ROI / labour cost × 100 : 0
```

ROI must always include a positive or negative sign in the UI so colour is not the only signal.

## New and changed views

### 1. Header: global rate control

Add a compact `Rate GBP` numeric input to the existing header.

Requirements:

- Default value: `45`.
- Range: `1` to `999`.
- Updates calculations immediately; no debounce required.
- Persists with the active document.
- Recalculates Overview, Standup, and People/cost.
- Does not affect Timeline and Heatmap layout calculations.

Implementation notes:

- Keep the existing header controls: document bar, view tabs, undo/redo, availability finder, timeline navigation, export/import.
- Place the rate control where it does not displace existing critical controls on smaller screens.

### 2. Overview view

Add a new `overview` tab to the app. This should become the default landing view only if it does not disrupt existing users; otherwise preserve `timeline` as the default and add Overview as the first tab.

Overview contents:

1. Metrics strip:
   - Total initiatives.
   - Total estimated hours.
   - Total labour cost.
   - Total estimated value.
   - Net ROI.
   - Average progress.

2. Filter controls:
   - All.
   - Status: Done, In progress, Backlog.
   - Type: Internal, Client.
   - Chargeable.

3. Sort controls:
   - ROI.
   - Labour cost.
   - Progress.
   - Estimated hours.
   - Name.

4. Initiative table columns:
   - Initiative: project name, initiative description, assigned people.
   - Status: type badge, status badge, chargeable badge if applicable.
   - Progress: progress bar and percentage.
   - Estimated hours.
   - Labour cost.
   - Estimated value and value note.
   - ROI and ROI percentage.

Data source:

- Use existing `projects` plus optional `project.initiative` metadata.
- Derived hours come from phase assignments.
- If metadata is missing, show default status/type/value safely rather than breaking.

### 3. Project editing: initiative metadata

Expose initiative fields in the existing project editing workflow.

Minimum viable implementation:

- Add an `Initiative details` section to the existing project editor/sidebar/modal area.
- Fields:
  - Type: internal/client.
  - Status: done/progress/backlog.
  - Progress: 0-100.
  - Estimated value: GBP integer.
  - Value note: short text.
  - Description: short text.
  - Chargeable: boolean.

Validation:

- Clamp progress to 0-100.
- Clamp estimated value to `>= 0`.
- Default missing text fields to empty strings.

### 4. Standup view

Add a `standup` tab.

Contents:

1. Engineer chip rail:
   - One chip per team member.
   - Selecting a chip changes the active engineer.

2. Engineer summary panel:
   - Full name.
   - Number of active assigned projects.
   - Their estimated hours.
   - Their estimated labour cost at current rate.
   - Their client hours.

3. Assigned project rows:
   - Project name.
   - Type/status/chargeable badges.
   - This engineer's estimated hours.
   - This engineer's labour cost.
   - Project progress.
   - Project ROI signal.

4. Prompt strip:
   - One button per assigned project or a generated prompt block for selected project.
   - Generate four deterministic standup questions, no AI/API call required:
     - What changed since last check-in?
     - What is the next concrete deliverable?
     - Is the remaining estimate still accurate?
     - Are there blockers, scope risk, or client expectation issues?

Empty state:

- If the selected person has no assigned projects, show a friendly empty state rather than a blank panel.

### 5. People and cost view

Add a `people-cost` or `people` tab.

Contents:

- Engineers ranked by total estimated assigned hours.
- Total hours and labour cost per engineer.
- Split between client and internal hours.
- Split bar showing client vs internal proportions.
- Raw hour labels for each segment.

Data source:

- Use derived assigned hours by person from project phases.
- Use `project.initiative.type` to classify hours as client/internal.
- If metadata is missing, default to internal.

### 6. Timeline enrichment

Do not rebuild the existing Timeline view.

Small enhancements only:

- Optionally surface initiative status/type in phase tooltips.
- Optionally use existing project colour as-is. Do not force the Nexian colour system onto the timeline in this scope.
- Keep current drag behaviour, current-month line, finder matches, what-if project overlay, and phase editing.

### 7. Heatmap enrichment

Do not rebuild the existing Heatmap view.

Small enhancements only:

- If feasible, add tooltip/metadata showing active projects contributing to a person-month load.
- Consider a team average row only if it fits the current heatmap implementation cleanly.
- Preserve current utilisation calculations and capacity override handling.

## Implementation sequence

### Milestone 1: schema and calculations

- Add `DEFAULT_INITIATIVE` and `DEFAULT_SETTINGS` constants.
- Update state migration to add missing `initiative` and `settings.blendedRate` defaults.
- Add reducer action for updating `settings.blendedRate`.
- Add reducer action or extend `UPDATE_PROJECT` for initiative metadata updates.
- Implement shared calculation helpers for project/person hours, labour cost, estimated value, and ROI.
- Add unit-testable pure functions where possible.

Acceptance criteria:

- Existing saved documents load without errors.
- New sample data includes initiative metadata for at least four projects.
- `npm run build` passes.

### Milestone 2: global rate control

- Add rate control to the existing header.
- Wire it to `settings.blendedRate`.
- Ensure rate changes are undoable if consistent with current state/history patterns, or document why settings changes are excluded from undo.
- Persist rate with document data.

Acceptance criteria:

- Changing rate updates any displayed derived cost/ROI values immediately.
- Existing header controls remain usable.

### Milestone 3: Overview view

- Add `overview` to the view tabs.
- Implement metrics strip, filters, sorting, and initiative table.
- Use semantic table markup with accessible labels.
- Use existing CSS style language rather than the Nexian redesign.

Acceptance criteria:

- User can filter by status/type/chargeable.
- User can sort by ROI/cost/progress/hours/name.
- Missing initiative metadata does not crash the table.

### Milestone 4: initiative editing

- Add UI to edit project initiative metadata.
- Persist edits in the project record.
- Validate/clamp numeric fields.

Acceptance criteria:

- A user can set a project as client/internal, mark chargeable, set progress, and set estimated value.
- Overview immediately reflects edits.

### Milestone 5: Standup view

- Add standup tab and components.
- Implement engineer selection and summary panel.
- Implement project rows and deterministic prompt generation.

Acceptance criteria:

- Selecting each engineer shows only their assigned work.
- Empty engineer state renders cleanly.
- Labour cost changes when rate changes.

### Milestone 6: People and cost view

- Add people/cost tab and components.
- Rank engineers by total derived hours.
- Show client/internal split.

Acceptance criteria:

- Ranking changes when phase assignments change.
- Cost changes when rate changes.
- Client/internal split follows initiative type metadata.

### Milestone 7: targeted timeline and heatmap enrichments

- Add initiative metadata to relevant tooltips or detail panels.
- Add project-contribution tooltip or team average row to Heatmap only if low-risk.

Acceptance criteria:

- Existing timeline drag/edit behaviour still works.
- Existing heatmap utilisation calculations still match pre-change behaviour for documents without initiative metadata.

## Suggested file ownership

Claude Code should prefer small, isolated changes. Suggested likely files:

- `src/store.jsx`: schema migration, settings defaults, reducer actions.
- `src/utils.js`: shared initiative/hour/cost/ROI helper functions.
- `src/App.jsx`: view routing, header rate control, new tabs.
- `src/components/OverviewView.jsx`: new Overview view.
- `src/components/StandupView.jsx`: new Standup view.
- `src/components/PeopleCostView.jsx`: new People/cost view.
- `src/components/Sidebar.jsx` or project editing component: initiative metadata editor.
- `src/App.css`: incremental styles for the new views using current Headroom theme.
- `docs/USER_GUIDE.md`: update after the features exist.

## Risks and decisions to confirm

1. How should estimated hours be calculated exactly from date range and phase intensity?
2. Should Overview become the default view, or should Timeline remain the landing view?
3. Should blended rate changes participate in undo/redo history?
4. Should initiative metadata be edited in Sidebar, ProjectView, or a new modal?
5. Should current local documents be auto-enriched with defaults silently, or should migration be versioned in `docManager`?
6. Should chargeable be independent from `type === 'client'`, or should all chargeable work be client work by rule?

## Definition of done

- Existing Headroom scheduling workflows still work.
- Existing saved documents load safely.
- New initiative metadata can be edited and persisted.
- Overview, Standup, and People/cost views are available.
- Rate changes recalculate cost and ROI immediately.
- Build passes with `npm run build`.
- No broad visual redesign has been applied.
