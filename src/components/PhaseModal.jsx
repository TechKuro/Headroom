import React, { useState, useMemo } from 'react';
import { useStore, useDispatch } from '../store';
import { genId, calculateLoad, getPhaseIntensity, getProjectEndMonth, getUrgencyFactor, getCurrentDate, dateToMonth, monthCoverageFraction, getPhasePersonIds } from '../utils';
import { PHASE_TYPES } from '../constants';

export default function PhaseModal({ projectId, phase, presets, whatIfProject, setWhatIfProject, onClose }) {
  const { team, projects } = useStore();
  const dispatch = useDispatch();

  const isWhatIf = whatIfProject && (projectId === whatIfProject.id || projectId?.startsWith('what-if-'));
  const project = isWhatIf
    ? whatIfProject
    : projects.find(p => p.id === projectId);

  const isEditing = !!phase;

  // Multi-person selection
  const initialPersonIds = phase?.personIds
    || (phase?.personId ? [phase.personId] : null)
    || presets?.personIds
    || (presets?.personId ? [presets.personId] : null)
    || (team[0] ? [team[0].id] : []);

  const [personIds, setPersonIds] = useState(initialPersonIds);
  const [type, setType] = useState(phase?.type || 'active-build');
  const [startDate, setStartDate] = useState(phase?.startMonth || presets?.startMonth || getCurrentDate());
  const [endDate, setEndDate] = useState(phase?.endMonth || presets?.endMonth || getCurrentDate());
  const [intensityOverride, setIntensityOverride] = useState(phase?.intensityOverride);
  const [useOverride, setUseOverride] = useState(phase?.intensityOverride != null);
  const [targetProjectId, setTargetProjectId] = useState(projectId);

  const effectiveIntensity = useOverride && intensityOverride != null ? intensityOverride : PHASE_TYPES[type]?.weight ?? 0;

  function togglePerson(id) {
    setPersonIds(prev =>
      prev.includes(id) ? prev.filter(p => p !== id) : [...prev, id]
    );
  }

  // Calculate overcommitment warnings per person (urgency-adjusted, prorated by month coverage)
  const warnings = useMemo(() => {
    if (!personIds.length) return [];
    const msgs = [];
    const projectEndMonth = project ? getProjectEndMonth(project) : null;
    const startM = dateToMonth(startDate);
    const endM = dateToMonth(endDate);

    for (const pid of personIds) {
      const person = team.find(t => t.id === pid);
      let m = startM;
      while (m <= endM) {
        let existingLoad = calculateLoad(pid, m, projects, whatIfProject);
        // If editing, subtract the old phase's contribution for this person
        if (isEditing && phase) {
          const oldPids = getPhasePersonIds(phase);
          if (oldPids.includes(pid)) {
            const oldFraction = monthCoverageFraction(phase.startMonth, phase.endMonth, m);
            if (oldFraction > 0) {
              const oldUrgency = getUrgencyFactor(m, projectEndMonth);
              existingLoad -= Math.round(getPhaseIntensity(phase) * oldFraction * oldUrgency);
            }
          }
        }
        const fraction = monthCoverageFraction(startDate, endDate, m);
        const urgency = getUrgencyFactor(m, projectEndMonth);
        const adjustedIntensity = Math.round(effectiveIntensity * fraction * urgency);
        const newLoad = existingLoad + adjustedIntensity;
        if (newLoad > 100) {
          msgs.push(`${person?.name || 'Person'} would be at ${newLoad}% in ${m}`);
        }
        // Advance month
        const [y, mo] = m.split('-').map(Number);
        m = mo === 12 ? `${y + 1}-01` : `${y}-${String(mo + 1).padStart(2, '0')}`;
      }
    }
    return msgs;
  }, [personIds, startDate, endDate, effectiveIntensity, projects, whatIfProject, phase, isEditing, team, project]);

  function handleSave() {
    const phaseData = {
      id: phase?.id || genId(),
      personIds,
      type,
      startMonth: startDate,
      endMonth: endDate < startDate ? startDate : endDate,
      intensityOverride: useOverride ? (intensityOverride ?? PHASE_TYPES[type].weight) : null,
    };

    const actualProjectId = isWhatIf ? whatIfProject.id : targetProjectId;

    if (isWhatIf) {
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
    const phaseInfo = PHASE_TYPES[phase.type];
    const names = getPhasePersonIds(phase).map(id => team.find(t => t.id === id)?.name).filter(Boolean).join(', ');
    if (!confirm(`Delete this ${phaseInfo?.label || phase.type} phase for ${names || 'unknown'}?`)) return;
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
            <label>Team Members</label>
            <div className="team-select">
              {team.map(m => (
                <label key={m.id} className={`team-select-item ${personIds.includes(m.id) ? 'selected' : ''}`}>
                  <input
                    type="checkbox"
                    checked={personIds.includes(m.id)}
                    onChange={() => togglePerson(m.id)}
                  />
                  <span className="team-select-name">{m.name}</span>
                  {m.role && <span className="team-select-role">{m.role}</span>}
                </label>
              ))}
            </div>
            {personIds.length === 0 && (
              <span className="form-hint danger">Select at least one team member</span>
            )}
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
              <label>Start Date</label>
              <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} className="form-input" />
            </div>
            <div className="form-group">
              <label>End Date</label>
              <input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} className="form-input" />
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
                {warnings.slice(0, 5).map((w, i) => <div key={i}>{w}</div>)}
                {warnings.length > 5 && <div>...and {warnings.length - 5} more</div>}
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
          <button className="btn btn-primary" onClick={handleSave} disabled={personIds.length === 0}>
            {isEditing ? 'Save' : 'Add Phase'}
          </button>
        </div>
      </div>
    </div>
  );
}
