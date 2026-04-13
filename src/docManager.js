// Document management layer — multiple named plans in localStorage

const INDEX_KEY = 'headroom-docs-index';
const ACTIVE_KEY = 'headroom-active-doc';
const DOC_PREFIX = 'headroom-doc-';
const LEGACY_KEY = 'headroom-capacity-planner';

export function getDocIndex() {
  try {
    return JSON.parse(localStorage.getItem(INDEX_KEY)) || [];
  } catch { return []; }
}

function saveIndex(index) {
  localStorage.setItem(INDEX_KEY, JSON.stringify(index));
}

export function getActiveDocId() {
  return localStorage.getItem(ACTIVE_KEY);
}

export function setActiveDocId(id) {
  localStorage.setItem(ACTIVE_KEY, id);
}

export function loadDoc(id) {
  try {
    const raw = localStorage.getItem(DOC_PREFIX + id);
    if (raw) {
      const data = JSON.parse(raw);
      return { ...data, capacityOverrides: data.capacityOverrides || {} };
    }
  } catch { /* ignore */ }
  return null;
}

export function saveDoc(id, data) {
  localStorage.setItem(DOC_PREFIX + id, JSON.stringify(data));
  const index = getDocIndex();
  const entry = index.find(d => d.id === id);
  if (entry) {
    entry.lastModified = new Date().toISOString();
    saveIndex(index);
  }
}

export function createDoc(name) {
  const id = String(Date.now());
  const index = getDocIndex();
  index.push({ id, name, createdAt: new Date().toISOString(), lastModified: new Date().toISOString() });
  saveIndex(index);
  return id;
}

export function renameDoc(id, name) {
  const index = getDocIndex();
  const entry = index.find(d => d.id === id);
  if (entry) {
    entry.name = name;
    saveIndex(index);
  }
}

export function deleteDoc(id) {
  const index = getDocIndex().filter(d => d.id !== id);
  saveIndex(index);
  localStorage.removeItem(DOC_PREFIX + id);
  if (getActiveDocId() === id) {
    localStorage.removeItem(ACTIVE_KEY);
  }
}

export function getDocName(id) {
  return getDocIndex().find(d => d.id === id)?.name || 'Untitled';
}

// Migrate legacy single-save data into the document system
export function migrateIfNeeded() {
  const index = getDocIndex();
  const activeId = getActiveDocId();

  // Already set up
  if (index.length > 0 && activeId && loadDoc(activeId)) return;

  // Try migrating legacy data
  try {
    const legacy = localStorage.getItem(LEGACY_KEY);
    if (legacy) {
      const data = JSON.parse(legacy);
      if (data.team && data.projects) {
        const id = createDoc('My Plan');
        saveDoc(id, data);
        setActiveDocId(id);
        localStorage.removeItem(LEGACY_KEY);
        return;
      }
    }
  } catch { /* ignore */ }

  // Nothing to migrate, no docs exist — create a placeholder
  // (the store will populate it with sample data)
  if (index.length === 0 || !activeId) {
    const id = createDoc('Sample Plan');
    setActiveDocId(id);
  }
}

export function createEmptyState() {
  return { team: [], projects: [], capacityOverrides: {} };
}
