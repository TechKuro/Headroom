import React, { useRef } from 'react';
import { useStore, useDispatch } from '../store';

export default function ExportImport() {
  const store = useStore();
  const dispatch = useDispatch();
  const fileRef = useRef();

  function handleExport() {
    const data = JSON.stringify(store, null, 2);
    const blob = new Blob([data], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `headroom-export-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }

  function handleImport(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const data = JSON.parse(reader.result);
        if (data.team && data.projects) {
          dispatch({ type: 'IMPORT_DATA', payload: data });
        } else {
          alert('Invalid file format. Expected { team, projects }.');
        }
      } catch {
        alert('Failed to parse JSON file.');
      }
    };
    reader.readAsText(file);
    // Reset input so the same file can be re-imported
    e.target.value = '';
  }

  return (
    <div className="export-import">
      <button className="icon-btn" onClick={handleExport} title="Export JSON">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/>
        </svg>
      </button>
      <button className="icon-btn" onClick={() => fileRef.current?.click()} title="Import JSON">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/>
        </svg>
      </button>
      <input ref={fileRef} type="file" accept=".json" onChange={handleImport} style={{ display: 'none' }} />
    </div>
  );
}
