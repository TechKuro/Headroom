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
import { IS_CLOUD } from './auth/authConfig';
import { api } from './api';

const INDEX_KEY = 'headroom-docs-index';
const ACTIVE_KEY = 'headroom-active-doc';
const DOC_PREFIX = 'headroom-doc-';
const LEGACY_KEY = 'headroom-capacity-planner';

// --- In-memory cache (source of truth the UI reads synchronously) ---
let _index = [];                 // [{ id, name, lastModified }]
let _data = new Map();           // id -> document data
let _activeId = null;

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

export function setActiveDocId(id) {
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
  _index = documents.map(d => ({ id: d.id, name: d.name, lastModified: d.updated_at }));

  let activeId = readLocalActive();
  if (!activeId || !_index.some(d => d.id === activeId)) {
    activeId = _index[0]?.id || null;
  }

  if (!activeId) {
    // Empty shared workspace — seed the first document on the server.
    const seed = makeSeed ? makeSeed() : createEmptyState();
    const created = await api.createDoc('Headroom Plan', seed);
    _index = [{ id: created.id, name: created.name, lastModified: created.updated_at }];
    _data.set(created.id, seed);
    setActiveDocId(created.id);
    return;
  }

  const doc = await api.getDoc(activeId);
  _data.set(activeId, doc.data);
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
    _index = documents.map(d => ({ id: d.id, name: d.name, lastModified: d.updated_at }));
  } else {
    _index = readLocalIndex();
  }
  return _index;
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
    const res = await api.saveDoc(id, data, name);
    if (entry && res?.updated_at) entry.lastModified = res.updated_at;
    return;
  }
  writeLocalDoc(id, data);
  touchLocalIndex(id, now);
}

export async function createDoc(name, data) {
  const seed = data ?? createEmptyState();
  if (IS_CLOUD) {
    const created = await api.createDoc(name, seed);
    _index = [{ id: created.id, name: created.name, lastModified: created.updated_at }, ..._index];
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
