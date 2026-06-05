import React, { useMemo, useState, useEffect } from 'react';
import { useStore, useDispatch } from '../store';
import {
  getInitiative, getProjectLabourSummary, getRoi,
  formatCurrency, formatSignedCurrency, formatHours, genId,
} from '../utils';
import { INITIATIVE_TYPES, INITIATIVE_STATUSES } from '../constants';

function formatNoteTime(ts) {
  try {
    return new Date(ts).toLocaleString('en-GB', {
      day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit',
    });
  } catch {
    return ts;
  }
}

// Deterministic check-in prompts — no AI call. Same four questions per project.
const STANDUP_QUESTIONS = [
  'What changed since the last check-in?',
  'What is the next concrete deliverable?',
  'Is the remaining estimate still accurate?',
  'Any blockers, scope risk, or client-expectation issues?',
];

export default function StandupView() {
  const { team, projects, settings } = useStore();
  const dispatch = useDispatch();
  const blendedRate = settings?.blendedRate ?? 45;

  const [personId, setPersonId] = useState(() => team[0]?.id ?? null);
  const [openProjectId, setOpenProjectId] = useState(null);
  const [noteText, setNoteText] = useState('');

  // Projects this person is assigned to, with their personal hours/cost.
  const assigned = useMemo(() => {
    if (!personId) return [];
    return projects.map(p => {
      const init = getInitiative(p);
      const summary = getProjectLabourSummary(p, blendedRate);
      const hours = summary.assignedHoursByPerson[personId] || 0;
      const { roi } = getRoi(init.estimatedValue, summary.cost);
      return { id: p.id, name: p.name, color: p.color, init, hours, cost: hours * blendedRate, roi };
    }).filter(x => x.hours > 0);
  }, [projects, personId, blendedRate]);

  const summary = useMemo(() => {
    const totalHours = assigned.reduce((s, x) => s + x.hours, 0);
    const clientHours = assigned.filter(x => x.init.type === 'client').reduce((s, x) => s + x.hours, 0);
    return { count: assigned.length, totalHours, cost: totalHours * blendedRate, clientHours };
  }, [assigned, blendedRate]);

  const person = team.find(m => m.id === personId);
  const openProject = assigned.find(x => x.id === openProjectId) || assigned[0] || null;

  // Check-in notes for the selected (person, project) pair, newest first.
  const openProjectRaw = openProject ? projects.find(p => p.id === openProject.id) : null;
  const notes = useMemo(() => {
    if (!openProjectRaw || !personId) return [];
    return (openProjectRaw.checkIns || [])
      .filter(n => n.personId === personId)
      .slice()
      .sort((a, b) => (a.ts < b.ts ? 1 : -1));
  }, [openProjectRaw, personId]);

  // Clear the draft when switching person or project.
  useEffect(() => { setNoteText(''); }, [personId, openProject?.id]);

  function addNote() {
    const text = noteText.trim();
    if (!text || !openProject || !personId) return;
    dispatch({
      type: 'ADD_CHECKIN_NOTE',
      payload: {
        projectId: openProject.id,
        note: { id: genId(), personId, personName: person?.name || '', text, ts: new Date().toISOString() },
      },
    });
    setNoteText('');
  }

  function deleteNote(noteId) {
    if (!openProject) return;
    dispatch({ type: 'DELETE_CHECKIN_NOTE', payload: { projectId: openProject.id, noteId } });
  }

  return (
    <div className="standup-view">
      {/* Engineer chip rail */}
      <div className="standup-chips">
        {team.map(m => (
          <button key={m.id} className={`standup-chip ${m.id === personId ? 'active' : ''}`}
            onClick={() => { setPersonId(m.id); setOpenProjectId(null); }}>
            {m.name}
          </button>
        ))}
      </div>

      {!person ? (
        <div className="empty-state"><p>Add a team member to start a stand-up.</p></div>
      ) : (
        <>
          {/* Summary panel */}
          <div className="standup-summary">
            <div className="standup-person">{person.name}{person.role ? <span className="standup-role">{person.role}</span> : null}</div>
            <div className="standup-stats">
              <Stat label="Active projects" value={summary.count} />
              <Stat label="Est. hours" value={formatHours(summary.totalHours)} />
              <Stat label="Labour cost" value={formatCurrency(summary.cost)} />
              <Stat label="Client hours" value={formatHours(summary.clientHours)} />
            </div>
          </div>

          {assigned.length === 0 ? (
            <div className="empty-state"><p>{person.name} has no assigned work right now.</p></div>
          ) : (
            <div className="standup-body">
              <div className="standup-projects">
                {assigned.map(x => (
                  <button key={x.id} className={`standup-project ${openProject?.id === x.id ? 'active' : ''}`}
                    onClick={() => setOpenProjectId(x.id)}>
                    <div className="standup-project-top">
                      <span className="project-dot" style={{ background: x.color }} />
                      <strong>{x.name}</strong>
                    </div>
                    <div className="ov-badges">
                      <span className={`badge badge-type-${x.init.type}`}>{INITIATIVE_TYPES[x.init.type]?.label}</span>
                      <span className={`badge badge-status-${x.init.status}`}>{INITIATIVE_STATUSES[x.init.status]?.label}</span>
                      {x.init.chargeable && <span className="badge badge-chargeable">Chargeable</span>}
                    </div>
                    <div className="standup-project-meta">
                      <span className="mono">{formatHours(x.hours)}</span>
                      <span className="mono">{formatCurrency(x.cost)}</span>
                      <span>{x.init.progress}% done</span>
                      <span className={x.roi >= 0 ? 'ov-roi pos' : 'ov-roi neg'}>{formatSignedCurrency(x.roi)} ROI</span>
                    </div>
                  </button>
                ))}
              </div>

              {/* Prompt block for the selected project */}
              {openProject && (
                <div className="standup-prompts">
                  <div className="standup-prompts-title">
                    Check-in: <span style={{ color: openProject.color }}>{openProject.name}</span>
                  </div>
                  <ol className="standup-questions">
                    {STANDUP_QUESTIONS.map((q, i) => <li key={i}>{q}</li>)}
                  </ol>

                  <div className="standup-notes">
                    <div className="standup-notes-title">Notes</div>

                    {notes.length > 0 ? (
                      <ul className="standup-note-list">
                        {notes.map(n => (
                          <li key={n.id} className="standup-note">
                            <div className="standup-note-head">
                              <span className="standup-note-meta">{n.personName || person?.name} · {formatNoteTime(n.ts)}</span>
                              <button className="standup-note-del" onClick={() => deleteNote(n.id)} title="Delete note">×</button>
                            </div>
                            <div className="standup-note-text">{n.text}</div>
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <p className="standup-note-empty">No notes yet for {person?.name} on this project.</p>
                    )}

                    <textarea
                      className="standup-note-input"
                      placeholder={`Add a check-in note for ${person?.name}… (Ctrl+Enter to save)`}
                      value={noteText}
                      onChange={e => setNoteText(e.target.value)}
                      onKeyDown={e => { if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') { e.preventDefault(); addNote(); } }}
                      rows={3}
                    />
                    <div className="standup-note-actions">
                      <button className="standup-note-btn" onClick={addNote} disabled={!noteText.trim()}>Add note</button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}

function Stat({ label, value }) {
  return (
    <div className="standup-stat">
      <div className="standup-stat-value">{value}</div>
      <div className="standup-stat-label">{label}</div>
    </div>
  );
}
