# Option A — Fold the R&D wizard into Headroom *(recommended)*

*Companion to [`RD_WIZARD_DECISION_SUMMARY.md`](RD_WIZARD_DECISION_SUMMARY.md). For discussion — no code written yet.*

Absorb the standalone `rd-wizard.jsx` prototype into Headroom's existing R&D module as a guided **"R&D claim"** flow inside the R&D view, editing the live R&D-project record in place. No export/import round-trip, no second data store, and the prototype's insecure browser-side AI call is replaced by a server proxy that reuses Headroom's existing authentication and persistence.

## Guiding principles

- **Reuse, don't rebuild.** Headroom's R&D-project model, grants, work-package actions, the actuals/claimable-hours engine and the Tax-relief pack already exist and are tested. The wizard is a *capture + AI + readiness* layer on top.
- **One source of truth.** The wizard edits the live R&D projects via existing actions. The prototype's "export a merge file back into Headroom" step disappears — there's nothing to import into when you're already inside Headroom.
- **Actuals stay actuals.** AI only touches narrative quality and readiness. Claimable hours and cost stay driven by confirmed/authorised/locked timesheets (the existing day/week caps and salary ÷ 220 logic).
- **The API key never reaches the browser.** All AI calls go through new server endpoints holding the key, reusing Headroom's sign-in, and writing an audit trail.
- **Safe migration.** Existing saved R&D projects keep working; new fields default via Headroom's existing "merge with defaults on load" pattern.

## Phased delivery

| Phase | What ships | Est. |
|---|---|---|
| 0. Data model + migration | Extend the R&D-project shape, add the rich work-package shape and supporting constants, extend the load-time migration. Ship-able on its own. | 0.5–1 day |
| 1. Server AI proxy | New `rd-coach` / `rd-assess` serverless endpoints + a small Anthropic helper + an audit table; wire them into the API client. Testable before any UI depends on them. | 1.5–2 days |
| 2. Guided stepper | A wizard component walking the 10 sections, editing the selected project in place; per-section "Review with AI"; "Apply suggested wording"; a full readiness assessment; client-side validation + export gating. | 2–3 days |
| 3. Rich work packages | Project-owned work packages carrying hypothesis / method / metrics / outcome / hours / team. | 1 day |
| 4. Enhanced Tax-relief pack | Fold the AIF narrative + work-package detail + readiness into the existing pack, keeping the actuals-based costing. | 1 day |
| 5. Polish, tests, docs | — | 0.5–1 day |
| **Total** | | **~6.5–9 days** (one engineer) |

## What gets added vs reused

**New files:** the two AI endpoints, a server-side Anthropic helper, an audit-table helper, the guided-wizard component, a reusable "AI review" panel, and a small pure validation/gating module (with tests).

**Modified files:** the constants (richer R&D-project fields + new work-package shape + AI/category/status constants); the load-time migration; the store (new work-package actions — kept separate from the existing grant work-package actions); the R&D view (a per-project "Open claim wizard" entry); the Tax-relief pack; the API client; and the deployment/user docs (new `ANTHROPIC_API_KEY`, optional model override).

**Reused wholesale:** the R&D-project update action and undo/redo history; the safe-load migration; the existing sign-in (`requireUser`); cloud persistence; the **actuals → claimable-hours engine** and the costed packs; toasts/confirm dialogs; CSV export. Dropped from the prototype: the direct browser AI call, the separate HTML-pack/CSV-as-an-app, and the merge-file round-trip.

## New data captured on an R&D project

Existing narrative fields are kept; these are **added**, each defaulting to a safe empty so old records migrate cleanly:

- Metadata: internal code, claim status (draft / in-review / ready — distinct from the delivery status), lead, category, project context.
- Narrative depth: prior art / "why not readily deducible", and a structured competent-professional record (name, role, years, experience summary) alongside the existing plain-text field.
- **Boundary / non-R&D:** excluded activities, non-R&D roles, and the apportionment basis (how R&D vs non-R&D time is split — references Headroom's own capacity records).
- **Funding split:** self / grant / other-subsidised %, plus notified-state-aid and claim-notification flags (with the warnings the prototype already has).
- **Rich work packages:** title, hypothesis, method, metrics, outcome, hours estimate, team.
- The last AI assessment result + a light audit mirror (the authoritative AI audit lives server-side).

> Grant work packages stay as they are (a name only) — timesheets link to them and the grant claim pack costs against them, so they shouldn't be merged with the R&D narrative work packages in v1.

## The AI coaching layer (server-side)

Two POST endpoints, both behind Headroom's existing sign-in, both holding the API key **server-side only**:

- **Section coach** — given one section's content, returns a score (0–10), a RAG status, specific issues, a suggested rewrite and a coaching note.
- **Full assessment** — given the whole claim narrative (plus an optional *summary* of the actuals, never raw timesheet rows), returns an overall score, per-section scores, gaps, a readiness summary, and a draft AIF narrative.

Every call is logged to an audit table (who, when, model, score — never the prompt or the key). The model is set via an environment variable (confirmed against the current Claude model list at build time). Cost is controlled by capping response length, constraining the output to a strict JSON shape, and logging token usage; there is no hard quota in v1 (it's an internal tool) — the spend exposure is documented. The AI is explicitly instructed it is **advisory** and must **not** compute monetary relief.

## Validation & "ready to export" gating

A small, pure, unit-tested module shared by the wizard and the pack:

- **Deterministic checks** (local, no AI): required fields present, funding percentages sane, a competent professional named, at least one work package, an accounting period set.
- **Export gate:** the Tax-relief pack export unlocks only when the last AI assessment scored ≥ 6 **and** there are no high-severity validation issues — reading the stored assessment so it doesn't fire an AI call on every render. The existing "DRAFT — pending specialist / IAR review" banner stays; the gate is an additional hard block.

## How we'd verify it

- **Automated tests:** the validation/gating module (including the score-6 boundary); the migration backfilling new fields on a legacy record without losing data; the audit recorder never capturing the prompt or key.
- **Endpoint checks:** the two AI endpoints return well-formed JSON, reject when sign-in is misconfigured, never echo the key, and still write an audit row when the upstream call fails.
- **End-to-end:** run the wizard on the sample R&D project — coach a section, apply a rewrite (and undo it in one step), run the assessment, confirm the export gate flips, generate the enhanced pack and confirm the **costing figures are unchanged** (still from timesheets). Confirm an older saved plan loads with valid empty defaults.

## Key risks & how they're handled

| Risk | Mitigation |
|---|---|
| API key exposure (the prototype's core flaw) | All AI calls server-side; key only in server env; never echoed; audit excludes prompt + key. |
| AI inventing relief £ or hours | Endpoints are narrative/readiness only; costing stays actuals-driven; the model is told not to compute relief; the pack keeps its "no £ relief computed" note. |
| Schema drift breaking saved plans | Additive, nullable fields + the existing safe-load migration; covered by tests. |
| Uncontrolled AI spend | Response-length caps, structured output, usage logged, model overridable via env. |
| Apply-rewrite clobbering edits | Writes go through the undoable action; confirm before overwriting a non-empty field. |
| The planned Azure move | Endpoints keep the same shape as the existing functions, so the move stays mechanical (see `SSO_SNAG_LIST.md`). |

## Trade-offs vs Option B (a separate app)

**Folding in (this option)** gives one data model — actuals, narrative, grants and AI all on the same R&D project — with no sync, no drift, and no estimate-only limitation. It reuses the sign-in, cloud storage, undo/redo and the entire actuals/costing engine; the AI proxy is just two more functions beside the existing ones; and the Tax-relief pack becomes one coherent artefact (narrative + actuals + readiness) rather than two half-pictures. The cost is added surface area inside Headroom and a shared release cadence.

A separate app (Option B) is faster to lift verbatim and ships independently, but it perpetuates a second data store, a second sign-in integration and a permanent import/export bridge — for a feature that is fundamentally about the same R&D projects Headroom already tracks. The integration work of folding in is paid once; the separate-app overhead is paid forever.
