# Headroom — User Guide

## What is Headroom?

Headroom is a **capacity, commercial and R&D planning tool** for small engineering teams. It started life answering one scheduling question — *"if a new project lands next week, who can take it on and when?"* — and now layers two more on top:

- **Capacity planning** — who is working on what, at half-day resolution, and where the room is.
- **Commercial view** — turn planned time into **labour cost, ROI and delivery risk** per initiative, using a single blended hourly rate.
- **R&D reporting** — confirm *actual* time against the plan, then classify it for **HMRC R&D tax relief** and **Innovate UK grant claims**, with downloadable evidence packs.

It is **not** a task tracker. It sits above your delivery tools (Jira, Halo, etc.) and gives a high-level picture of capacity, commercial health, and R&D claimability.

It is a **shared, cloud-backed workspace**: everyone on the team sees and edits the same plans, and changes save automatically.

---

## Getting Started

### Signing in

Headroom runs in your browser at the team's Headroom URL. How you sign in depends on how your workspace is configured:

- **Microsoft 365 (SSO):** you're sent to the Microsoft sign-in page and returned to the app. Your name comes from your Microsoft account.
- **Shared workspace (name only):** a landing page asks for your name. This is used to label your changes (so the team can see who did what) and to match you to your timesheet.

Your name appears top-right, with a **sign-out** button next to it.

### First look

The workspace comes pre-loaded with a **Sample Plan** — four people (Alice, Bob, Charlie, Dana), four projects, some allocated half-days (including a deliberate double-booking so the over-commitment view has something to show), plus a sample R&D project and Innovate UK grant. Explore it, then create your own plan when ready.

The app opens on the **Overview** tab. The tab you're on is stored in the page address, so a refresh — or a bookmarked link like `…/#planning` — keeps (or opens) that view.

### Quick start: your real plan

1. **New plan** — click the plan name in the header → **New Plan**, name it (e.g. "Q3 2026").
2. **Add your team** — in the sidebar under **Team**, click **+ Add member** and fill in the card (First name, Second name, Manager, Team — all required), then **Save**.
3. **Add your projects** — under **Projects**, click **+ Add project**. Name and Estimated value are required; set Start, Deadline, Colour, Type, Status and the rest, then **Save**.
4. **Allocate work** — on the **Planning** tab, pick a project in "Allocating to", then click a person's AM/PM cells to put them on it. Or expand a project in the sidebar and use **Quick Plan** / **+ Add** to lay out phases.
5. **Check for clashes** — the **Heatmap** tab flags anyone double-booked (red). Adjust until the plan works.

---

## Core Concepts

### Half-day slots

The working week is **Monday–Friday**, and each day has two **half-day slots**: **AM** and **PM**, each worth **4 hours** (so 8 hours/day). All allocation happens by clicking these half-day slots — there are no fractional hours to type.

### Phases

Work on a project is grouped into **phases** — a phase has a type, a date window, and a set of allocated half-day slots for one or more people. The phase **types** are labels/colours that describe the kind of work; they no longer carry a load percentage:

| Type | Short code |
|---|---|
| Scoping | SCP |
| Active Build | BLD |
| Waiting on 3rd Party | W8 |
| Final Push | FIN |
| Handover | H/O |

### Over-commitment (double-booking)

Capacity is measured by **double-booking**, not percentages. If the **same person's half-day slot is claimed by two or more projects**, that's an over-commitment — shown in **red** across the grids. A clean plan has at most one project per person per half-day.

### Cost, value and ROI

A global **blended hourly rate** (default **£110/h**, editable in the header) turns planned time into money:

- **Labour cost** = allocated half-days × 4h × rate
- **ROI** = a project's estimated value − its labour cost

### Progress is *derived*

Project **progress is not typed in** — it's calculated as **confirmed timesheet hours ÷ planned hours** (capped at 100%). A project with no plan shows "—"; one where confirmed time exceeds the plan shows an overrun marker (▲). Progress climbs as people confirm time on the **Timesheet**.

### Risk

Each project gets a **risk level** (Low / Watch / At risk / Critical) from a transparent scoring model — see [Risk scoring](#risk-scoring). Hovering a risk badge always lists exactly which signals fired.

---

## The Interface

### Header bar

Left to right:

| Element | What it does |
|---|---|
| **Menu icon** | Show/hide the sidebar |
| **Headroom** | App title |
| **Plan name + menu** | Document menu — New, Save As Copy, Rename, Load, Delete, Export to PDF |
| **Rate £/h** | The blended hourly rate (1–999, default 110). Drives all cost/ROI in Overview, Standup, People & Cost. Recalculates instantly; undoable. |
| **Theme toggle** | Switch light / dark (remembered per browser) |
| **Undo / Redo** | Undo or redo any change (also Ctrl+Z / Ctrl+Y) |
| **Search icon** | Toggle the Availability Finder |
| **‹ This week ›** | Scroll the half-day grids by a week, or jump to the current week |
| **Export / Import** | Download or load a plan as JSON |
| **Your name + sign-out** | Account label and sign-out |

### View navigation

Beneath the header is a navigation row with the views **clustered into groups**:

- **Insight** — Overview · Standup · People & Cost
- **Plan** — Planning · Timeline · Heatmap · Project
- **R&D** — Timesheet · Authorise · R&D

Every view is still one click; the grouping just makes the bar easier to scan. The app opens on **Overview**, and the current view is remembered in the page address (so a refresh or a bookmarked `…/#planning` keeps it).

### Sidebar

Three sections: **Team**, **Projects**, and **What-If Mode**.

#### Team
- Lists members, with their **Team** shown as a subtitle.
- **+ Add member** (top) opens a card capturing **First name**, **Second name**, **Manager** and **Team** — all required. Manager and Team are fixed pick-lists (Managers: *Jason Roberts*, *John Babb*; Teams: *Projects*, *Engineer*, *Automation*).
- **Edit**: double-click a name or click the **pencil** icon.
- **Leave**: click the **calendar** icon to mark leave (AM / PM / full day). An **"L"** badge shows on people with leave set.
- **Remove**: the **×** button (confirms; warns how many phases will be affected).

> Managers (Jason Roberts, John Babb) are for **reporting and sign-off only** — they're not part of the roster, so they aren't allocated work or costed. They become the approvers in the R&D timesheet flow.

#### Projects
- Projects are **grouped by company/customer** — a project's **Company** field when set, otherwise the first word of its name — and the companies are listed **alphabetically**. Use **Collapse all / Expand all** at the top right.
- **+ Add project** (top) opens a card: **Name** (required), Start, Deadline, Colour, and the initiative details — Type, Status, **Estimated value** (required), Value note, Description, Chargeable.
- **Edit**: double-click the name or click the **pencil** icon.
- **Import CSV** (top of the section) bulk-loads projects from a spreadsheet/SharePoint export. It **upserts by name**: projects already in the plan are *updated* from the file, new ones are *added* — so re-importing is safe (no duplicates). It maps the columns with a sensible home — **Task Name → name**, **Description**, **Start/End Date** (ISO or `M/D/YYYY`), **Status** (New → Not Started, In Progress, Done), and **Company Name → Company** (so projects group by company) — and defaults the rest (Internal, £0 value, auto colour). When updating an existing project it keeps your local edits (estimated value, type, chargeable, colour, phases) and only syncs the CSV-owned fields. Blank rows are skipped; it reports added / updated counts.
- **Expand** a project (click it) to see its **phases** — each phase shows its type, who's on it, the dates and the half-day count — with **Quick Plan**, **+ Add**, and **View project →**.
- **Remove**: the **×** button (confirms; shows the phase count).

#### What-If Mode
Click **What-If Mode** to model a hypothetical project without committing it — see [What-If Mode](#what-if-mode).

---

## Views

### Planning

The half-day **allocation grid**: people down the side, working days across the top (about four weeks, scroll by week), each day split into **AM** and **PM**.

- Pick a project in **"Allocating to"**, then **click a half-day cell** to add or remove that person on it.
- Each filled cell shows a **short project code** (e.g. `AM` for "API Migration") on the project colour. A **double-booked** cell turns red and shows **×N** (the number of projects clashing).
- Each person's row shows a **fill count** (e.g. `8/40`) and a **⚠ N** badge if any of their slots are double-booked.
- Leave shows as a striped, unavailable cell. Today's column is highlighted.

### Timeline

A longer-range **roadmap** (about six months, scroll by three) with **draggable bars**. Toggle between:

- **Projects** — one bar per project showing when it runs; drag the **middle** to move it, the **edges** to resize start/end.
- **People** — each person's phases stacked across the months.

Bar labels show the project and its duration in weeks (Projects mode) or hours (People mode). What-if phases appear dashed.

### Heatmap

The **over-commitment** view — same people × half-day layout as Planning, coloured by commitment:

| Colour | Meaning |
|---|---|
| Green | Committed (one project) |
| Red (with a number) | Double-booked (two or more projects) |
| Striped | On leave |

Below the grid, a **Commitment summary** per person shows a bar plus `committed/total halves`, `N double-booked`, and `N free`.

### Project

A single project's allocation grid. Pick the project from the dropdown.

- Click cells to allocate/remove people **for this project**.
- Cells booked on **other** projects show as a striped "busy elsewhere" pattern; a cell on this project that's *also* booked elsewhere shows as a clash.
- People with no allocation to this project are dimmed (click their cells to add them).
- What-if projects are **read-only** here.

### Overview

The **commercial dashboard** (first tab). One row per project, turning planned time into cost and comparing it to value.

**Metrics strip** (reflects the current filters): **Initiatives**, **Est. hours**, **Labour cost**, **Est. value**, **Net ROI** (signed), **Avg progress** (planned projects only), **At risk** (count at At-risk or Critical).

**Filters:** Status (Not Started / Backlog / In Progress / Done), Type (Internal / Client), **Risk** level, **Chargeable only**, and **Needs info**. **Sort** by Risk, ROI, Labour cost, Progress, Est. hours or Name (click the active sort to flip direction).

**Table columns:** Initiative (name, description, people) · Status badges · **Risk** (hover for the fired factors; a **Needs info** chip flags missing data) · **Progress** (bar; "—" if no plan; ▲ on overrun) · Est. hours · Labour cost · Est. value · ROI.

### Standup

A person-by-person check-in, for stand-ups and one-to-ones.

- Pick a person; the **summary** shows their active project count, estimated hours, labour cost, **client hours**, and a **⚠ Double-booked** warning with dates if relevant.
- **Project rows** show each assignment with type/status/chargeable badges, the person's hours and cost on it, the project's progress and ROI, and **Overdue / Deadline soon** flags. The **ⓘ** button opens a project summary popover.
- Selecting a project shows four fixed **check-in questions** and a **notes** area — notes are stamped with name and time, kept per person-per-project, and saved with the plan.

### People & Cost

The team **ranked by workload** (busiest first), each as a card showing:

- **Hours**, **Cost**, **Billable %** (chargeable share), **Avg fill**, and **Double-booked** day count.
- A **utilisation forecast** strip for the next ~20 working days, coloured by how full each day is (green part-day → amber full → red over-committed).
- A **client vs internal** split bar, top projects, and when they next have availability.

### Timesheet

Where an engineer confirms **actual** time against the plan (the start of the R&D trail).

- Pick the person in **"Recording time for"** and the **week**.
- Each working day is a card listing its projects, pre-filled from the plan. Adjust **hours** (0–24, half-hour steps) and add a short **description**, then **Confirm** the day. Future days show **Upcoming** and can't be confirmed.
- A day over **8h** is flagged ("over 8h cap"). Each row carries a status: **Not saved → Draft → Confirmed → Authorised → Locked**.

### Authorise

The **manager** flow — restricted to managers (Jason Roberts / John Babb).

- The view shows **"Approving as {you}"** and a **My team / Everyone** toggle. **My team** shows only the people who report to you (from each member's **Manager** field); **Everyone** shows the whole team.
- Pick the week. Tick **confirmed** entries (or **select all**) and click **Authorise selected (N)**.

> Only managers can authorise or lock. Once Microsoft sign-in is enabled this is enforced against your verified identity; in the current shared mode it's based on the display name you signed in with, so it's a soft guardrail rather than a hard lock.
- **Lock week** closes the period — all *authorised* entries become **Locked** (immutable). Any still-confirmed-but-unauthorised entries are reported back.
- Locked/authorised time is corrected via an **adjusting entry**: click **Adjust**, enter the corrected hours, Save — this appends a new confirmed entry linked to the original (marked "(adj.)").
- Flags: **late** (confirmed more than 7 days after the work) and **over** (day exceeds the 8h claimable cap).

### R&D

Four sub-sections for tax relief and grant claims:

1. **R&D Projects** — the tax unit. The section is a compact list (name · claim status · readiness · % complete); click one to open the **Claim builder** — a guided, full-width flow (Setup → Advance → Uncertainty → Baseline → Work packages → Competent professional → Boundary → Funding → Review) that captures the full HMRC narrative, links the tracker projects, and validates as you go. Each narrative section has a **Review with AI** button (advisory scoring + a suggested rewrite you can apply), and **Review** runs a full **readiness assessment** that scores the claim, lists gaps and drafts the **AIF narrative**. AI guidance is advisory — review before submission. *(The AI features activate once the server's Azure OpenAI deployment is configured.)*
2. **Grants** — funder, reference, budget, dates, claim cadence, IAR milestones, and **work packages**.
3. **Classify Time** — for each confirmed entry in the week, set **Funding source** (Self-funded / Grant-funded / Other subsidised), **Classification** (Qualifying — direct / indirect, or Non-qualifying), the **R&D project**, and **work package**. A qualifying classification **requires** a funding source.
4. **Packs** — generate evidence:
   - **Grant claim pack** — actual vs **claimable** hours per work package/person (capped at **8h/day, 40h/week**), with day-rate cost. Downloads as CSV.
   - **Tax-relief pack** — qualifying vs non-qualifying hours, split by funding source, plus the project narrative. Downloads as CSV.
   - Packs use **authorised/locked** time only and are marked **DRAFT** — a basis for your specialist/IAR to review, not a final claim.

---

## Key Features

### Adding & editing phases

Open the **Phase** card by clicking an empty cell on a grid, or **+ Add** in a project's sidebar panel. It captures:

- **Team members** (tick one or more; unticking clears their slots)
- **Project** (when adding)
- **Phase type**
- **From / To** dates
- A **half-day mini-grid** — click the AM/PM cells to allocate; clashes are highlighted, and a **Double-booking** warning lists who's already booked.

Click a phase row (sidebar) or bar (Timeline) to edit it; editing adds a **Delete** button.

### Quick Plan (templates)

In a project's sidebar panel, **Quick Plan** lays out a sequence of phases across consecutive working days (both halves) for one assignee:

| Template | Working days |
|---|---|
| **Standard** | Scoping 2 · Build 8 · Final Push 3 · Handover 2 (15) |
| **Short Sprint** | Scoping 1 · Build 5 · Handover 2 (8) |
| **Long Project** | Scoping 3 · Build 12 · Waiting 3 · Final Push 4 · Handover 2 (24) |
| **Support / Maintenance** | Scoping 2 · Handover 3 (5) |

Pick a template, a default assignee and a start date, review the preview, then **Apply**. Reassign or adjust individual phases afterwards.

### Leave / availability

The **calendar** icon by a person opens the Leave card: set a **From/To** range and choose **Full day**, **AM only** or **PM only**. Existing leave shows as removable chips. Leave makes those slots unavailable on every grid and in the Availability Finder.

### Availability Finder

The **search icon** in the header opens the finder. Set **how many free days** you need (1–10); it highlights everyone with that many **consecutive free working days**, and reports "N of M have …". Highlights appear on the Planning, Heatmap and Project grids. This answers *"who's free for a 3-day block, and when?"*

### What-If Mode

Model a hypothetical project before committing:

1. Click **What-If Mode** — a bar appears.
2. Set its **name**, **deadline**, **estimated value** and **colour**.
3. Allocate phases (it appears in the Phase card's project list and on the grids as dashed bars).
4. The bar shows the **added hours, cost and projected ROI**, and **⚠ overloads** if it double-books anyone.
5. **Commit Project** to keep it, or **Discard** to throw it away.

### Risk scoring

Risk is a transparent score. Each signal adds points by severity — **high = 3, medium = 2, low = 1** — and the total maps to a band:

| Score | Band |
|---|---|
| 0 | Low |
| 1–2 | Watch |
| 3–5 | At risk |
| 6+ | Critical |

The signals:

| Factor | Severity | Fires when |
|---|---|---|
| Negative ROI | High | Value is set and labour cost exceeds it |
| Assigned person double-booked | High | Someone on the project is double-booked on a slot it claims |
| Behind schedule | High / Med | Delivered progress lags the % of the timeline elapsed by ≥40 / ≥20 points |
| Past deadline | High | The deadline has passed and it isn't done |
| Deadline approaching | Med | The deadline is within 14 days and it isn't done |
| Scheduled work, no one assigned | Med | The project has phases but nobody on them |
| Scheduled but not started | Low | Status is Not Started / Backlog but the start date has passed |
| Marked done but under 100% | Low | Status is Done but delivered progress < 100% |

Separately, a **Needs info** chip flags data gaps that are *not* scored: **no estimated value**, or **no initiative details set**.

### Undo / redo

Almost everything is undoable — allocation, phases, projects, members, leave, templates, imports.

- **Ctrl+Z** / **Cmd+Z** = undo · **Ctrl+Y** or **Ctrl+Shift+Z** = redo, or the header arrows.
- Loading a different plan resets the undo history.

### Plans (documents)

Click the plan name in the header:

| Action | Effect |
|---|---|
| **Rename** | Edit the plan name |
| **New Plan** | A blank plan |
| **Save As Copy** | Duplicate under a new name (great for scenarios) |
| **Load** | Switch to another saved plan |
| **Delete** | Remove a plan (confirms) |
| **Export to PDF** | Opens the browser print dialog — choose "Save as PDF" |

Plans **auto-save** as you work — there's no Save button. **Ctrl+S** just shows a "Saved" confirmation.

### Shared workspace & conflicts

Everyone edits the **same** plans. If a teammate saves changes to the plan you're editing, a **banner** appears offering **Reload theirs** or **Keep / Overwrite with mine**. Auto-save pauses until you choose, so nothing is silently clobbered.

### Export / Import (JSON)

The header's **export** button downloads the current plan as `headroom-export-<date>.json`; **import** loads one back (it validates the file first). Use it for backups or moving a plan between workspaces.

### Export to PDF

From the plan menu, **Export to PDF** opens the print dialog in landscape with a clean layout (sidebar/buttons hidden). The **Heatmap** is the most useful view to share.

---

## Keyboard Shortcuts

| Shortcut | Action |
|---|---|
| **Ctrl+Z** / **Cmd+Z** | Undo |
| **Ctrl+Y** / **Ctrl+Shift+Z** | Redo |
| **Ctrl+S** / **Cmd+S** | "Saved" confirmation (auto-save is always on) |
| **Enter** / **Esc** (in cards) | Save / close |

---

## Common Workflows

### "A new project just landed — who can take it?"
1. Open the **Availability Finder**, set the number of free days needed.
2. Note who's highlighted.
3. Switch to **What-If Mode**, add the project and tentative phases.
4. Check the **Heatmap** — anyone in the red?
5. Adjust, then **Commit Project**.

### "Someone's on leave next week"
1. Click the **calendar** icon by their name; set the range and AM/PM/full day.
2. Check the **Heatmap** — re-allocate anything that now clashes.

### "Which initiatives are paying off?"
1. Set the **Rate £/h** to your true blended cost.
2. Make sure each project's **type, status and estimated value** are filled in (the card).
3. Open **Overview**, sort by **ROI**, and read **Net ROI** for the filtered set.

### "Run the monthly R&D claim"
1. Engineers confirm their week on the **Timesheet**.
2. A manager **Authorises** and **Locks** the period on **Authorise**.
3. On **R&D → Classify Time**, set funding + classification (+ R&D project / work package) for the confirmed entries.
4. On **R&D → Packs**, generate the **Grant claim** and **Tax-relief** packs and download the CSVs for your specialist/IAR.

### "Quarterly planning"
1. **Save As Copy** (or New Plan).
2. Add projects with **Quick Plan**, assign people, adjust dates.
3. Balance load on the **Heatmap**; sanity-check costs on **People & Cost**.
4. **Export to PDF** for the planning meeting.

---

## Data & Storage

Headroom is **cloud-backed** (a Neon/Postgres database behind serverless `/api` functions). Plans live in the cloud and are shared across the team — there's no per-browser copy of plan data to lose.

- **Plans** hold: team members (name + structured fields), projects (colour, dates, phases, initiative metadata), half-day allocations, and leave.
- **Time entries** (the R&D actuals) live in a **separate table**, not inside the plan blob.
- The browser only remembers small preferences locally: your **theme**, your **display name** (name-only mode), and which plan you had open.

Because it's a shared, last-write-wins workspace, the **conflict banner** is your safety net when two people edit the same plan at once.

---

## Troubleshooting

**I get bounced to the Overview tab.**
The tab lives in the page address and defaults to Overview. A full refresh, a new deploy, or the sign-in redirect lands you there. Use a view's URL (e.g. `#planning`) to deep-link.

**Progress shows 0% / "—" everywhere.**
Progress is *delivered* time ÷ planned. With a fresh plan no time is confirmed yet, so it reads 0% (or "—" if there's no plan). It climbs once people **Confirm** time on the **Timesheet**.

**The Heatmap shows red.**
That person is **double-booked** — two projects on the same half-day. Hover the cell to see which, then move one allocation.

**A teammate's changes overwrote mine (or vice-versa).**
It's a shared workspace. Watch for the **conflict banner** and choose Reload/Keep — and avoid two people editing the same plan simultaneously where possible.

**I can't edit a timesheet entry.**
**Authorised** entries are locked for hours/description (classification stays editable); **Locked** entries are fully immutable — correct them with an **Adjust** (adjusting entry).

**Export to PDF looks wrong.**
Use Chrome/Edge, set landscape, uncheck headers/footers, and print the **Heatmap**.

---

## Tips

1. **Plan in half-days, not hours.** Click AM/PM — it's meant to take seconds.
2. **Watch the red.** Double-booking is the signal that matters; keep the Heatmap clean.
3. **Fill in value + dates.** They power ROI and the risk model — empty ones show as "Needs info".
4. **What-If before you commit.** See the capacity and ROI impact first.
5. **Confirm time weekly.** It's what makes progress, risk and the R&D packs real.
6. **Use Save As Copy for scenarios.** Compare "with a new hire" against today.
7. **Share the Heatmap PDF.** It's the clearest one-page capacity picture for a meeting.
