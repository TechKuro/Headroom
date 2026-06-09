// Authoriser (manager) allow-listing for the time sign-off endpoints.
//
// Kept as pure functions, separate from auth.js, so the matching logic is
// unit-testable without pulling in token verification.
//
// Today the allow-list is env-driven (MANAGER_NAMES / MANAGER_EMAILS). Once the
// app runs on Azure with Entra sign-in, this is the natural place to switch to
// Entra app-role / group claims instead of name/email matching — extend
// isManagerIdentity to also check a user.roles array. See docs/SSO_SNAG_LIST.md.

// Parse a comma-separated env value into a normalised (trimmed, lower-cased) list.
export function parseAllowlist(value) {
  return String(value || '')
    .split(',')
    .map(s => s.trim().toLowerCase())
    .filter(Boolean);
}

// True when the user's name or email is on the manager allow-list.
export function isManagerIdentity(user, { names = [], emails = [] } = {}) {
  const name = String(user?.name || '').trim().toLowerCase();
  const email = String(user?.email || '').trim().toLowerCase();
  return (!!name && names.includes(name)) || (!!email && emails.includes(email));
}

// Whether manager enforcement is configured at all. When neither list is set,
// the sign-off endpoints stay open (advisory) so a shared, pre-SSO deployment
// keeps working — enforcement switches on the moment an allow-list is provided.
export function managerEnforcementEnabled() {
  return parseAllowlist(process.env.MANAGER_NAMES).length > 0
    || parseAllowlist(process.env.MANAGER_EMAILS).length > 0;
}
