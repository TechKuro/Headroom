import React, { useRef } from 'react';
import { useStore, useDispatch } from '../store';
import { genId, projectsFromWorkloadCsv } from '../utils';
import { addToast } from '../toast';

// "Import CSV" — appends projects parsed from a SharePoint-style workload export
// to the current plan (non-destructive, one undo step). Maps only the columns
// with a sensible Headroom home; see projectsFromWorkloadCsv.
export default function ImportProjectsButton() {
  const { projects } = useStore();
  const dispatch = useDispatch();
  const fileRef = useRef(null);

  async function onFile(e) {
    const file = e.target.files?.[0];
    e.target.value = ''; // allow re-importing the same file
    if (!file) return;
    try {
      const text = await file.text();
      const { projects: parsed, skipped } = projectsFromWorkloadCsv(text, { startColorIndex: projects.length });
      if (!parsed.length) {
        addToast('No projects found — expected a CSV with a "Task Name" column.', 'error');
        return;
      }
      const withIds = parsed.map(p => ({ ...p, id: genId() }));
      dispatch({ type: 'IMPORT_PROJECTS', payload: withIds });
      addToast(
        `Imported ${withIds.length} project${withIds.length === 1 ? '' : 's'}${skipped ? ` · skipped ${skipped} blank row${skipped === 1 ? '' : 's'}` : ''}`,
        'success',
      );
    } catch {
      addToast('Could not read that CSV file.', 'error');
    }
  }

  return (
    <>
      <button type="button" className="text-btn-sm" onClick={() => fileRef.current?.click()} title="Import projects from a CSV">
        Import CSV
      </button>
      <input ref={fileRef} type="file" accept=".csv,text/csv" style={{ display: 'none' }} onChange={onFile} />
    </>
  );
}
