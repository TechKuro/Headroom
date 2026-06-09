import React, { useRef } from 'react';
import { useStore, useDispatch } from '../store';
import { genId, projectsFromWorkloadCsv, reconcileImportedProjects } from '../utils';
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
      // Upsert by name: update projects already present, add genuinely new ones.
      const { projects: next, added, updated } = reconcileImportedProjects(projects, parsed, genId);
      dispatch({ type: 'SET_PROJECTS', payload: next });
      const bits = [`${added} added`];
      if (updated) bits.push(`${updated} updated`);
      if (skipped) bits.push(`skipped ${skipped} blank`);
      addToast(`Import: ${bits.join(' · ')}`, 'success');
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
