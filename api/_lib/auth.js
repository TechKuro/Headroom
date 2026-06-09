// Validates Microsoft Entra (Azure AD) access tokens on the API side.
// The SPA acquires an access token for this app's custom scope via MSAL and
// sends it as `Authorization: Bearer <token>`. We verify the signature against
// Entra's published JWKS and check issuer + audience.
import { jwtVerify, createRemoteJWKSet } from 'jose';
import { parseAllowlist, isManagerIdentity } from './roles.js';

const tenantId = process.env.AZURE_TENANT_ID;
const clientId = process.env.AZURE_CLIENT_ID;

const JWKS = createRemoteJWKSet(
  new URL(`https://login.microsoftonline.com/${tenantId}/discovery/v2.0/keys`)
);

function httpError(status, message) {
  const e = new Error(message);
  e.status = status;
  return e;
}

export async function requireUser(req) {
  // Temporary shared-workspace mode: skip token verification and treat everyone
  // as one anonymous user. Pair with Vercel deployment protection, since the
  // API is then open. Use a per-request display name if the client sent one.
  if (process.env.ALLOW_ANONYMOUS === '1' || process.env.ALLOW_ANONYMOUS === 'true') {
    const name = req.headers['x-display-name'] || null;
    return { id: 'shared', email: name ? `${name} (shared)` : 'shared@headroom.local', name: name || 'Shared workspace' };
  }

  if (!tenantId || !clientId) {
    throw httpError(500, 'Server auth not configured (AZURE_TENANT_ID / AZURE_CLIENT_ID)');
  }

  const header = req.headers['authorization'] || req.headers['Authorization'];
  if (!header || !header.startsWith('Bearer ')) {
    throw httpError(401, 'Missing bearer token');
  }
  const token = header.slice(7);

  let payload;
  try {
    ({ payload } = await jwtVerify(token, JWKS, {
      // Accept both v2.0 and v1.0 issuer formats for the tenant.
      issuer: [
        `https://login.microsoftonline.com/${tenantId}/v2.0`,
        `https://sts.windows.net/${tenantId}/`,
      ],
      // Tokens for our exposed API scope carry the app id (GUID) or api:// URI.
      audience: [clientId, `api://${clientId}`],
    }));
  } catch {
    throw httpError(401, 'Invalid or expired token');
  }

  return {
    id: payload.oid || payload.sub || null,
    email: payload.preferred_username || payload.upn || payload.email || null,
    name: payload.name || null,
  };
}

// Like requireUser, but also requires the caller to be a manager — used for the
// privileged time transitions (authorise, lock). Enforcement is opt-in: with no
// MANAGER_NAMES/MANAGER_EMAILS configured the gate is open (pre-SSO/shared mode
// keeps working); set either list to switch enforcement on. 403 if not allowed.
export async function requireManager(req) {
  const user = await requireUser(req);
  const names = parseAllowlist(process.env.MANAGER_NAMES);
  const emails = parseAllowlist(process.env.MANAGER_EMAILS);
  if (names.length === 0 && emails.length === 0) return user; // not configured → open
  if (isManagerIdentity(user, { names, emails })) return user;
  throw httpError(403, 'Only managers can authorise or lock time.');
}
