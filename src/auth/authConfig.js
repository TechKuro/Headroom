// Microsoft Entra (Azure AD) auth via MSAL.
//
// Cloud mode activates only when VITE_AZURE_CLIENT_ID is set. With it absent,
// IS_CLOUD is false and the app runs fully local (localStorage, no sign-in) —
// so `npm run dev` works with zero configuration.
import { PublicClientApplication } from '@azure/msal-browser';

const clientId = import.meta.env.VITE_AZURE_CLIENT_ID;
const tenantId = import.meta.env.VITE_AZURE_TENANT_ID;
export const API_SCOPE = import.meta.env.VITE_AZURE_API_SCOPE;

// Real Microsoft SSO is active only when an Azure client id is configured.
export const IS_SSO = !!clientId;
// Cloud persistence (Neon, shared workspace) can also run WITHOUT login for
// testing, via VITE_CLOUD=1 — the API must then allow anonymous access
// (ALLOW_ANONYMOUS=1 server-side). In that mode users pick a display name on a
// simple landing page instead of signing in.
const FORCE_CLOUD = import.meta.env.VITE_CLOUD === '1' || import.meta.env.VITE_CLOUD === 'true';
export const IS_CLOUD = IS_SSO || FORCE_CLOUD;

export const msalInstance = IS_SSO
  ? new PublicClientApplication({
      auth: {
        clientId,
        authority: `https://login.microsoftonline.com/${tenantId || 'organizations'}`,
        redirectUri: window.location.origin,
      },
      cache: { cacheLocation: 'localStorage' },
    })
  : null;

export function setActiveAccount(account) {
  if (msalInstance && account) msalInstance.setActiveAccount(account);
}

export function getAccount() {
  if (!msalInstance) return null;
  return msalInstance.getActiveAccount() || msalInstance.getAllAccounts()[0] || null;
}

// In no-login (shared) mode the "identity" is just a display name the user
// types on the landing page, kept locally and used to label their edits.
const NAME_KEY = 'headroom-display-name';
export function getDisplayName() {
  try { return localStorage.getItem(NAME_KEY) || null; } catch { return null; }
}
export function setDisplayName(name) {
  try { if (name) localStorage.setItem(NAME_KEY, name); else localStorage.removeItem(NAME_KEY); } catch { /* ignore */ }
}

export function getAccountName() {
  const a = getAccount();
  return a?.name || a?.username || getDisplayName();
}

export function signOut() {
  if (msalInstance) { msalInstance.logoutRedirect(); return; }
  // No-login mode: clear the chosen name and reload back to the landing page.
  setDisplayName(null);
  window.location.reload();
}

// Acquire an access token for our API scope. Returns null when not using SSO.
export async function getAccessToken() {
  if (!IS_SSO || !msalInstance) return null;
  const account = getAccount();
  if (!account) return null;
  try {
    const res = await msalInstance.acquireTokenSilent({ scopes: [API_SCOPE], account });
    return res.accessToken;
  } catch {
    // Silent acquisition failed (consent/expiry) — fall back to interactive.
    await msalInstance.acquireTokenRedirect({ scopes: [API_SCOPE], account });
    return null;
  }
}
