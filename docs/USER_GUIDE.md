# Headroom — Capacity Planner User Guide

## What is Headroom?

Headroom is a resource capacity planning tool for small engineering teams (2-5 people) juggling multiple projects. It answers one key question: **"If a new project lands next week, who can take it on and when?"**

It is **not** a task tracker. It sits above your existing tools (Halo PSA, Jira, etc.) and gives you a high-level view of who is doing what, and where the room is.

---

## Getting Started

### Running the app

Double-click `start.bat` in the project folder, or run manually:

```
cd Headroom
npm run dev
```

The app opens at `http://localhost:5173` in your browser.

### First run

The app comes pre-loaded with a "Sample Plan" containing 4 team members and 4 projects so you can explore immediately. All changes are automatically saved to your browser's localStorage.

To start a fresh plan, use the document menu (see below).

---

## Core Concepts

### Phases, not tasks

Projects don't consume engineer time evenly. A developer might be "on" a project for 6 months but only genuinely loaded for 3 of them. Headroom models projects as **broad phases**, each with a different intensity:

| Phase | Default Load | Description |
|---|---|---|
| **Scoping** | 40% | Discovery, requirements, planning |
| **Active Build** | 100% | Heads-down development |
| **Waiting on 3rd Party** | 10% | Blocked on external dependency — engineer is mostly free |
| **Final Push** | 90% | Pre-deadline crunch, testing, bug fixes |
| **Handover** | 30% | Documentation, client training, go-live support |

These loads **stack** across projects. If someone has two "Active Build" phases in the same month, they're at 200% — that's a problem. One "Active Build" + two "Waiting" = 120% — tight but manageable.

### Monthly resolution

Everything operates at month granularity. No hours, no days, no sprints. This is deliberate — it should take **seconds** to update, not minutes.

---

## The Interface

### Header

| Element | What it does |
|---|---|
| **Hamburger menu** | Show/hide the sidebar |
| **Document menu** | Click the plan name to open: New, Save As Copy, Load, Rename, Delete, Export to PDF |
| **Timeline / Heatmap / Project** tabs | Switch between the three main views |
| **Undo / Redo** buttons | Undo or redo any change (also Ctrl+Z / Ctrl+Y) |
| **Search icon** | Toggle the Availability Finder |
| **Arrow buttons / Today** | Scroll the timeline earlier/later, or jump to the current month |
| **Export / Import** buttons | Download or upload your data as JSON |

### Sidebar

The left panel has three sections:

#### Team
- Lists all team members
- **Add**: Type a name and press Enter or click +
- **Rename**: Double-click a name to edit inline
- **Leave/Capacity**: Click the calendar icon to set leave or reduced hours
- **Remove**: Click x (confirms first, warns about cascade-deleted phases)
- An **"L"** badge appears next to people with leave/capacity overrides

#### Projects
- Lists all projects with colour dots
- **Add**: Type a name and press Enter or click +
- **Click** a project to expand its details:
  - Set deadline (month picker)
  - Change colour
  - View and manage phases
  - **Quick Plan**: Apply a phase template to rapidly set up a new project
  - **+ Add**: Add a single phase
  - Click any phase to edit it
- **Rename**: Double-click the project name
- **Remove**: Click x (confirms first)

#### What-If Mode
- Click "What-If Mode" to start a hypothetical project
- Details are in the What-If section below

---

## Views

### Timeline View

The primary view. Team members down the left, months across the top. Phase bars show which projects each person is on.

**Reading the timeline:**
- Each coloured bar = one phase of one project
- Bar label shows project name + phase type abbreviation (SCP, BLD, W8, FIN, H/O)
- Bar opacity reflects intensity (brighter = higher load)
- Dashed bars = what-if project phases (not yet committed)
- Dashed vertical lines = project deadlines
- Solid vertical line = current month
- Load badge next to each person's name shows their current month's total load

**Interacting:**
- **Click an empty cell** → opens the phase modal to add a new phase for that person/month
- **Click a phase bar** → opens the phase modal to edit it
- **Drag the left edge** of a bar → extend/shrink the start date
- **Drag the right edge** of a bar → extend/shrink the end date
- **Drag the middle** of a bar → slide the whole phase to a new date range
- Green-highlighted cells = available slots (when Availability Finder is active)

### Heatmap View

Same layout, but cells show the **total load percentage** per person per month. Colour-coded:

| Colour | Meaning |
|---|---|
| Dark/empty | 0% — no work assigned |
| Green | 1-60% — light load |
| Yellow/amber | 61-80% — moderate load |
| Orange | 81-100% — at capacity |
| Red (pulsing) | Over 100% — overcommitted |

When a person has **reduced capacity** (leave/part-time), the cell shows their load relative to their available capacity. For example, 40% load with 50% capacity shows as the cell coloured for 80% effective utilisation. A small "/50" indicator appears next to the load value.

**What-if distinction**: Cells that include what-if phase load show a dashed amber border and a "+N%" delta indicator.

**Team Average row**: Bottom row shows the average load across all team members.

**Utilisation Summary**: Below the heatmap grid, a bar-chart summary shows:
- Average load per person across the visible months
- Peak load
- Number of "light" months (under 60%) — this is available capacity

### Project View

A focused view of a single project. Select a project from the dropdown.

- Shows all phases for that project, grouped by team member
- Uninvolved team members appear dimmed at the bottom (click their cells to assign them)
- Deadline marker appears as a dashed vertical line
- Drag to resize/move works the same as Timeline View

---

## Key Features

### Adding a Phase

There are three ways:
1. **Click an empty cell** on the timeline — pre-fills person and month
2. **Click "+ Add"** in the project detail panel in the sidebar
3. **Use Quick Plan** to apply a template (see below)

The Phase Modal lets you set:
- Project (when adding, not editing)
- Team member
- Phase type (with default intensity shown)
- Start and end month
- Intensity override (check the box, then use the slider)

**Overcommitment warnings** appear in red if the phase would push someone over 100% in any month.

### Editing a Phase

Click any phase bar on the timeline, or click a phase in the sidebar project detail panel. You can change all fields and delete the phase.

### Drag to Resize / Move

On the timeline and project views:
- **Left edge**: Hover shows a resize cursor. Drag left/right to change the start month.
- **Right edge**: Same, but changes the end month.
- **Middle**: Grab and drag to slide the entire phase to new dates (duration stays the same).

Changes save automatically on mouse release. Use **Ctrl+Z** to undo if you make a mistake.

### Quick Plan (Phase Templates)

When you expand a project in the sidebar, click **"Quick Plan"** to apply a predefined template:

| Template | Phases |
|---|---|
| Standard | Scoping (1mo) → Build (3mo) → Final Push (1mo) → Handover (1mo) |
| Short Sprint | Scoping (1mo) → Build (2mo) → Handover (1mo) |
| Long Project | Scoping (2mo) → Build (5mo) → Waiting (1mo) → Final Push (2mo) → Handover (1mo) |
| Support/Maintenance | Scoping (1mo) → Handover (2mo) |

Choose a template, pick a default assignee and start month, then preview the phases before applying. You can edit individual phases afterwards (reassign people, adjust dates, etc.).

### Leave / Reduced Capacity

Click the calendar icon next to a team member's name to open the Leave Modal.

- Set a date range and an available capacity percentage
- **0%** = fully off (holiday, sick leave)
- **50%** = half-time (part-time, other commitments)
- **75%** = mostly available with some reduction
- Existing overrides show as removable chips
- "Clear all" removes all overrides for that person

This affects the heatmap's colour coding. A person with 50% capacity who has 50% load will show as orange (100% effective utilisation), not green.

### What-If Mode

Use this to evaluate a hypothetical new project before committing.

1. Click **"What-If Mode"** in the sidebar (or the banner appears if already active)
2. Name your project, set a deadline and colour in the amber banner
3. Add phases to it (they appear with dashed borders on the timeline)
4. Watch the heatmap update — what-if load shows as "+N%" with amber borders
5. **Commit** to add the project permanently, or **Discard** to throw it away

The Availability Finder also accounts for what-if phases when active.

### Availability Finder

Click the search icon in the header to open the finder bar.

- Select a **phase type** (e.g. Active Build)
- Set a **duration** (e.g. 3 months)
- The tool highlights all person/month slots on the timeline and heatmap where that phase could fit without exceeding 100% capacity

This directly answers: *"I need someone for a 3-month Active Build — who's free and when?"*

### Undo / Redo

Every action (adding, editing, removing phases/projects/members, applying templates, setting leave) is undoable.

- **Ctrl+Z** (or Cmd+Z on Mac) to undo
- **Ctrl+Y** (or Cmd+Shift+Z on Mac) to redo
- Or click the arrow buttons in the header
- History stores up to 50 steps

### Document Management (Plans)

The document menu is in the header — click the plan name to open it.

- **Rename**: Edit the plan name inline
- **New Plan**: Creates a blank plan (empty team, no projects). Your current plan is saved automatically.
- **Save As Copy**: Duplicates the current plan under a new name. Useful for creating "what if we hired?" variations.
- **Load**: Switch to a different saved plan. All your plans are listed with their last modified date.
- **Delete**: Remove a plan permanently (with confirmation).
- **Export to PDF**: Opens the browser's print dialog. Choose "Save as PDF" to create a file. The print layout uses a clean white background with landscape orientation.

All plans auto-save to localStorage as you work. Switching between plans resets the undo history.

### Export / Import (JSON)

- **Export**: Downloads a JSON file with all your data (team, projects, capacity overrides)
- **Import**: Loads a JSON file, replacing the current plan's data

Use this for backups, sharing with colleagues, or migrating between machines.

---

## Data Model

All data is stored in your browser's localStorage. There is no server, no account, no cloud sync. Your data stays on your machine.

**Team members**: Name and optional role. Removing a team member deletes all their assigned phases.

**Projects**: Name, colour, contract deadline, and a list of phases.

**Phases**: Assigned to one person, with a type, start/end month, and optional intensity override.

**Capacity overrides**: Per-person, per-month available capacity (default 100%). Used for leave/reduced hours.

### Resetting

To reset to sample data: clear localStorage for `localhost:5173` in your browser's developer tools, then refresh.

---

## Keyboard Shortcuts

| Shortcut | Action |
|---|---|
| **Ctrl+Z** / **Cmd+Z** | Undo |
| **Ctrl+Y** / **Cmd+Shift+Z** | Redo |

---

## Tips for Effective Use

1. **Update weekly, not daily.** Spend 2 minutes on Monday morning dragging bars and checking the heatmap. That's enough.

2. **Start with deadlines.** Enter project deadlines first, then work backwards to place phases. The deadline markers make it obvious when things don't fit.

3. **Use the heatmap to spot problems.** Red cells = overcommitment. Multiple months of red for one person = burnout risk. Act before it happens.

4. **What-If before committing.** When a new project comes in, use What-If Mode to see where it fits. Don't just assign it — check the capacity impact first.

5. **Quick Plan then adjust.** For new projects, Quick Plan gets the structure in place fast. Then drag bars and reassign people as needed.

6. **Leave matters.** Mark holidays and part-time weeks. A 50% capacity person with 60% load is overcommitted — the heatmap will show this.

7. **Export regularly.** Until server-side persistence is added, export your data as JSON backup. Do it after significant planning sessions.
