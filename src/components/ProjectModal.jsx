import React, { useState, useEffect, useRef } from 'react';
import { useDispatch } from '../store';
import { genId, getInitiative, getProjectLabourSummary, getProgress } from '../utils';
import { PROJECT_COLORS, INITIATIVE_TYPES, INITIATIVE_STATUSES } from '../constants';
import { useProjectHours } from '../timeSummary';
import { useFocusTrap } from '../a11y';

// Pop-out card for creating / editing a project and its initiative details in
// one place. Phases stay on the expandable sidebar row (allocation, not setup).
export default function ProjectModal({ project, defaultColor, onClose }) {
  const dispatch = useDispatch();
  const isEditing = !!project;
  const init = getInitiative(project);

  const [name, setName] = useState(project?.name ?? '');
  const [start, setStart] = useState(project?.start ?? '');
  const [deadline, setDeadline] = useState(project?.deadline ?? '');
  const [color, setColor] = useState(project?.color ?? defaultColor ?? PROJECT_COLORS[0]);
  const [type, setType] = useState(init.type);
  const [status, setStatus] = useState(init.status);
  // Blank for a new project so the mandatory field isn't pre-filled with 0.
  const [estimatedValue, setEstimatedValue] = useState(project ? init.estimatedValue : '');
  const [valueNote, setValueNote] = useState(init.valueNote);
  const [description, setDescription] = useState(init.description);
  const [chargeable, setChargeable] = useState(init.chargeable);

  const modalRef = useRef(null);
  useFocusTrap(modalRef);

  useEffect(() => {
    const onKey = e => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  // Progress is derived (confirmed time ÷ planned work) — read-only, edit only.
  const { hoursByProject } = useProjectHours();
  const progress = isEditing
    ? getProgress(getProjectLabourSummary(project, 0).totalHours, hoursByProject[project.id] || 0)
    : null;

  const canSave = name.trim().length > 0 && Number(estimatedValue) > 0;

  function save(e) {
    e.preventDefault();
    if (!canSave) return;
    const initiative = {
      type, status, chargeable,
      estimatedValue: Math.max(0, Math.round(Number(estimatedValue) || 0)),
      valueNote: valueNote.trim(),
      description: description.trim(),
    };
    if (isEditing) {
      dispatch({ type: 'UPDATE_PROJECT', payload: { id: project.id, name: name.trim(), color, start, deadline, initiative } });
    } else {
      dispatch({ type: 'ADD_PROJECT', payload: { id: genId(), name: name.trim(), color, start, deadline, phases: [], initiative } });
    }
    onClose();
  }

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" role="dialog" aria-modal="true" aria-labelledby="project-modal-title"
        ref={modalRef} tabIndex={-1} onClick={e => e.stopPropagation()}>
        <form onSubmit={save}>
          <div className="modal-header">
            <h2 id="project-modal-title">{isEditing ? 'Edit project' : 'Add project'}</h2>
            <button type="button" className="icon-btn" onClick={onClose} aria-label="Close">×</button>
          </div>

          <div className="modal-body">
            <div className="form-group">
              <label htmlFor="project-name">Name <span className="req">*</span></label>
              <input id="project-name" className="form-input" autoFocus value={name}
                onChange={e => setName(e.target.value)} placeholder="e.g. Acme Portal Redesign" />
            </div>

            <div className="form-row">
              <div className="form-group">
                <label htmlFor="project-start">Start</label>
                <input id="project-start" type="date" className="form-input" value={start}
                  onChange={e => setStart(e.target.value)} />
              </div>
              <div className="form-group">
                <label htmlFor="project-deadline">Deadline</label>
                <input id="project-deadline" type="date" className="form-input" value={deadline}
                  onChange={e => setDeadline(e.target.value)} />
              </div>
            </div>

            <div className="form-group">
              <label>Colour</label>
              <div className="color-picker">
                {PROJECT_COLORS.map(c => (
                  <button type="button" key={c} className={`color-swatch ${color === c ? 'active' : ''}`}
                    style={{ background: c }} aria-label={`Colour ${c}`} onClick={() => setColor(c)} />
                ))}
              </div>
            </div>

            <div className="form-group">
              <label>Type</label>
              <div className="seg-group">
                {Object.entries(INITIATIVE_TYPES).map(([k, v]) => (
                  <button type="button" key={k} className={`seg-btn ${type === k ? 'active' : ''}`}
                    onClick={() => setType(k)}>{v.label}</button>
                ))}
              </div>
            </div>

            <div className="form-row">
              <div className="form-group">
                <label htmlFor="project-status">Status</label>
                <select id="project-status" className="form-select" value={status} onChange={e => setStatus(e.target.value)}>
                  {Object.entries(INITIATIVE_STATUSES).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
                </select>
              </div>
              <div className="form-group">
                <label htmlFor="project-value">Est. value £ <span className="req">*</span></label>
                <input id="project-value" type="number" min="0" className="form-input" value={estimatedValue}
                  placeholder="0" onChange={e => setEstimatedValue(e.target.value)} />
              </div>
            </div>

            {isEditing && (
              <div className="form-group">
                <label>Progress</label>
                <div className="init-progress-edit">
                  <span className="init-progress-pct">{progress.pct == null ? '—' : `${progress.pct}%`}</span>
                  <span className="init-progress-hint">{progress.pct == null ? 'no planned work yet' : 'from confirmed time'}</span>
                </div>
              </div>
            )}

            <div className="form-group">
              <label htmlFor="project-valuenote">Value note</label>
              <input id="project-valuenote" type="text" className="form-input" value={valueNote}
                placeholder="e.g. Fixed-price engagement" onChange={e => setValueNote(e.target.value)} />
            </div>

            <div className="form-group">
              <label htmlFor="project-desc">Description</label>
              <textarea id="project-desc" className="form-input" rows={3} value={description}
                placeholder="What is this project and what's the goal? Shown on the Standup card."
                onChange={e => setDescription(e.target.value)} />
            </div>

            <label className="init-checkbox">
              <input type="checkbox" checked={chargeable} onChange={e => setChargeable(e.target.checked)} />
              Chargeable
            </label>
          </div>

          <div className="modal-footer">
            <div className="modal-spacer" />
            <button type="button" className="btn btn-secondary" onClick={onClose}>Cancel</button>
            <button type="submit" className="btn btn-primary" disabled={!canSave}>
              {isEditing ? 'Save changes' : 'Save'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
