// Document management layer — multiple named plans.
//
// Cloud-only: persists to the serverless API / Neon as a shared workspace
// (last-write-wins, with a stale-write conflict guard). The app reads the doc
// index / active-doc data SYNCHRONOUSLY, so `init()` hydrates an in-memory
// cache once at startup (before the store mounts); mutations update the cache
// and persist in the background. The active-doc id is kept in localStorage as a
// per-browser preference only.
import { getAccountName } from './auth/authConfig';
import { api } from './api';

const ACTIVE_KEY = 'headroom-active-doc';

// --- In-memory cache (source of truth the UI reads synchronously) ---
let _index = [];                 // [{ id, name, lastModified, updatedBy }]
let _data = new Map();           // id -> document data
let _activeId = null;

// Per-doc "base version" we last loaded/saved: { updatedAt, updatedBy }. Used to
// detect when another user has saved over the version we're editing.
let _meta = new Map();           // id -> { updatedAt, updatedBy }

// --- Conflict signalling (shared workspace) ---
// A conflict is raised when our save is rejected as stale ('save'), or when a
// focus-check finds the server copy is newer than ours ('remote'). The UI
// subscribes and offers reload / overwrite. While a conflict is active for the
// current doc, autosave pauses so we don't clobber the other user.
let _conflict = null;            // { id, updatedBy, kind: 'save' | 'remote' } | null
const _conflictListeners = new Set();

function emitConflict() {
  for (const fn of _conflictListeners) fn(_conflict);
}

export function getConflict() {
  return _conflict;
}

export function clearConflict() {
  if (_conflict) { _conflict = null; emitConflict(); }
}

export function subscribeConflict(fn) {
  _conflictListeners.add(fn);
  return () => _conflictListeners.delete(fn);
}

function currentUserLabel() {
  return getAccountName() || 'you';
}

function readActivePref() {
  try { return localStorage.getItem(ACTIVE_KEY); } catch { return null; }
}

// ---------------------------------------------------------------------------
// Synchronous reads (served from cache)
// ---------------------------------------------------------------------------

export function getDocIndex() {
  return _index;
}

export function getActiveDocId() {
  return _activeId;
}

export function getDocName(id) {
  return _index.find(d => d.id === id)?.name || 'Untitled';
}

/** Data for the active document, if already cached (used to seed the store). */
export function getActiveDocData() {
  return _activeId ? _data.get(_activeId) || null : null;
}

/** Who last saved the active doc and when ({ updatedAt, updatedBy }). */
export function getActiveDocMeta() {
  return _activeId ? _meta.get(_activeId) || null : null;
}

export function setActiveDocId(id) {
  // Switching documents clears any conflict raised against the previous one.
  if (_conflict && _conflict.id !== id) { _conflict = null; emitConflict(); }
  _activeId = id;
  try { localStorage.setItem(ACTIVE_KEY, id); } catch { /* ignore */ }
}

export function createEmptyState() {
  return { team: [], projects: [], capacityOverrides: {}, settings: { blendedRate: 110 } };
}

// ---------------------------------------------------------------------------
// Startup hydration
// ---------------------------------------------------------------------------

/** Hydrate the cache from the server. `makeSeed` seeds an empty workspace. */
export async function init({ makeSeed } = {}) {
  const { documents } = await api.listDocs();
  _index = documents.map(d => ({ id: d.id, name: d.name, lastModified: d.updated_at, updatedBy: d.updated_by }));
  for (const d of documents) _meta.set(d.id, { updatedAt: d.updated_at, updatedBy: d.updated_by });

  let activeId = readActivePref();
  if (!activeId || !_index.some(d => d.id === activeId)) {
    activeId = _index[0]?.id || null;
  }

  if (!activeId) {
    // Empty shared workspace — seed the first document on the server.
    const seed = makeSeed ? makeSeed() : createEmptyState();
    const created = await api.createDoc('Headroom Plan', seed);
    const me = currentUserLabel();
    _index = [{ id: created.id, name: created.name, lastModified: created.updated_at, updatedBy: me }];
    _meta.set(created.id, { updatedAt: created.updated_at, updatedBy: me });
    _data.set(created.id, seed);
    setActiveDocId(created.id);
    return;
  }

  const doc = await api.getDoc(activeId);
  _data.set(activeId, doc.data);
  _meta.set(activeId, { updatedAt: doc.updated_at, updatedBy: doc.updated_by });
  setActiveDocId(activeId);
}

/** Re-fetch the document index (menu listing). */
export async function refreshIndex() {
  const { documents } = await api.listDocs();
  // `_meta` (our edit base) is intentionally left alone so a remote save still
  // trips the stale-write guard.
  _index = documents.map(d => ({ id: d.id, name: d.name, lastModified: d.updated_at, updatedBy: d.updated_by }));
  return _index;
}

/**
 * Cheap "has someone else saved this?" check, run on window focus. Compares the
 * server's updated_at for the active doc against our edit base and, if newer,
 * raises a 'remote' conflict so the UI can offer a reload.
 */
export async function checkActiveFreshness() {
  if (!_activeId || _conflict) return;
  const base = _meta.get(_activeId);
  if (!base) return;
  try {
    const { documents } = await api.listDocs();
    const entry = documents.find(d => d.id === _activeId);
    if (entry && new Date(entry.updated_at) > new Date(base.updatedAt)) {
      _conflict = { id: _activeId, updatedBy: entry.updated_by, kind: 'remote' };
      emitConflict();
    }
  } catch { /* offline / transient — ignore */ }
}

/** Reload the active doc from the server, discarding local unsaved edits. */
export async function reloadActive() {
  const id = _activeId;
  const doc = await api.getDoc(id);
  _data.set(id, doc.data);
  _meta.set(id, { updatedAt: doc.updated_at, updatedBy: doc.updated_by });
  const entry = _index.find(d => d.id === id);
  if (entry) { entry.lastModified = doc.updated_at; entry.updatedBy = doc.updated_by; }
  clearConflict();
  return doc.data;
}

/** Force-save local data over whatever is on the server (last-write-wins). */
export async function overwriteActive(data) {
  const id = _activeId;
  _data.set(id, data);
  const fresh = await api.getDoc(id);                 // adopt current server version
  const res = await api.saveDoc(id, data, undefined, fresh.updated_at);
  const me = currentUserLabel();
  _meta.set(id, { updatedAt: res.updated_at, updatedBy: me });
  const entry = _index.find(d => d.id === id);
  if (entry) { entry.lastModified = res.updated_at; entry.updatedBy = me; }
  clearConflict();
}

// ---------------------------------------------------------------------------
// Async mutations (update cache + persist)
// ---------------------------------------------------------------------------

export async function loadDoc(id) {
  const doc = await api.getDoc(id);
  _data.set(id, doc.data);
  _meta.set(id, { updatedAt: doc.updated_at, updatedBy: doc.updated_by });
  return doc.data;
}

export async function saveDoc(id, data, name) {
  _data.set(id, data);
  const entry = _index.find(d => d.id === id);
  if (entry) entry.lastModified = new Date().toISOString();

  const base = _meta.get(id);
  try {
    const res = await api.saveDoc(id, data, name, base?.updatedAt);
    const me = currentUserLabel();
    _meta.set(id, { updatedAt: res.updated_at, updatedBy: me });
    if (entry && res?.updated_at) { entry.lastModified = res.updated_at; entry.updatedBy = me; }
    return { ok: true };
  } catch (err) {
    // Server rejected our save: someone else has written since we loaded.
    // Don't clobber — raise a conflict and let the user choose (reload/overwrite).
    if (err.status === 409 && err.body?.current) {
      const cur = err.body.current;
      _conflict = { id, updatedBy: cur.updated_by, kind: 'save' };
      emitConflict();
      return { ok: false, conflict: true };
    }
    throw err;
  }
}

export async function createDoc(name, data) {
  const seed = data ?? createEmptyState();
  const created = await api.createDoc(name, seed);
  const me = currentUserLabel();
  _index = [{ id: created.id, name: created.name, lastModified: created.updated_at, updatedBy: me }, ..._index];
  _meta.set(created.id, { updatedAt: created.updated_at, updatedBy: me });
  _data.set(created.id, seed);
  return created.id;
}

export async function renameDoc(id, name) {
  const entry = _index.find(d => d.id === id);
  if (entry) entry.name = name;
  await api.renameDoc(id, name);
}

export async function deleteDoc(id) {
  _index = _index.filter(d => d.id !== id);
  _data.delete(id);
  if (_activeId === id) _activeId = null;
  await api.deleteDoc(id);
}
