# R&D Tax-Relief Wizard — decision summary

**Purpose:** decide whether to build the R&D tax-relief wizard **inside Headroom** or as a **separate app**. This page is the one-paragraph-each overview; the two companion documents hold the full implementation plans:

- [`RD_WIZARD_OPTION_A_INTEGRATE.md`](RD_WIZARD_OPTION_A_INTEGRATE.md) — fold the wizard into Headroom *(recommended)*
- [`RD_WIZARD_OPTION_B_STANDALONE.md`](RD_WIZARD_OPTION_B_STANDALONE.md) — build a separate app that round-trips with Headroom

*Status: for discussion. No code has been written for either option.*

---

## What we're deciding

We have a working prototype (`rd-wizard.jsx`) — a 10-step guided builder for an **HMRC R&D tax-relief** claim: it captures the narrative (advance sought, technological uncertainty, baseline, work packages, competent professional, boundary/non-R&D, funding), runs an **AI compliance coach** (per-section scoring + suggested rewrites) and a **readiness assessment** (gates export until it's strong enough), and produces a polished pack plus an **Additional Information Form (AIF)** narrative draft.

Headroom **already has an R&D module**: it stores the same project narrative, grants and work packages, classifies each timesheet entry (qualifying/funding), and — uniquely — computes **real claimable hours and cost from confirmed timesheets** (day/week caps, salary ÷ 220), feeding a Grant claim pack and a Tax-relief pack.

So the prototype and Headroom **overlap on the narrative**, while **only Headroom holds the costing/actuals**. The prototype is, in fact, already written to import a Headroom export and to write its output *back into* Headroom — i.e. it was conceived as a companion, not a separate product.

## Why this matters (the real process)

- **HMRC merged scheme** (accounting periods from 1 April 2024): every claim needs an online **Additional Information Form**, first-time claimants need a **claim-notification form**, and from April 2024 **only UK-located work qualifies** — a "who did the hours, and where" question that Headroom's timesheet data answers.
- **Innovate UK grant claims**: quarterly, labour costed at **salary ÷ 220 productive days**, evidenced by **timesheets**, with an **Independent Accountant's Report** above threshold — again, Headroom's data.

The compliance *story* is the wizard's job; the defensible *numbers* are Headroom's. That split is the crux of the decision.

## The two options at a glance

| | **Option A — integrate into Headroom** *(recommended)* | **Option B — standalone app** |
|---|---|---|
| Effort (1 engineer) | **~6.5–9 days** | **~5–6.5 weeks** |
| Data model | One source of truth; narrative sits beside the real actuals | R&D narrative duplicated across two apps |
| Hours / cost | Reads real claimable hours directly | Estimate-only unless imported; Headroom stays the costed source either way |
| AI coaching backend | 2 functions added to the existing `/api` | A whole new backend (still required — the browser can't safely hold the key) |
| Auth / deploy / DB / API key | One of each (reuse what exists) | Two of each (2nd sign-in registration, 2nd database, separate AI-key custody) |
| Keeping them in sync | Not needed — edits happen in place | A permanent export/import contract + new merge logic in Headroom |
| Best fit | "Add the R&D wizard to our tooling" | The wizard must be a *separate product* for separate users / release cadence |

## Recommendation

**Option A — fold it into Headroom.** The wizard's core output *is* Headroom's R&D record, and the claim's hours/cost already live in Headroom. Folding in gives a single source of truth, reuses the existing auth/persistence/costing, and turns the AI coach into two small server functions — while also fixing a security flaw in the prototype (it currently calls the AI API directly from the browser, exposing the key; both options move this server-side, but Option A does it with no new infrastructure).

**Option B is justified only if** the wizard must be organisationally separate — e.g. handed to an external tax specialist without exposing the whole plan, or shipped on a different timeline. It can be made to work, but it permanently duplicates the narrative model and cannot itself produce defensible hours/cost figures.

## Notes for the discussion

- **AI coaching is in scope in both plans.** It stays *advisory* ("review before submission; not a substitute for professional tax advice"), runs through a server-side proxy so the API key is never in the browser, and logs an audit trail. It has a per-call cost (capped); it is **not** allowed to compute monetary relief — that remains the specialist's job.
- **Either way, Headroom remains the costed source of truth** for claimable hours. The wizard owns the narrative and readiness; it should never be the system of record for the £ figures.

*Sources for the process facts: HMRC merged scheme & AIF — [Deloitte](https://www.deloitte.com/uk/en/services/tax/perspectives/the-uk-merged-r-and-d-regime.html), [Alexander Clifford (AIF)](https://alexanderclifford.co.uk/blog/r-and-d-additional-information-form/), [RandD Tax (Apr-2024 changes)](https://www.randdtax.co.uk/navigating-the-uks-new-merged-rd-scheme-what-changed-from-april-2024/); Innovate UK claims & IAR — [Audit Group](https://auditgroup.co.uk/innovate-uk-audit/), [Glencoyne (day-rate basis)](https://www.glencoyne.com/guides/innovate-uk-grant-accounting-guide), [Silverstone TC (IARs)](https://silverstonetechnologycluster.com/stephen_henson_tc-group/independent-accountants-reports-iars-for-grant-claims/).*
