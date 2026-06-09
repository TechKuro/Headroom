# Option B — Standalone R&D wizard app (round-tripping with Headroom)

*Companion to [`RD_WIZARD_DECISION_SUMMARY.md`](RD_WIZARD_DECISION_SUMMARY.md). For discussion — no code written yet.*

Build the `rd-wizard.jsx` prototype into a **separate, independently deployed app** with its own backend, its own sign-in and its own database. It exchanges files with Headroom: Headroom **exports** team/projects/grants for the wizard to consume, and the wizard produces an import file that Headroom learns to **merge** into its R&D projects without wiping the plan. This option deliberately accepts two apps, two deployments, two sign-in setups and one shared data contract.

## Architecture

Two independent deployables sharing a versioned file contract:

```
 HEADROOM (existing)            export file  ───────▶   RD WIZARD (new, standalone)
 React SPA + serverless API                            React SPA + its own backend
 + Neon DB + M365 sign-in     ◀───────  import (merge) file   + own DB + AI proxy (holds key)
```

A file-based round-trip is proposed for v1 (lowest coupling, mirrors today's export/import button), with a documented path to a direct app-to-app API later.

## The wizard app

**Stack: mirror Headroom exactly** — same frontend framework, test runner, serverless style and database product. This means the team runs one mental model, the sign-in code is reusable as-is, and a future merge back into Headroom (if this decision is later reversed) is cheap. A different framework would create a third paradigm to maintain.

**Two prototype defects that must be fixed to productionise it:**
1. It calls the AI API **directly from the browser** (exposes the key, hits CORS). All AI traffic must move to the app's own backend.
2. It uses a Claude-artifact storage shim. That must be replaced with real persistence — a local draft store plus a database table per saved claim.

## The wizard's backend (new)

- **Persistence:** one record per claim/draft (a JSON blob + metadata), with list/load/create/save/delete endpoints and a stale-write guard copied from Headroom.
- **Sign-in:** copy Headroom's dual-mode auth so the two apps converge on Microsoft 365 later. **Decision for stakeholders:** the cleanest end state is the *same tenant* with *two app registrations* (one per app), so it's the same Nexian sign-in — but it is a **second registration to create and maintain**, and the SSO checklist items happen twice. R&D sign-off needs verified identity, so the wizard should be on real SSO before its output is treated as evidence.
- **AI proxy (the main reason a backend is needed at all):** two endpoints (section coach, full assessment) that hold the API key server-side, enforce the "score ≥ 6" export gate on the server (never trust a client-set score), and add basic rate-limiting and input-size limits.

## The round-trip contract

- **Headroom → wizard:** a *scoped* export (team, tracker projects, R&D projects with their narrative, grants with work packages) — deliberately narrower than today's full-plan export so the wizard doesn't receive the whole plan. Each R&D project's id is the stable join key.
- **Wizard → Headroom:** a merge file (`_action: "merge"`) carrying the narrative fields (which map one-to-one onto Headroom's R&D project), the richer work-package detail, the AIF narrative and the assessment, each keyed by the originating R&D-project id.
- **Merge rules (new work on Headroom):** match by id and overlay only the fields actually present (preserving Headroom-only fields); if there's no match (a deleted/renamed project) import it as new and say so; never touch team, projects, capacity, grants or timesheets; show a preview/diff before committing; make it one undo step.

## New work required *on Headroom* (not just the new app)

Option B is **not** purely a new app — Headroom has to learn to ingest the wizard's output, which it currently cannot do (its import only does a full replace of team/projects):

- Add a scoped "export for the R&D wizard" action.
- Branch the import on the file type and add a new **merge** path (a new reducer action + a pure, well-tested merge helper modelled on the existing CSV-upsert logic) — kept strictly separate from the existing full-replace import.
- Validate the file's schema/version and reject mismatches clearly.
- Extend the R&D-project shape with a home for the AIF narrative and the rich work packages.

This is modest but real, and it lands in Headroom's most safety-critical area (the save/restore path).

## The hours/cost limitation (important)

The wizard only has **manual hour estimates**. The defensible claimable hours and cost live **only in Headroom** (timesheet-derived, capped, authorised/locked). Three ways to handle it:

- **(A) Estimate-only (recommended for v1):** the wizard stays narrative + estimates; **Headroom's packs remain the costed source of truth.** Stakeholders must understand the wizard's hour figures are *indicative, not the claim basis*.
- **(B) Import a read-only actuals snapshot** into the export so the wizard can display real figures beside its estimates (more work; no write-back).
- **(C) Live cross-app API** — rejected for v1 (needs cross-origin sign-in federation between two registrations).

**Bottom line:** the wizard is always *downstream* of Headroom for any auditable £ figure. It owns the *story*; Headroom owns the *numbers*. This split is the central tension of running two apps.

## Phased delivery

| Phase | What | Est. |
|---|---|---|
| 0. Freeze the contract | Agree the export/import schema + version with stakeholders. | 0.5 wk |
| 1. Headroom ingest | The merge path on the Headroom side (useful even before the app exists — a hand-written file can be merged). Lowest-risk place to start. | 1 wk |
| 2. Wizard scaffold + persistence | New repo, copy the sign-in/DB code, lift the prototype's steps, replace the storage shim. | 1–1.5 wk |
| 3. AI proxy | The coach/assess endpoints, key server-side, gate enforced server-side, rate-limited. | 1 wk |
| 4. Round-trip wiring | Import the Headroom export; emit the merge file; test the full loop. | 0.5–1 wk |
| 5. Deploy + sign-in hardening | Second deployment, second app registration, env/secrets, smoke-test the loop. | 0.5–1 wk |
| **Total** | | **~5–6.5 wk** (one engineer; phases 1+2 parallelise to ~4 wk with two people) |

## Hosting / operations (with the Azure move in mind)

A *second* of nearly everything: a second deployment target, a second database, a **second secret to manage** (the AI key), a second sign-in registration (the SSO checklist, twice), and a second access-protection setup. The same Azure caveats as Headroom apply (the serverless function shape differs on Azure; built-in auth could replace manual token verification) — see `SSO_SNAG_LIST.md`.

## How we'd verify it

- Automated tests for the merge helper (match / stale id / field preservation / idempotency / version mismatch) and the schema validators, in both repos.
- A **golden-file round-trip test** (export → wizard → merge → assert the resulting R&D projects) run in both repos so a schema bump can't silently break the other side.
- Checks that the AI key never appears in the built frontend, and that the export gate is enforced server-side.
- A regression check that Headroom's existing full-plan import/export is unchanged.

## Key risks

| Risk | Mitigation |
|---|---|
| **Duplicated R&D narrative across two apps** (highest) | Declare the wizard the editor of record for the narrative and Headroom's narrative fields read-mostly; keep the sync one-directional (wizard → Headroom). Without this discipline, people edit both and lose work. |
| Stale join keys (project deleted/recreated in Headroom) | "No match → import as new" + a visible import summary; never silently drop. |
| Two of everything (deploys, sign-ins, secrets) | Copy Headroom's auth verbatim; same tenant; isolate identity behind one helper. |
| Hours/cost authority confusion | Label estimates clearly; keep Headroom's packs as the costed source. |
| Schema version skew between the apps | A shared, versioned schema + the round-trip test in CI; reject mismatches with a clear message. |
| AI proxy abuse / cost | Sign-in gate + rate-limit + input-size caps + capped responses. |

## Trade-offs vs Option A (fold into Headroom)

**This option wins on** clean separation of a self-contained workflow, an independent release cadence, no risk to Headroom's save path, and the ability to hand the wizard to a different audience (e.g. an external tax specialist) without exposing the whole plan.

**It costs** a second of everything — repo, deployment, database, sign-in registration, secret store — for an app that **still cannot independently produce defensible hours/cost** (those live in Headroom). It permanently duplicates the R&D narrative model across two codebases and needs a file contract kept in lock-step. Note that the AI backend has to be built **either way**, so it is not a point of difference.

**When to choose B anyway:** if the wizard genuinely must be a *separate product* — different users, different access, external sharing, or a different delivery timeline. If the goal is simply "add the R&D wizard to our tooling," Option A is materially cheaper and removes the duplication and hours-authority risks that B can only mitigate, not eliminate.
