import React, { useState, useMemo } from 'react';
import { useStore, useDispatch } from '../store';
import { genId, getCurrentDate, getWorkingDayRange, getPhasePersonIds } from '../utils';
import { PHASE_TYPES, HALVES } from '../constants';
import { confirmDialog } from '../confirm';

const DOW = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const dayLabel = date => { const d = new Date(date + 'T12:00:00'); return `${DOW[d.getDay()]} ${d.getDate()}`; };
const slotId = s => `${s.personId}|${s.date}|${s.half}`;

export default function PhaseModal({ projectId, phase, presets, whatIfProject, setWhatIfProject, onClose }) {
  const { team, projects } = useStore();
  const dispatch = useDispatch();

  const isWhatIf = whatIfProject && (projectId === whatIfProject.id || projectId?.startsWith('what-if-'));
  const isEditing = !!phase;

  const initialPersonIds = phase?.personIds
    || (phase?.personId ? [phase.personId] : null)
    || presets?.personIds
    || (presets?.personId ? [presets.personId] : null)
    || (team[0] ? [team[0].id] : []);

  const [personIds, setPersonIds] = useState(initialPersonIds);
  const [type, setType] = useState(phase?.type || 'active-build');
  const [startDate, setStartDate] = useState(phase?.startMonth || presets?.startMonth || getCurrentDate());
  const [endDate, setEndDate] = useState(phase?.endMonth || presets?.endMonth || presets?.startMonth || getCurrentDate());
  const [slots, setSlots] = useState(phase?.slots ? [...phase.slots] : []);
  const [targetProjectId, setTargetProjectId] = useState(projectId);

  const gridDays = useMemo(
    () => (endDate >= startDate ? getWorkingDayRange(startDate, endDate) : getWorkingDayRange(startDate, startDate)),
    [startDate, endDate],
  );

  const slotSet = useMemo(() => new Set(slots.map(slotId)), [slots]);

  function togglePerson(id) {
    setPersonIds(prev => {
      if (prev.includes(id)) {
        setSlots(s => s.filter(x => x.personId !== id)); // drop their allocations too
        return prev.filter(p => p !== id);
      }
      return [...prev, id];
    });
  }

  function toggleSlot(personId, date, half) {
    const key = `${personId}|${date}|${half}`;
    setSlots(prev => slotSet.has(key)
      ? prev.filter(s => slotId(s) !== key)
      : [...prev, { personId, date, half }]);
  }

  // Existing claims from every OTHER phase — a proposed slot that hits one is a conflict.
  const existingClaims = useMemo(() => {
    const set = new Set();
    const all = whatIfProject ? [...projects, whatIfProject] : projects;
    for (const proj of all) for (const ph of proj.phases || []) {
      if (ph.id === phase?.id) continue;
      for (const s of ph.slots || []) set.add(slotId(s));
    }
    return set;
  }, [projects, whatIfProject, phase]);

  const conflicts = useMemo(
    () => slots.filter(s => existingClaims.has(slotId(s))).map(s => {
      const name = team.find(t => t.id === s.personId)?.name || 'Someone';
      return `${name} is already booked ${dayLabel(s.date)} ${s.half.toUpperCase()}`;
    }),
    [slots, existingClaims, team],
  );

  function handleSave() {
    const cleanSlots = slots.filter(s => personIds.includes(s.personId));
    const dates = cleanSlots.map(s => s.date);
    const end = endDate < startDate ? startDate : endDate;
    const phaseData = {
      id: phase?.id || genId(),
      personIds,
      type,
      startMonth: dates.length ? [startDate, ...dates].sort()[0] : startDate,
      endMonth: dates.length ? [end, ...dates].sort().slice(-1)[0] : end,
      slots: cleanSlots,
    };
    const actualProjectId = isWhatIf ? whatIfProject.id : targetProjectId;

    if (isWhatIf) {
      setWhatIfProject(prev => ({
        ...prev,
        phases: isEditing ? prev.phases.map(ph => ph.id === phase.id ? phaseData : ph) : [...prev.phases, phaseData],
      }));
    } else if (isEditing) {
      dispatch({ type: 'UPDATE_PHASE', payload: { projectId: actualProjectId, phase: phaseData } });
    } else {
      dispatch({ type: 'ADD_PHASE', payload: { projectId: actualProjectId, phase: phaseData } });
    }
    onClose();
  }

  async function handleDelete() {
    if (!phase) return;
    const names = getPhasePersonIds(phase).map(id => team.find(t => t.id === id)?.name).filter(Boolean).join(', ');
    if (!(await confirmDialog({ title: 'Delete phase', message: `Delete this ${PHASE_TYPES[phase.type]?.label || phase.type} phase for ${names || 'unknown'}?`, confirmLabel: 'Delete', danger: true }))) return;
    if (isWhatIf) {
      setWhatIfProject(prev => ({ ...prev, phases: prev.phases.filter(ph => ph.id !== phase.id) }));
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
          {!isEditing && (
            <div className="form-group">
              <label>Project</label>
              <select value={targetProjectId} onChange={e => setTargetProjectId(e.target.value)} className="form-select">
                {allProjects.map(p => <option key={p.id} value={p.id}>{p.name}{p.isWhatIf ? ' (What-If)' : ''}</option>)}
              </select>
            </div>
          )}

          <div className="form-group">
            <label>Team Members</label>
            <div className="team-select">
              {team.map(m => (
                <label key={m.id} className={`team-select-item ${personIds.includes(m.id) ? 'selected' : ''}`}>
                  <input type="checkbox" checked={personIds.includes(m.id)} onChange={() => togglePerson(m.id)} />
                  <span className="team-select-name">{m.name}</span>
                  {m.role && <span className="team-select-role">{m.role}</span>}
                </label>
              ))}
            </div>
            {personIds.length === 0 && <span className="form-hint danger">Select at least one team member</span>}
          </div>

          <div className="form-group">
            <label>Phase Type</label>
            <select value={type} onChange={e => setType(e.target.value)} className="form-select">
              {Object.entries(PHASE_TYPES).map(([key, val]) => <option key={key} value={key}>{val.label}</option>)}
            </select>
          </div>

          <div className="form-row">
            <div className="form-group">
              <label>From</label>
              <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} className="form-input" />
            </div>
            <div className="form-group">
              <label>To</label>
              <input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} className="form-input" />
            </div>
          </div>

          {/* Half-day allocation grid */}
          <div className="form-group">
            <label>Half-day allocation <span className="form-hint">— click to toggle ({slots.length} half-days)</span></label>
            {personIds.length === 0 ? (
              <span className="form-hint">Select team members to allocate slots.</span>
            ) : (
              <div className="pm-grid">
                <div className="pm-grid-head">
                  <div className="pm-grid-name" />
                  {gridDays.map(d => (
                    <div key={d} className="pm-grid-day">
                      <span>{dayLabel(d)}</span>
                      <span className="pm-grid-halves">AM PM</span>
                    </div>
                  ))}
                </div>
                {personIds.map(pid => (
                  <div key={pid} className="pm-grid-row">
                    <div className="pm-grid-name">{team.find(t => t.id === pid)?.name}</div>
                    {gridDays.map(date => HALVES.map(half => {
                      const on = slotSet.has(`${pid}|${date}|${half}`);
                      const clash = existingClaims.has(`${pid}|${date}|${half}`);
                      return (
                        <button
                          key={`${date}|${half}`}
                          type="button"
                          className={`pm-grid-cell ${on ? 'on' : ''} ${on && clash ? 'clash' : ''}`}
                          title={`${dayLabel(date)} ${half.toUpperCase()}${clash ? ' — already booked elsewhere' : ''}`}
                          onClick={() => toggleSlot(pid, date, half)}
                        />
                      );
                    }))}
                  </div>
                ))}
              </div>
            )}
          </div>

          {conflicts.length > 0 && (
            <div className="overcommit-warning">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
                <line x1="12" y1="9" x2="12" y2="13" /><line x1="12" y1="17" x2="12.01" y2="17" />
              </svg>
              <div>
                <strong>Double-booking</strong>
                {conflicts.slice(0, 5).map((w, i) => <div key={i}>{w}</div>)}
                {conflicts.length > 5 && <div>…and {conflicts.length - 5} more</div>}
              </div>
            </div>
          )}
        </div>

        <div className="modal-footer">
          {isEditing && <button className="btn btn-danger" onClick={handleDelete}>Delete</button>}
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
