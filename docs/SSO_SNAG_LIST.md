# SSO & Azure — Snag List

Things to iron out **when Microsoft sign-in (Entra) is turned on** and when the
app is hosted on **Azure**. Until then Headroom runs in **shared no-login mode**
(a typed display name + an open API guarded by `ALLOW_ANONYMOUS=1`), so several
controls are *advisory* rather than enforced. Work through this before relying
on the app for anything that needs verified identity (R&D sign-off especially).

Status legend: ☐ to do · ⚠ decision needed.

---

## A. Turning on Microsoft sign-in (Entra)

- ☐ **Register the app in Entra** (SPA + exposed API scope). Capture: client ID,
  tenant ID, the API scope URI, and the **redirect URI** (the deployed origin).
- ☐ **Set the client env vars:** `VITE_AZURE_CLIENT_ID`, `VITE_AZURE_TENANT_ID`,
  `VITE_AZURE_API_SCOPE`. `IS_SSO` flips on automatically when the client ID is
  present (`src/auth/authConfig.js`).
- ☐ **Set the server env vars:** `AZURE_TENANT_ID`, `AZURE_CLIENT_ID`
  (`api/_lib/auth.js` verifies the JWT signature/issuer/audience against these).
- ☐ **Remove `ALLOW_ANONYMOUS`.** While it's set, `requireUser` skips token
  verification and treats everyone as one shared user — this MUST be off for SSO
  to mean anything.
- ☐ **Test the redirect round-trip end to end:** cold sign-in → land on the
  right tab. The tab lives in the URL hash; confirm the MSAL redirect handshake
  doesn't clobber it (`handleRedirectPromise` in `src/main.jsx`). Earlier note:
  watch the hash-routing vs redirect interplay.
- ☐ **Token expiry / silent-renew UX.** `getAccessToken` falls back to
  `acquireTokenRedirect` on silent failure (a full reload). Confirm expired
  tokens recover gracefully and 401s don't dead-end the UI.
- ☐ **Sign-out** uses `logoutRedirect` — confirm it returns to a clean state.
- ☐ **Vercel/host deployment protection.** Shared mode relies on the host
  keeping the open API private. Once tokens are verified, decide whether to keep
  or drop that protection.

## B. Hosting on Azure (vs the current Vercel-style setup)

- ⚠ **API function model.** The endpoints in `api/*.js` are Vercel-style
  handlers (`export default function handler(req, res)`). Azure options change
  the shape:
  - **Static Web Apps / Functions** — different handler signature & bindings;
    the `api/` functions would need adapting (or an adapter layer).
  - **App Service (Node server)** — could run an Express-style shim that mounts
    the same handler logic.
  Pick the model and adapt the handlers once; the business logic is portable.
- ⚠ **EasyAuth instead of manual JWT verification.** App Service / Static Web
  Apps can do Entra auth for you and inject `x-ms-client-principal` (identity +
  roles) rather than a Bearer token. If you use it, **`requireUser` changes**:
  read the principal header instead of verifying a JWT with `jose`. Keep all
  identity logic behind `requireUser`/`requireManager` so this stays a one-file
  swap.
- ⚠ **Database host.** Neon (Postgres) is cloud-agnostic and can stay, or move
  to **Azure Database for PostgreSQL**. Either way, re-point the connection
  string and check `ensureTimeSchema()` runs against it.
- ☐ **Secrets/config:** move env vars into **Azure App Settings** (or Key Vault)
  — client `VITE_*` are build-time, server vars are runtime.
- ☐ **Entra app registration redirect URI** must match the Azure origin.

## C. Manager sign-off (built now — see `feature/manager-signoff`)

- ☐ **Set the manager allow-list** so enforcement switches on:
  `MANAGER_NAMES="Jason Roberts,John Babb"` and/or `MANAGER_EMAILS=...`. While
  both are unset, authorise/lock stay **open** (so shared mode keeps working).
  Keep this in step with `MEMBER_MANAGERS` in `src/constants.js`.
- ⚠ **Match by email, not name, under SSO.** `MANAGER_NAMES` matches the typed
  display name (spoofable in shared mode). Once on Entra, prefer
  `MANAGER_EMAILS` against the verified email. Also confirm the UI "My team"
  lens (`AuthoriseView`) matches correctly — it currently compares the Entra
  **display name** to each member's `manager` field (a name); if display names
  drift, switch the member `manager` field to store an email, or add a mapping.
- ⚠ **Prefer Entra app roles to an env allow-list (Azure).** With EasyAuth you
  get role/group claims — replace the name/email check in `api/_lib/roles.js`
  (`isManagerIdentity`) with a role check (e.g. an `Approver` app role). The
  helper is already isolated for exactly this swap.
- ☐ **Per-report enforcement is currently UI-only.** The server gate is coarse
  ("is a manager"), because the time-entries API can't see the team roster
  (it lives in the plan document, not `time_entries`). A manager can technically
  authorise anyone via the API. To enforce "only your own reports" server-side,
  either stamp each entry with the person's manager at confirm time, or give the
  API read access to the roster. Decide if/when this matters.
- ☐ **Restrict the Timesheet to your own entries (optional).** Today anyone can
  record time "for" any person. Under SSO, consider binding an engineer to their
  own roster member.

## D. Identity & attribution

- ☐ **Audit columns** (`created_by`, `updated_by`, `confirmed_by`,
  `authorised_by`) currently store the display name (often "Shared workspace").
  After SSO they hold real names/emails; **historical rows keep the old values**
  — cosmetic, but note it for any audit/evidence export.
- ☐ **Conflict banner** (`ConflictBanner`) shows "updated by {name}" — will start
  showing real identities; sanity-check the messaging reads well.
- ☐ **Stale `headroom-display-name` in localStorage** becomes irrelevant under
  SSO (`getAccountName()` prefers the account). Harmless; clear if tidying.

---

_Keep this list updated as items are closed. Owner: project lead._
