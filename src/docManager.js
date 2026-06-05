// Document management layer — multiple named plans.
//
// Dual-mode:
//  • local mode  (default): persists to localStorage, no sign-in.
//  • cloud mode  (IS_CLOUD): persists to the serverless API / Neon, shared
//    workspace, last-write-wins.
//
// The app reads the doc index / active-doc data SYNCHRONOUSLY. To support an
// async backend we keep an in-memory cache that `init()` hydrates once at
// startup (before the store mounts). Mutations update the cache synchronously
// and persist in the background.
import { IS_CLOUD, getAccountName } from './auth/authConfig';
import { api } from './api';

const INDEX_KEY = 'headroom-docs-index';
const ACTIVE_KEY = 'headroom-active-doc';
const DOC_PREFIX = 'headroom-doc-';
const LEGACY_KEY = 'headroom-capacity-planner';

// --- In-memory cache (source of truth the UI reads synchronously) ---
let _index = [];                 // [{ id, name, lastModified, updatedBy }]
let _data = new Map();           // id -> document data
let _activeId = null;

// Per-doc "base version" we last loaded/saved: { updatedAt, updatedBy }. Used to
// detect when another user has saved over the version we're editing (cloud only).
let _meta = new Map();           // id -> { updatedAt, updatedBy }

// --- Conflict signalling (cloud, shared workspace) ---
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

/** Who last saved the active doc and when ({ updatedAt, updatedBy }) — cloud only. */
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
  return { team: [], projects: [], capacityOverrides: {}, settings: { blendedRate: 45 } };
}

// ---------------------------------------------------------------------------
// Startup hydration
// ---------------------------------------------------------------------------

/** Hydrate the cache. `makeSeed` produces initial data for an empty workspace. */
export async function init({ makeSeed } = {}) {
  if (IS_CLOUD) return initCloud(makeSeed);
  return initLocal();
}

async function initCloud(makeSeed) {
  const { documents } = await api.listDocs();
  _index = documents.map(d => ({ id: d.id, name: d.name, lastModified: d.updated_at, updatedBy: d.updated_by }));
  for (const d of documents) _meta.set(d.id, { updatedAt: d.updated_at, updatedBy: d.updated_by });

  let activeId = readLocalActive();
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

function initLocal() {
  migrateLegacyIfNeeded();
  _index = readLocalIndex();
  let activeId = readLocalActive();
  if (!activeId || !_index.some(d => d.id === activeId)) {
    activeId = _index[0]?.id || null;
  }
  if (activeId) {
    const data = readLocalDoc(activeId);
    if (data) _data.set(activeId, data);
    _activeId = activeId;
  }
}

/** Re-fetch the document index (cloud) or re-read it (local). */
export async function refreshIndex() {
  if (IS_CLOUD) {
    const { documents } = await api.listDocs();
    // Updates the menu listing only — `_meta` (our edit base) is intentionally
    // left alone so a remote save still trips the stale-write guard.
    _index = documents.map(d => ({ id: d.id, name: d.name, lastModified: d.updated_at, updatedBy: d.updated_by }));
  } else {
    _index = readLocalIndex();
  }
  return _index;
}

/**
 * Cheap "has someone else saved this?" check, run on window focus (cloud only).
 * Compares the server's updated_at for the active doc against our edit base and,
 * if newer, raises a 'remote' conflict so the UI can offer a reload.
 */
export async function checkActiveFreshness() {
  if (!IS_CLOUD || !_activeId || _conflict) return;
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
  if (_data.has(id)) {
    // Cloud: refresh from server so we see others' changes; local: cache is truth.
    if (!IS_CLOUD) return _data.get(id);
  }
  if (IS_CLOUD) {
    const doc = await api.getDoc(id);
    _data.set(id, doc.data);
    _meta.set(id, { updatedAt: doc.updated_at, updatedBy: doc.updated_by });
    return doc.data;
  }
  const data = readLocalDoc(id);
  if (data) _data.set(id, data);
  return data;
}

export async function saveDoc(id, data, name) {
  _data.set(id, data);
  const now = new Date().toISOString();
  const entry = _index.find(d => d.id === id);
  if (entry) entry.lastModified = now;

  if (IS_CLOUD) {
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
  writeLocalDoc(id, data);
  touchLocalIndex(id, now);
  return { ok: true };
}

export async function createDoc(name, data) {
  const seed = data ?? createEmptyState();
  if (IS_CLOUD) {
    const created = await api.createDoc(name, seed);
    const me = currentUserLabel();
    _index = [{ id: created.id, name: created.name, lastModified: created.updated_at, updatedBy: me }, ..._index];
    _meta.set(created.id, { updatedAt: created.updated_at, updatedBy: me });
    _data.set(created.id, seed);
    return created.id;
  }
  const id = String(Date.now());
  const index = readLocalIndex();
  index.unshift({ id, name, createdAt: new Date().toISOString(), lastModified: new Date().toISOString() });
  writeLocalIndex(index);
  writeLocalDoc(id, seed);
  _index = index;
  _data.set(id, seed);
  return id;
}

export async function renameDoc(id, name) {
  const entry = _index.find(d => d.id === id);
  if (entry) entry.name = name;
  if (IS_CLOUD) {
    await api.renameDoc(id, name);
    return;
  }
  const index = readLocalIndex();
  const e = index.find(d => d.id === id);
  if (e) { e.name = name; writeLocalIndex(index); }
}

export async function deleteDoc(id) {
  _index = _index.filter(d => d.id !== id);
  _data.delete(id);
  if (_activeId === id) _activeId = null;
  if (IS_CLOUD) {
    await api.deleteDoc(id);
    return;
  }
  const index = readLocalIndex().filter(d => d.id !== id);
  writeLocalIndex(index);
  try { localStorage.removeItem(DOC_PREFIX + id); } catch { /* ignore */ }
  if (readLocalActive() === id) {
    try { localStorage.removeItem(ACTIVE_KEY); } catch { /* ignore */ }
  }
}

// ---------------------------------------------------------------------------
// localStorage helpers (local mode only)
// ---------------------------------------------------------------------------

function readLocalIndex() {
  try { return JSON.parse(localStorage.getItem(INDEX_KEY)) || []; } catch { return []; }
}
function writeLocalIndex(index) {
  localStorage.setItem(INDEX_KEY, JSON.stringify(index));
}
function readLocalActive() {
  try { return localStorage.getItem(ACTIVE_KEY); } catch { return null; }
}
function readLocalDoc(id) {
  try {
    const raw = localStorage.getItem(DOC_PREFIX + id);
    if (raw) {
      const data = JSON.parse(raw);
      return { ...data, capacityOverrides: data.capacityOverrides || {} };
    }
  } catch { /* ignore */ }
  return null;
}
function writeLocalDoc(id, data) {
  localStorage.setItem(DOC_PREFIX + id, JSON.stringify(data));
}
function touchLocalIndex(id, iso) {
  const index = readLocalIndex();
  const entry = index.find(d => d.id === id);
  if (entry) { entry.lastModified = iso; writeLocalIndex(index); }
}

// Migrate legacy single-save data and ensure a doc exists (local mode).
function migrateLegacyIfNeeded() {
  const index = readLocalIndex();
  const activeId = readLocalActive();
  if (index.length > 0 && activeId && readLocalDoc(activeId)) return;

  try {
    const legacy = localStorage.getItem(LEGACY_KEY);
    if (legacy) {
      const data = JSON.parse(legacy);
      if (data.team && data.projects) {
        const id = String(Date.now());
        writeLocalIndex([{ id, name: 'My Plan', createdAt: new Date().toISOString(), lastModified: new Date().toISOString() }]);
        writeLocalDoc(id, data);
        localStorage.setItem(ACTIVE_KEY, id);
        localStorage.removeItem(LEGACY_KEY);
        return;
      }
    }
  } catch { /* ignore */ }

  if (index.length === 0 || !activeId) {
    const id = String(Date.now());
    if (index.length === 0) writeLocalIndex([{ id, name: 'Sample Plan', createdAt: new Date().toISOString(), lastModified: new Date().toISOString() }]);
    localStorage.setItem(ACTIVE_KEY, index.length === 0 ? id : (index[0]?.id || id));
  }
}
