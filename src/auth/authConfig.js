// Microsoft Entra (Azure AD) auth via MSAL.
//
// Cloud mode activates only when VITE_AZURE_CLIENT_ID is set. With it absent,
// IS_CLOUD is false and the app runs fully local (localStorage, no sign-in) —
// so `npm run dev` works with zero configuration.
import { PublicClientApplication } from '@azure/msal-browser';

const clientId = import.meta.env.VITE_AZURE_CLIENT_ID;
const tenantId = import.meta.env.VITE_AZURE_TENANT_ID;
export const API_SCOPE = import.meta.env.VITE_AZURE_API_SCOPE;
export const IS_CLOUD = !!clientId;

export const msalInstance = IS_CLOUD
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

export function getAccountName() {
  const a = getAccount();
  return a?.name || a?.username || null;
}

export function signOut() {
  if (msalInstance) msalInstance.logoutRedirect();
}

// Acquire an access token for our API scope. Returns null in local mode.
export async function getAccessToken() {
  if (!IS_CLOUD || !msalInstance) return null;
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
