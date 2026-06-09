# Headroom — Multi-user deployment checklist

Headroom is a shared, multi-user app: a Neon Postgres backend behind serverless
`/api/*` functions, with Microsoft 365 (Entra) single sign-on. It is **cloud-only**
— all plans live in the database; there is no localStorage/offline data mode.

**The code is already written.** This document covers only the provisioning steps
that have to happen in the hosting platform, Neon, and Entra — the parts Claude
can't do for you.

## How the two sign-in modes work

The app always reads/writes plans through `/api/*` → Neon. A single build-time env
var chooses how users are identified:

- **Shared no-login** — `VITE_AZURE_CLIENT_ID` is **absent**. Users type a display
  name (used to label their edits); the server must run with `ALLOW_ANONYMOUS=1`.
  Pair with platform deployment protection, since the API is then open.
- **Microsoft 365 SSO** — `VITE_AZURE_CLIENT_ID` is **set**. The app forces Entra
  sign-in and the API verifies the token on every request.

Either way the app needs the API + database to run — `npm run dev` alone (just
Vite, no functions) won't load plans; use `vercel dev` (or the deployed app).

The multi-user model is **shared workspace, last-write-wins** — everyone edits the
same plans; the most recent save wins. There is no per-user private data and no
live collaborative editing.

---

## 1. Neon Postgres (via Vercel Marketplace)

1. In the Vercel dashboard, open the project (or create it first — see step 3).
2. **Storage → Create Database → Neon (Postgres)**, accept the defaults, attach it
   to the project.
3. This auto-injects **`DATABASE_URL`** into the project's environment variables.
   You don't need to set it by hand.

No schema migration step is required — the API calls `ensureSchema()` on first
request and creates the `documents` table itself (`id`, `name`, `data JSONB`,
`updated_at`, `updated_by`).

---

## 2. Microsoft Entra app registration

In the [Entra admin center](https://entra.microsoft.com) → **App registrations →
New registration**:

1. **Name:** e.g. `Headroom`.
2. **Supported account types:** *Accounts in this organizational directory only*
   (Nexian single tenant).
3. **Redirect URI:** platform **Single-page application (SPA)**, value =
   your deployed origin, e.g. `https://headroom.vercel.app`.
   - Add `http://localhost:5173` too if you want to test cloud mode locally.
   - The app uses `window.location.origin` as the redirect URI, so it must match
     the deployment URL exactly (including any custom domain you later add).
4. After creating it, note the **Application (client) ID** and
   **Directory (tenant) ID** from the Overview page.

### Expose the API scope

Still in the app registration → **Expose an API**:

1. Set the **Application ID URI** to the default `api://<client-id>`.
2. **Add a scope:**
   - Scope name: `access_as_user`
   - Who can consent: *Admins and users*
   - Fill in the admin/user consent display names and descriptions (any sensible
     text, e.g. "Access Headroom as the signed-in user").
   - State: **Enabled**.
3. The full scope string is then `api://<client-id>/access_as_user` — this is the
   value for `VITE_AZURE_API_SCOPE`.

### (Recommended) Pre-authorize / admin consent

Under **API permissions**, click **Grant admin consent for Nexian** so users
aren't individually prompted on first sign-in.

---

## 3. Vercel project + environment variables

If you haven't already created the Vercel project, import the repo from Git (the
`feature/nexian-initiative-layer` branch, or `main` once merged). `vercel.json`
already sets the build command (`npm run build`), output dir (`dist`), and the
SPA rewrite that leaves `/api/*` alone.

Set these environment variables (**Project → Settings → Environment Variables**),
for Production and Preview as needed:

| Variable | Where it's used | Value |
|---|---|---|
| `DATABASE_URL` | API → Neon | auto-set by the Neon integration (step 1) |
| `VITE_AZURE_CLIENT_ID` | frontend | Entra **Application (client) ID** |
| `VITE_AZURE_TENANT_ID` | frontend | Entra **Directory (tenant) ID** |
| `VITE_AZURE_API_SCOPE` | frontend | `api://<client-id>/access_as_user` |
| `AZURE_CLIENT_ID` | API (token validation) | same client ID, no `VITE_` prefix |
| `AZURE_TENANT_ID` | API (token validation) | same tenant ID, no `VITE_` prefix |
| `AZURE_OPENAI_ENDPOINT` | API (R&D claim AI) | Azure OpenAI resource URL, e.g. `https://<resource>.openai.azure.com`. Leave the AI env unset to disable the feature. |
| `AZURE_OPENAI_DEPLOYMENT` | API (R&D claim AI) | the model deployment name (e.g. `gpt-4o`) |
| `AZURE_OPENAI_API_KEY` | API (R&D claim AI) | resource key (server-side only) |
| `AZURE_OPENAI_API_VERSION` *(optional)* | API (R&D claim AI) | default `2024-10-21` |

> **R&D AI** runs on an **Azure OpenAI deployment in Azure AI Foundry**. Cost is governed by your Azure subscription budgets / cost management (the deployment's tokens-per-minute quota also caps throughput). Per-call output size is capped by `RD_COACH_MAX_TOKENS` / `RD_ASSESS_MAX_TOKENS` (defaults 4000 / 8000). Usage tokens are logged per call in the `rd_ai_audit` table. Auth is the resource api-key today; switching to a managed identity / Entra token is a one-spot change in `api/_lib/aiClient.js`.

> The `VITE_`-prefixed vars are bundled into the client at build time; the
> unprefixed `AZURE_*` vars are read server-side by the functions to verify the
> Entra JWT. They hold the same IDs but must be set separately.

A local `.env.example` documents the same set if you want to test cloud mode on
your machine.

---

## 4. Deploy & verify

1. Trigger a deploy (push to the connected branch, or `vercel --prod`).
2. Open the deployment URL — you should be redirected to a Microsoft sign-in.
3. After signing in, the app loads the shared workspace. The first user to load
   an empty workspace seeds the initial "Headroom Plan" document on the server.
4. Sanity checks:
   - Edits persist across a hard refresh (data is in Neon, not localStorage).
   - A second user signing in sees the same plans.
   - The account name and **Sign out** control appear in the app.

### Troubleshooting

- **Stuck redirect loop / "couldn't start"** — the SPA redirect URI in Entra
  doesn't match the deployment origin exactly, or `VITE_AZURE_*` vars weren't set
  at *build* time (Vite inlines them; re-deploy after setting them).
- **401 from `/api/docs`** — `AZURE_TENANT_ID` / `AZURE_CLIENT_ID` missing or
  wrong on the server side, or admin consent for the API scope not granted.
- **500 "Server auth not configured"** — the unprefixed `AZURE_*` vars are unset.
- **500 from the DB** — `DATABASE_URL` not attached (re-check the Neon integration).

---

## Notes / known follow-ups

- **Stale-write conflicts are handled.** The client sends `lastKnownUpdatedAt`; if
  another user saved in the meantime the server returns `409 + current` and the app
  raises a conflict banner offering **reload theirs / keep mine** (autosave pauses
  until you choose), rather than silently overwriting.
- **Hosting is moving to Azure**, and Microsoft 365 SSO is not yet switched on (the
  app currently runs in shared no-login mode). The full activation/migration
  checklist lives in [`SSO_SNAG_LIST.md`](SSO_SNAG_LIST.md) — including that the
  Vercel-style `/api/*` handlers will need adapting to Azure's function model.
