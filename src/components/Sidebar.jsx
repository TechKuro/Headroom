import React, { useState } from 'react';
import { useStore, useDispatch } from '../store';
import { genId } from '../utils';
import { PROJECT_COLORS, PHASE_TYPES } from '../constants';

export default function Sidebar({ selectedProjectId, setSelectedProjectId, setView, onAddPhase, onEditPhase, whatIfProject, setWhatIfProject }) {
  const { team, projects } = useStore();
  const dispatch = useDispatch();
  const [newMember, setNewMember] = useState('');
  const [newProject, setNewProject] = useState('');
  const [editingMember, setEditingMember] = useState(null);
  const [editingProject, setEditingProject] = useState(null);

  function addMember(e) {
    e.preventDefault();
    if (!newMember.trim()) return;
    dispatch({ type: 'ADD_TEAM_MEMBER', payload: { id: genId(), name: newMember.trim(), role: '' } });
    setNewMember('');
  }

  function addProject(e) {
    e.preventDefault();
    if (!newProject.trim()) return;
    const usedColors = projects.map(p => p.color);
    const color = PROJECT_COLORS.find(c => !usedColors.includes(c)) || PROJECT_COLORS[projects.length % PROJECT_COLORS.length];
    dispatch({
      type: 'ADD_PROJECT',
      payload: { id: genId(), name: newProject.trim(), color, deadline: '', phases: [] },
    });
    setNewProject('');
  }

  function startWhatIf() {
    const usedColors = projects.map(p => p.color);
    const color = PROJECT_COLORS.find(c => !usedColors.includes(c)) || PROJECT_COLORS[Math.floor(Math.random() * PROJECT_COLORS.length)];
    setWhatIfProject({
      id: 'what-if-' + genId(),
      name: 'New Project',
      color,
      deadline: '',
      phases: [],
      isWhatIf: true,
    });
  }

  const expandedProject = projects.find(p => p.id === selectedProjectId);

  return (
    <aside className="sidebar">
      {/* Team Members */}
      <section className="sidebar-section">
        <h3 className="sidebar-heading">Team</h3>
        <ul className="sidebar-list">
          {team.map(m => (
            <li key={m.id} className="sidebar-item">
              {editingMember === m.id ? (
                <form onSubmit={e => { e.preventDefault(); setEditingMember(null); }} className="inline-edit">
                  <input
                    autoFocus
                    value={m.name}
                    onChange={e => dispatch({ type: 'UPDATE_TEAM_MEMBER', payload: { id: m.id, name: e.target.value } })}
                    onBlur={() => setEditingMember(null)}
                    className="inline-input"
                  />
                </form>
              ) : (
                <>
                  <span className="member-name" onDoubleClick={() => setEditingMember(m.id)}>{m.name}</span>
                  {m.role && <span className="member-role">{m.role}</span>}
                  <button className="icon-btn-sm danger" onClick={() => dispatch({ type: 'REMOVE_TEAM_MEMBER', payload: m.id })} title="Remove">×</button>
                </>
              )}
            </li>
          ))}
        </ul>
        <form onSubmit={addMember} className="sidebar-add">
          <input value={newMember} onChange={e => setNewMember(e.target.value)} placeholder="Add member…" className="sidebar-input" />
          <button type="submit" className="icon-btn-sm" disabled={!newMember.trim()}>+</button>
        </form>
      </section>

      {/* Projects */}
      <section className="sidebar-section">
        <h3 className="sidebar-heading">Projects</h3>
        <ul className="sidebar-list">
          {projects.map(p => (
            <li key={p.id} className={`sidebar-item project-item ${selectedProjectId === p.id ? 'selected' : ''}`}>
              <div className="project-row" onClick={() => { setSelectedProjectId(selectedProjectId === p.id ? null : p.id); }}>
                <span className="project-dot" style={{ background: p.color }} />
                {editingProject === p.id ? (
                  <form onSubmit={e => { e.preventDefault(); setEditingProject(null); }} className="inline-edit" onClick={e => e.stopPropagation()}>
                    <input
                      autoFocus
                      value={p.name}
                      onChange={e => dispatch({ type: 'UPDATE_PROJECT', payload: { id: p.id, name: e.target.value } })}
                      onBlur={() => setEditingProject(null)}
                      className="inline-input"
                    />
                  </form>
                ) : (
                  <span className="project-name" onDoubleClick={(e) => { e.stopPropagation(); setEditingProject(p.id); }}>{p.name}</span>
                )}
                <button className="icon-btn-sm danger" onClick={e => { e.stopPropagation(); dispatch({ type: 'REMOVE_PROJECT', payload: p.id }); }} title="Remove">×</button>
              </div>

              {selectedProjectId === p.id && (
                <div className="project-detail">
                  <div className="detail-row">
                    <label>Deadline</label>
                    <input
                      type="month"
                      value={p.deadline}
                      onChange={e => dispatch({ type: 'UPDATE_PROJECT', payload: { id: p.id, deadline: e.target.value } })}
                      className="month-input"
                    />
                  </div>
                  <div className="detail-row">
                    <label>Colour</label>
                    <div className="color-picker">
                      {PROJECT_COLORS.map(c => (
                        <button
                          key={c}
                          className={`color-swatch ${p.color === c ? 'active' : ''}`}
                          style={{ background: c }}
                          onClick={() => dispatch({ type: 'UPDATE_PROJECT', payload: { id: p.id, color: c } })}
                        />
                      ))}
                    </div>
                  </div>

                  <div className="phase-list">
                    <div className="phase-list-header">
                      <span>Phases ({p.phases.length})</span>
                      <button className="text-btn-sm" onClick={() => onAddPhase(p.id)}>+ Add Phase</button>
                    </div>
                    {p.phases.map(ph => {
                      const person = team.find(m => m.id === ph.personId);
                      const phaseType = PHASE_TYPES[ph.type];
                      return (
                        <div key={ph.id} className="phase-item" onClick={() => onEditPhase(p.id, ph)}>
                          <span className="phase-type-badge" style={{ background: p.color + '33', color: p.color }}>
                            {phaseType?.short || ph.type}
                          </span>
                          <span className="phase-person">{person?.name || '??'}</span>
                          <span className="phase-dates">{ph.startMonth} → {ph.endMonth}</span>
                          {ph.intensityOverride != null && (
                            <span className="phase-override">{ph.intensityOverride}%</span>
                          )}
                        </div>
                      );
                    })}
                  </div>

                  <button className="text-btn-sm view-project-btn" onClick={() => setView('project')}>
                    View project →
                  </button>
                </div>
              )}
            </li>
          ))}
        </ul>
        <form onSubmit={addProject} className="sidebar-add">
          <input value={newProject} onChange={e => setNewProject(e.target.value)} placeholder="Add project…" className="sidebar-input" />
          <button type="submit" className="icon-btn-sm" disabled={!newProject.trim()}>+</button>
        </form>
      </section>

      {/* What-If */}
      <section className="sidebar-section">
        {!whatIfProject ? (
          <button className="what-if-btn" onClick={startWhatIf}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="16"/><line x1="8" y1="12" x2="16" y2="12"/></svg>
            What-If Mode
          </button>
        ) : (
          <div className="what-if-active">
            <span className="what-if-label">What-If Active</span>
            <span className="what-if-hint">Use the banner above to manage</span>
          </div>
        )}
      </section>
    </aside>
  );
}
