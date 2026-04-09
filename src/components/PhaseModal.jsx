import React, { useState, useMemo } from 'react';
import { useStore, useDispatch } from '../store';
import { genId, calculateLoad, getPhaseIntensity, getCurrentMonth } from '../utils';
import { PHASE_TYPES } from '../constants';

export default function PhaseModal({ projectId, phase, presets, whatIfProject, setWhatIfProject, onClose }) {
  const { team, projects } = useStore();
  const dispatch = useDispatch();

  const isWhatIf = whatIfProject && (projectId === whatIfProject.id || projectId?.startsWith('what-if-'));
  const project = isWhatIf
    ? whatIfProject
    : projects.find(p => p.id === projectId);

  const isEditing = !!phase;

  const [personId, setPersonId] = useState(phase?.personId || presets?.personId || (team[0]?.id ?? ''));
  const [type, setType] = useState(phase?.type || 'active-build');
  const [startMonth, setStartMonth] = useState(phase?.startMonth || presets?.startMonth || getCurrentMonth());
  const [endMonth, setEndMonth] = useState(phase?.endMonth || presets?.endMonth || getCurrentMonth());
  const [intensityOverride, setIntensityOverride] = useState(phase?.intensityOverride);
  const [useOverride, setUseOverride] = useState(phase?.intensityOverride != null);
  const [targetProjectId, setTargetProjectId] = useState(projectId);

  const effectiveIntensity = useOverride && intensityOverride != null ? intensityOverride : PHASE_TYPES[type]?.weight ?? 0;

  // Calculate overcommitment warning
  const warnings = useMemo(() => {
    if (!personId) return [];
    const msgs = [];
    // Check each month in the phase range
    let m = startMonth;
    while (m <= endMonth) {
      let existingLoad = calculateLoad(personId, m, projects, whatIfProject);
      // If editing, subtract the old phase's contribution
      if (isEditing && phase) {
        if (m >= phase.startMonth && m <= phase.endMonth) {
          existingLoad -= getPhaseIntensity(phase);
        }
      }
      const newLoad = existingLoad + effectiveIntensity;
      if (newLoad > 100) {
        const person = team.find(t => t.id === personId);
        msgs.push(`${person?.name || 'Person'} would be at ${newLoad}% in ${m}`);
      }
      // Advance month
      const [y, mo] = m.split('-').map(Number);
      const next = mo === 12 ? `${y + 1}-01` : `${y}-${String(mo + 1).padStart(2, '0')}`;
      m = next;
    }
    return msgs;
  }, [personId, startMonth, endMonth, effectiveIntensity, projects, whatIfProject, phase, isEditing, team]);

  function handleSave() {
    const phaseData = {
      id: phase?.id || genId(),
      personId,
      type,
      startMonth,
      endMonth: endMonth < startMonth ? startMonth : endMonth,
      intensityOverride: useOverride ? (intensityOverride ?? PHASE_TYPES[type].weight) : null,
    };

    const actualProjectId = isWhatIf ? whatIfProject.id : targetProjectId;

    if (isWhatIf) {
      // Mutate what-if project
      if (isEditing) {
        setWhatIfProject(prev => ({
          ...prev,
          phases: prev.phases.map(ph => ph.id === phase.id ? phaseData : ph),
        }));
      } else {
        setWhatIfProject(prev => ({
          ...prev,
          phases: [...prev.phases, phaseData],
        }));
      }
    } else {
      if (isEditing) {
        dispatch({ type: 'UPDATE_PHASE', payload: { projectId: actualProjectId, phase: phaseData } });
      } else {
        dispatch({ type: 'ADD_PHASE', payload: { projectId: actualProjectId, phase: phaseData } });
      }
    }
    onClose();
  }

  function handleDelete() {
    if (!phase) return;
    if (isWhatIf) {
      setWhatIfProject(prev => ({
        ...prev,
        phases: prev.phases.filter(ph => ph.id !== phase.id),
      }));
    } else {
      dispatch({ type: 'REMOVE_PHASE', payload: { projectId: targetProjectId, phaseId: phase.id } });
    }
    onClose();
  }

  const allProjects = whatIfProject ? [...projects, whatIfProject] : projects;

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h2>{isEditing ? 'Edit Phase' : 'Add Phase'}</h2>
          <button className="icon-btn" onClick={onClose}>×</button>
        </div>

        <div className="modal-body">
          {/* Project selector (for add mode) */}
          {!isEditing && (
            <div className="form-group">
              <label>Project</label>
              <select value={targetProjectId} onChange={e => setTargetProjectId(e.target.value)} className="form-select">
                {allProjects.map(p => (
                  <option key={p.id} value={p.id}>
                    {p.name}{p.isWhatIf ? ' (What-If)' : ''}
                  </option>
                ))}
              </select>
            </div>
          )}

          <div className="form-group">
            <label>Team Member</label>
            <select value={personId} onChange={e => setPersonId(e.target.value)} className="form-select">
              {team.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
            </select>
          </div>

          <div className="form-group">
            <label>Phase Type</label>
            <select value={type} onChange={e => setType(e.target.value)} className="form-select">
              {Object.entries(PHASE_TYPES).map(([key, val]) => (
                <option key={key} value={key}>{val.label} ({val.weight}%)</option>
              ))}
            </select>
          </div>

          <div className="form-row">
            <div className="form-group">
              <label>Start Month</label>
              <input type="month" value={startMonth} onChange={e => setStartMonth(e.target.value)} className="form-input" />
            </div>
            <div className="form-group">
              <label>End Month</label>
              <input type="month" value={endMonth} onChange={e => setEndMonth(e.target.value)} className="form-input" />
            </div>
          </div>

          <div className="form-group intensity-group">
            <label className="checkbox-label">
              <input type="checkbox" checked={useOverride} onChange={e => {
                setUseOverride(e.target.checked);
                if (e.target.checked && intensityOverride == null) {
                  setIntensityOverride(PHASE_TYPES[type]?.weight ?? 50);
                }
              }} />
              Override intensity
            </label>
            {useOverride && (
              <div className="intensity-slider">
                <input
                  type="range"
                  min="0" max="150" step="5"
                  value={intensityOverride ?? 50}
                  onChange={e => setIntensityOverride(Number(e.target.value))}
                />
                <span className="intensity-value">{intensityOverride ?? 50}%</span>
              </div>
            )}
            {!useOverride && (
              <span className="intensity-default">Default: {PHASE_TYPES[type]?.weight ?? 0}%</span>
            )}
          </div>

          {/* Overcommitment warnings */}
          {warnings.length > 0 && (
            <div className="overcommit-warning">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/>
                <line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/>
              </svg>
              <div>
                <strong>Overcommitment Warning</strong>
                {warnings.slice(0, 3).map((w, i) => <div key={i}>{w}</div>)}
                {warnings.length > 3 && <div>…and {warnings.length - 3} more</div>}
              </div>
            </div>
          )}
        </div>

        <div className="modal-footer">
          {isEditing && (
            <button className="btn btn-danger" onClick={handleDelete}>Delete</button>
          )}
          <div className="modal-spacer" />
          <button className="btn btn-secondary" onClick={onClose}>Cancel</button>
          <button className="btn btn-primary" onClick={handleSave}>
            {isEditing ? 'Save' : 'Add Phase'}
          </button>
        </div>
      </div>
    </div>
  );
}
