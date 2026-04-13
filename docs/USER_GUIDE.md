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

The app opens at `http://localhost:5173` in your browser. Keep the terminal window open while using the app.

### First run

The app comes pre-loaded with a "Sample Plan" containing 4 team members and 4 projects so you can explore immediately. All changes are automatically saved to your browser's localStorage.

To start a fresh plan, use the document menu (see below).

### Quick-start: setting up your real plan

1. **Create a new plan**: Click the plan name in the header (e.g. "Sample Plan"), then click **New Plan**. Name it something like "Q3 2026".
2. **Add your team**: In the sidebar under "Team", type each person's name and press Enter.
3. **Add your projects**: Under "Projects", type each project name and press Enter.
4. **Set deadlines**: Click a project to expand it, then set its contract deadline using the month picker.
5. **Add phases**: Either click **Quick Plan** to apply a template, or click **+ Add** to create phases one by one. For each phase, pick the person, phase type, and date range.
6. **Check the heatmap**: Switch to the Heatmap tab. Red cells mean someone is overcommitted — adjust phases until the plan works.

The whole setup should take under 10 minutes for a typical team. After that, weekly updates take seconds.

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

### Capacity vs load

**Load** is how much work is assigned to a person in a given month (the sum of all their phase intensities).

**Capacity** is how much time they have available. Default is 100%. If someone is on holiday for half a month, their capacity drops to 50%. A person with 60% load and 50% capacity is effectively at 120% — overcommitted.

---

## The Interface

### Header bar

From left to right:

| Element | What it does |
|---|---|
| **Hamburger menu** | Show/hide the sidebar |
| **Headroom** | App name |
| **Document menu** | Click the plan name to open: New, Save As Copy, Load, Rename, Delete, Export to PDF |
| **Timeline / Heatmap / Project** tabs | Switch between the three main views |
| **Undo / Redo** arrows | Undo or redo any change (also Ctrl+Z / Ctrl+Y) |
| **Search icon** | Toggle the Availability Finder |
| **Arrow buttons / Today** | Scroll the timeline earlier/later, or jump to the current month |
| **Down-arrow / Up-arrow** icons | Export / Import JSON data |

### Sidebar (left panel)

Three collapsible sections:

#### Team
- Lists all team members
- **Add**: Type a name in the text box and press Enter (or click +)
- **Rename**: Double-click a name to edit it inline. Press Enter or click away to save.
- **Leave/Capacity**: Click the calendar icon next to a name to set leave or reduced hours
- **Remove**: Click the x button (confirms first; warns you how many phases will be deleted)
- An **"L"** badge appears next to people with leave or capacity overrides set

#### Projects
- Lists all projects with a colour dot
- **Add**: Type a name and press Enter (or click +)
- **Expand**: Click a project to reveal its details:
  - **Deadline**: Set the contract end date via the month picker
  - **Colour**: Pick from 10 colour swatches
  - **Phases list**: Shows all phases with their type, person, dates, and any intensity override
  - **Quick Plan**: Apply a pre-built phase template (see Quick Plan section)
  - **+ Add**: Add a single new phase
  - Click any phase row to open it for editing
  - **View project arrow**: Switch to the Project View filtered to this project
- **Rename**: Double-click the project name
- **Remove**: Click the x button (confirms first, shows phase count)

#### What-If Mode
- Click "What-If Mode" to start a hypothetical project
- See the What-If section below for full details

---

## Views

### Timeline View

The primary view. Team members down the left, months across the top, phase bars showing who is doing what.

**Reading the timeline:**

- Each **coloured bar** represents one phase of one project
- The bar label shows the **project name** and a **phase abbreviation**: SCP (Scoping), BLD (Active Build), W8 (Waiting), FIN (Final Push), H/O (Handover)
- Bar **opacity** reflects intensity — brighter bars = higher load
- **Dashed bars** with diagonal stripes = what-if project phases (not yet committed)
- **Dashed vertical lines** = project deadlines (colour-matched, with project name label)
- **Solid blue vertical line** = current month
- **Load badge** next to each person's name shows their total load for the current month (green/amber/red)

**Interacting with the timeline:**

| Action | Result |
|---|---|
| Click an **empty cell** | Opens the Add Phase modal, pre-filled with that person and month |
| Click a **phase bar** | Opens the Edit Phase modal |
| Drag the **left edge** of a bar | Extend or shrink the start date |
| Drag the **right edge** of a bar | Extend or shrink the end date |
| Drag the **middle** of a bar | Slide the entire phase to new dates (duration stays the same) |

Green-highlighted cells appear when the Availability Finder is active, showing where capacity exists.

### Heatmap View

Same layout as the timeline, but each cell shows the **total load percentage** per person per month. This is the "where's the room?" view.

**Colour coding:**

| Colour | Load Range | Meaning |
|---|---|---|
| Dark/empty | 0% | No work assigned |
| Green | 1–60% | Light load — room for more |
| Yellow/amber | 61–80% | Moderate load |
| Orange | 81–100% | At capacity |
| Red (pulsing glow) | Over 100% | Overcommitted — action needed |

**Additional indicators:**

- **"/50" after the load value**: This person has reduced capacity that month (e.g. leave). The number shows their available capacity. The cell colour reflects *effective* utilisation — 40% load with 50% capacity is coloured as 80%.
- **Dashed amber border + "+N%"**: The cell includes load from a what-if project. The "+N%" shows how much the what-if adds.
- **Coloured dots** below the percentage: Each dot represents a project active for that person that month. Hover to see the project name.
- **Team Average row**: Bottom row shows the average load across all team members for each month.

**Utilisation Summary** (below the grid):

A horizontal bar chart showing each person's average load, peak load, and number of "light" months (under 60%) across the visible date range. This answers "who has been consistently overloaded?" at a glance.

**Print legend**: When exported to PDF, a colour legend is included at the bottom explaining what each colour means.

### Project View

A focused view of a **single project**. Use the dropdown at the top to select which project to view.

- Shows all phases for that project, grouped by team member
- **Involved people** appear at the top with their phase bars
- **Uninvolved people** appear dimmed below — click their cells to assign them to a phase
- The project's **deadline** appears as a dashed vertical line
- All drag-to-resize/move interactions work the same as Timeline View
- Click **+ Add Phase** to add a new phase to this project

---

## Key Features

### Adding a Phase

There are three ways to add a phase:

1. **Click an empty cell** on the timeline or project view — opens the modal pre-filled with that person and month
2. **Click "+ Add"** in the sidebar project detail panel — opens the modal for that project
3. **Use Quick Plan** to apply a template that generates multiple phases at once

The **Phase Modal** lets you set:

- **Project** (when adding a new phase; locked when editing)
- **Team member** to assign the phase to
- **Phase type** — each type has a default intensity (shown in parentheses)
- **Start month** and **end month**
- **Intensity override** — check the box to override the default load percentage with a custom value using the slider (0–150%)

**Overcommitment warnings** appear in red at the bottom of the modal if the phase would push the assigned person over 100% in any month. The warning shows the specific months and projected load.

### Editing a Phase

Click any phase bar on the timeline, or click a phase row in the sidebar project panel. The Edit Phase modal shows the same fields as Add, plus a **Delete** button (with confirmation).

### Drag to Resize / Move

The fastest way to adjust phase timing:

- **Left edge**: Hover over the left edge of a bar — the cursor changes to a resize arrow. Drag left or right to change the start date.
- **Right edge**: Same behaviour, but changes the end date.
- **Middle**: Hover over the bar label — the cursor changes to a grab hand. Drag to slide the entire phase to new dates. The duration stays the same.

Changes are saved instantly on mouse release. Made a mistake? Press **Ctrl+Z** to undo.

### Quick Plan (Phase Templates)

When you expand a project in the sidebar, click **"Quick Plan"** to apply a predefined phase sequence:

| Template | Sequence | Total Duration |
|---|---|---|
| **Standard** | Scoping (1mo) → Build (3mo) → Final Push (1mo) → Handover (1mo) | 6 months |
| **Short Sprint** | Scoping (1mo) → Build (2mo) → Handover (1mo) | 4 months |
| **Long Project** | Scoping (2mo) → Build (5mo) → Waiting (1mo) → Final Push (2mo) → Handover (1mo) | 11 months |
| **Support/Maintenance** | Scoping (1mo) → Handover (2mo) | 3 months |

In the Quick Plan modal:
1. Pick a template — the description shows the phase flow
2. Choose a **default assignee** — all phases will be assigned to this person initially
3. Set a **start month** — phases are laid out sequentially from this date
4. Review the **preview** showing exact dates and durations
5. Click **Apply** to create all phases at once

After applying, you can edit individual phases to reassign them to different people, adjust dates, or tweak intensity.

### Putting a Project on Hold

When a project is paused (e.g. waiting on client, budget approval, or deprioritised), you can put it on hold to free up the engineer's capacity without deleting any phases.

**To hold a project:**
1. In the sidebar, find the project and click the **pause icon** (two vertical bars)
2. Choose a hold duration:

| Duration | Effect |
|---|---|
| **1 week** | 25% load reduction for the current month |
| **2 weeks** | 50% load reduction for the current month |
| **1 month** | 100% load removed for the current month |
| **2 months** | 100% load removed for this month and next |
| **Until resumed** | 100% load removed indefinitely until you manually resume |

**While a project is on hold:**
- A **"HELD"** badge appears next to the project name in the sidebar
- The project name is struck through and dimmed
- Phase bars on the timeline turn **grey with a striped pattern**
- The held project's load is **reduced or removed** from the heatmap, freeing up capacity
- All phases remain intact — nothing is deleted

**To resume a project:**
- Click the **play icon** (triangle) next to the held project — it immediately returns to normal

**Why sub-month holds?** Since the app runs at monthly resolution, a "1 week hold" translates to a 25% reduction in that project's load for the current month. This is useful when a project is only briefly paused — the engineer is mostly free but not entirely.

### Leave / Reduced Capacity

Click the **calendar icon** next to a team member's name in the sidebar to open the Leave Modal.

- Set a **date range** (from/to months)
- Set **available capacity** as a percentage:
  - **0%** = completely off (holiday, sick leave, parental leave)
  - **25%** = one day a week
  - **50%** = half-time
  - **75%** = mostly available with some reduction
- Use the **preset buttons** for quick selection, or the **slider** for fine control
- **Existing overrides** appear as removable chips — click the x on any chip to remove it
- **Clear all** removes every override for that person

This directly affects the heatmap. A person with 50% capacity who has 50% load will show as **orange** (100% effective utilisation), not green. This prevents the common mistake of assuming someone is free just because their project load is low, when they're actually on half-time.

### What-If Mode

Use this to evaluate the impact of a hypothetical new project before committing to it.

**Workflow:**

1. Click **"What-If Mode"** in the sidebar
2. An amber banner appears at the top of the screen
3. **Name** your hypothetical project, set a **deadline**, and pick a **colour** in the banner
4. **Add phases** to it — click empty cells on the timeline, or use the Phase Modal (the what-if project appears in the project dropdown)
5. What-if phases appear with **dashed borders and diagonal stripes** on the timeline
6. The heatmap updates live — what-if load shows as **"+N%"** with **amber dashed borders**
7. The Availability Finder accounts for what-if phases
8. When you're satisfied: click **Commit Project** to add it permanently
9. Changed your mind? Click **Discard** to throw it away (confirms if phases exist)

### Availability Finder

Click the **search icon** (magnifying glass) in the header to open the finder bar.

- Select a **phase type** (e.g. Active Build at 100%)
- Set a **duration** using the +/- buttons (e.g. 3 months)
- The finder instantly highlights all person/month slots where that phase could fit without exceeding 100% capacity
- Highlighted slots appear as **green-bordered cells** on both the timeline and heatmap
- A summary message shows "X of Y available"

This directly answers: *"I need someone for a 3-month Active Build — who's free and when?"*

Click the search icon again or the X button to close the finder and clear highlights.

### Undo / Redo

Every action is undoable — adding, editing, removing phases/projects/team members, applying templates, setting leave, importing data.

- **Ctrl+Z** (Cmd+Z on Mac) to undo
- **Ctrl+Y** or **Ctrl+Shift+Z** (Cmd+Shift+Z on Mac) to redo
- Or click the **curved arrow buttons** in the header
- History stores up to **50 steps**
- Switching documents or loading a saved plan resets the undo history

### Document Management (Plans)

Click the **plan name** in the header to open the document menu.

| Action | What it does |
|---|---|
| **Rename** | Edit the plan name inline — press Enter to save |
| **New Plan** | Creates a blank plan (empty team, no projects). Your current plan is saved automatically before switching. |
| **Save As Copy** | Duplicates the current plan under a new name. Useful for "what if we hired?" variations or quarterly snapshots. |
| **Load** (listed plans) | Switch to a different saved plan. All plans are listed with their last-modified date. |
| **Delete** (trash icon) | Remove a saved plan permanently (with confirmation). |
| **Export to PDF** | Opens your browser's Print dialog. Choose "Save as PDF" to save a file. |
| **Delete This Plan** | Remove the currently active plan. |

All plans **auto-save** to localStorage as you work. You can have as many plans as you like — "Q3 2026 Plan", "Scenario A", "Pre-hire plan", etc.

### Export / Import (JSON)

The **down-arrow** and **up-arrow** buttons in the header handle JSON backup:

- **Export** (down arrow): Downloads a `.json` file containing all data for the current plan (team, projects, phases, capacity overrides)
- **Import** (up arrow): Loads a `.json` file, replacing the current plan's data. Validates the file format before applying.

Use this for:
- Backing up your data (especially before clearing browser storage)
- Sharing a plan with a colleague (they import your JSON file)
- Moving data between machines

### Export to PDF

From the document menu, click **Export to PDF**. This opens your browser's print dialog.

- Select **"Save as PDF"** as the destination
- The layout automatically switches to **landscape orientation** with a **white background**
- The sidebar, buttons, and interactive elements are hidden
- The current view (timeline or heatmap) is printed with the plan name as a title
- On the heatmap, a **colour legend** is included explaining what green/amber/orange/red mean

For best results, print the **Heatmap View** — it's the most useful thing to share in meetings since it shows the capacity picture at a glance.

---

## Keyboard Shortcuts

| Shortcut | Action |
|---|---|
| **Ctrl+Z** / **Cmd+Z** | Undo |
| **Ctrl+Y** / **Ctrl+Shift+Z** / **Cmd+Shift+Z** | Redo |
| **Ctrl+S** / **Cmd+S** | Shows a "Saved" confirmation (auto-save is always active) |

---

## Common Workflows

### "A new project just landed — who can take it?"

1. Open the **Availability Finder** (search icon in header)
2. Set the phase type to **Active Build** and the expected duration
3. Look at the highlighted slots — these are people with enough room
4. Switch to **What-If Mode** and add the project with tentative phases
5. Check the heatmap — is anyone pushed into the red?
6. Adjust assignments until it works, then **Commit** the project

### "Someone is going on holiday next month"

1. In the sidebar, click the **calendar icon** next to their name
2. Set the date range and capacity (0% for full leave, 50% for half-time)
3. Switch to the **Heatmap View** — check if any months are now red
4. If overcommitted: drag their phase bars to shift work to other months, or reassign phases to colleagues

### "A project is on hold — client went quiet"

1. Click the **pause icon** next to the project in the sidebar
2. Choose **"Until resumed"** (or a specific duration if you know when it'll restart)
3. The heatmap immediately shows the freed capacity — that engineer now has room
4. If you want to reallocate that time, add phases for other projects in the freed months
5. When the client comes back: click the **play icon** to resume — all phases come back as they were

### "Client moved a deadline forward by 2 months"

1. Click the project in the sidebar to expand it
2. Update the **deadline** in the month picker
3. Switch to **Project View** for that project
4. **Drag phase bars** to compress the schedule — drag right edges left to shorten phases
5. Check the **Heatmap** — if the compressed schedule overloads someone, consider reassigning phases or adding team members

### "Quarterly planning — lay out next quarter"

1. Create a **new plan** via the document menu (or Save As Copy to branch from the current one)
2. Add any new projects using **Quick Plan** templates
3. Assign people and adjust dates
4. Use the **Heatmap** to balance load across the team
5. Use the **Utilisation Summary** to check no one is consistently over 80%
6. **Export to PDF** and share in the planning meeting

### "What if we hired another engineer?"

1. **Save As Copy** your current plan (name it "With new hire" or similar)
2. Add the new team member
3. Reassign some phases to them
4. Compare the heatmaps between the two plans to see the impact
5. Export both to PDF for the business case

---

## Data Storage

All data is stored in your **browser's localStorage**. There is no server, no account, no cloud sync. Your data stays on your machine.

Each named plan is stored separately. The data includes:

- **Team members**: Name and optional role
- **Projects**: Name, colour, contract deadline, and a list of phases
- **Phases**: Assigned person, type, start/end month, and optional intensity override
- **Capacity overrides**: Per-person, per-month available capacity (default 100%)

### Important notes about storage

- **localStorage has a size limit** (typically 5-10MB per site). For normal use this is more than enough, but if you hit the limit, the app will show an error toast. Export your data as JSON backup if this happens.
- **Clearing browser data will delete all plans.** Use JSON export as a backup.
- **Different browsers have separate storage.** A plan saved in Chrome won't appear in Firefox.
- **Incognito/private mode** may not persist data between sessions.

### Resetting

To reset to sample data: clear localStorage for `localhost:5173` in your browser's developer tools (F12 → Application → Local Storage → right-click → Clear), then refresh the page.

---

## Troubleshooting

**The app won't start / shows a blank page**
- Make sure the terminal running `npm run dev` is still open
- Check the terminal for error messages
- Try `http://localhost:5173` directly in your browser
- If the port is in use, close other Vite instances or change the port in `start.bat`

**My data disappeared**
- Check you haven't switched to a different plan (click the plan name in the header to see all saved plans)
- Check you haven't cleared browser data recently
- If you have a JSON export, use the import button to restore it

**Phase bars look wrong or overlap oddly**
- Try scrolling the timeline (use the arrow buttons in the header) — the bar might extend outside the visible range
- Check the phase's start/end dates in the Edit Phase modal

**The heatmap shows red but I don't think the person is overloaded**
- Check if they have reduced capacity set (look for the "L" badge and "/50" indicators)
- Hover over the cell to see the tooltip breakdown of which projects contribute to the load

**Export to PDF looks wrong**
- Make sure you're using Chrome or Edge (best print CSS support)
- In the print dialog, set the layout to **Landscape** if it isn't already
- Uncheck "Headers and footers" in the print options for a cleaner result
- For the best output, print the Heatmap View rather than the Timeline View

**Ctrl+Z doesn't work**
- Make sure the browser window is focused (click somewhere in the app first)
- Undo history resets when you switch between saved plans
- History stores a maximum of 50 steps

---

## Tips for Effective Use

1. **Update weekly, not daily.** Spend 2 minutes on Monday morning dragging bars and checking the heatmap. That's enough.

2. **Start with deadlines.** Enter project deadlines first, then work backwards to place phases. The deadline markers make it obvious when things don't fit.

3. **Use the heatmap to spot problems.** Red cells = overcommitment. Multiple months of red for one person = burnout risk. Act before it happens.

4. **What-If before committing.** When a new project comes in, use What-If Mode to see where it fits. Don't just assign it — check the capacity impact first.

5. **Quick Plan then adjust.** For new projects, Quick Plan gets the structure in place fast. Then drag bars and reassign people as needed.

6. **Leave matters.** Mark holidays and part-time arrangements. A 50% capacity person with 60% load is overcommitted — the heatmap will show this, but only if you tell it about the leave.

7. **Export regularly.** Export your data as JSON backup after significant planning sessions. It takes one click and could save you from losing work.

8. **Use Save As Copy for scenarios.** Before making big changes, duplicate your plan. This lets you compare alternatives side by side.

9. **Print the heatmap for meetings.** The PDF export with the colour legend is the most useful artefact to share — it shows the capacity picture at a glance without needing access to the tool.

10. **Don't over-model.** If a phase is "roughly 3 months," say 3 months. The tool is designed for approximate planning, not precision scheduling. Getting within a month is good enough.
