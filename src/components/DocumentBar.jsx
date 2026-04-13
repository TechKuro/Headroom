import React, { useState, useRef, useEffect } from 'react';
import { useDispatch } from '../store';
import * as docs from '../docManager';
import { addToast } from '../toast';

export default function DocumentBar({ activeDocId, setActiveDocId }) {
  const dispatch = useDispatch();
  const [menuOpen, setMenuOpen] = useState(false);
  const [renaming, setRenaming] = useState(false);
  const [docName, setDocName] = useState(docs.getDocName(activeDocId));
  const menuRef = useRef();
  const inputRef = useRef();

  // Sync name when active doc changes
  useEffect(() => {
    setDocName(docs.getDocName(activeDocId));
  }, [activeDocId]);

  // Close menu on outside click
  useEffect(() => {
    if (!menuOpen) return;
    function handleClick(e) {
      if (menuRef.current && !menuRef.current.contains(e.target)) setMenuOpen(false);
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [menuOpen]);

  // Focus input when renaming
  useEffect(() => {
    if (renaming && inputRef.current) inputRef.current.select();
  }, [renaming]);

  const allDocs = docs.getDocIndex();
  const otherDocs = allDocs.filter(d => d.id !== activeDocId);

  function handleRename() {
    const trimmed = docName.trim() || 'Untitled';
    docs.renameDoc(activeDocId, trimmed);
    setDocName(trimmed);
    setRenaming(false);
  }

  function handleNew() {
    const name = prompt('New plan name:');
    if (!name?.trim()) return;
    const id = docs.createDoc(name.trim());
    const emptyState = docs.createEmptyState();
    docs.saveDoc(id, emptyState);
    docs.setActiveDocId(id);
    setActiveDocId(id);
    dispatch({ type: 'LOAD_DOCUMENT', payload: emptyState });
    setMenuOpen(false);
    addToast(`Created "${name.trim()}"`, 'success');
  }

  function handleSaveAsCopy() {
    const currentName = docs.getDocName(activeDocId);
    const name = prompt('Save copy as:', currentName + ' (copy)');
    if (!name?.trim()) return;
    const id = docs.createDoc(name.trim());
    // The current state will be saved by the store's auto-save effect once we switch
    // But we want to save the CURRENT state to the new doc first
    const currentData = docs.loadDoc(activeDocId);
    if (currentData) docs.saveDoc(id, currentData);
    docs.setActiveDocId(id);
    setActiveDocId(id);
    setMenuOpen(false);
    addToast(`Saved copy as "${name.trim()}"`, 'success');
  }

  function handleLoad(id) {
    const data = docs.loadDoc(id);
    if (!data) {
      addToast('Failed to load document.', 'error');
      return;
    }
    docs.setActiveDocId(id);
    setActiveDocId(id);
    dispatch({ type: 'LOAD_DOCUMENT', payload: data });
    setMenuOpen(false);
    addToast(`Loaded "${docs.getDocName(id)}"`, 'success');
  }

  function handleDelete(id, e) {
    e.stopPropagation();
    const name = docs.getDocName(id);
    if (!confirm(`Delete "${name}"? This cannot be undone.`)) return;
    docs.deleteDoc(id);

    // If we deleted the active doc, switch to another or create new
    if (id === activeDocId) {
      const remaining = docs.getDocIndex();
      if (remaining.length > 0) {
        handleLoad(remaining[0].id);
      } else {
        handleNew();
      }
    }
    setMenuOpen(false);
    addToast(`Deleted "${name}"`, 'success');
  }

  function handlePdfExport() {
    setMenuOpen(false);
    // Small delay to let menu close, then trigger print
    setTimeout(() => window.print(), 100);
  }

  function formatDate(iso) {
    if (!iso) return '';
    const d = new Date(iso);
    return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
  }

  return (
    <div className="doc-bar" ref={menuRef}>
      {renaming ? (
        <form onSubmit={e => { e.preventDefault(); handleRename(); }} className="doc-rename-form">
          <input
            ref={inputRef}
            value={docName}
            onChange={e => setDocName(e.target.value)}
            onBlur={handleRename}
            className="doc-rename-input"
            autoFocus
          />
        </form>
      ) : (
        <button className="doc-name-btn" onClick={() => setMenuOpen(m => !m)} title="Document menu">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/>
          </svg>
          <span className="doc-name-text">{docName}</span>
          <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="6 9 12 15 18 9"/></svg>
        </button>
      )}

      {menuOpen && (
        <div className="doc-menu">
          <button className="doc-menu-item" onClick={() => { setMenuOpen(false); setRenaming(true); }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
            Rename
          </button>
          <button className="doc-menu-item" onClick={handleNew}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="12" y1="18" x2="12" y2="12"/><line x1="9" y1="15" x2="15" y2="15"/></svg>
            New Plan
          </button>
          <button className="doc-menu-item" onClick={handleSaveAsCopy}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>
            Save As Copy
          </button>

          <div className="doc-menu-divider" />

          <button className="doc-menu-item" onClick={handlePdfExport}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M6 9V2h12v7"/><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/><rect x="6" y="14" width="12" height="8"/></svg>
            Export to PDF
          </button>

          {otherDocs.length > 0 && (
            <>
              <div className="doc-menu-divider" />
              <div className="doc-menu-label">Saved Plans</div>
              {otherDocs.map(d => (
                <div key={d.id} className="doc-menu-item doc-load-item" onClick={() => handleLoad(d.id)}>
                  <div className="doc-load-info">
                    <span className="doc-load-name">{d.name}</span>
                    <span className="doc-load-date">{formatDate(d.lastModified)}</span>
                  </div>
                  <button className="doc-delete-btn" onClick={e => handleDelete(d.id, e)} title="Delete">
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
                  </button>
                </div>
              ))}
            </>
          )}

          {activeDocId && (
            <>
              <div className="doc-menu-divider" />
              <button className="doc-menu-item doc-menu-danger" onClick={e => handleDelete(activeDocId, e)}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
                Delete This Plan
              </button>
            </>
          )}
        </div>
      )}
    </div>
  );
}
