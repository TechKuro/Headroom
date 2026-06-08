import React, { useMemo, useState, useEffect } from 'react';
import { useStore, useDispatch } from '../store';
import {
  getInitiative, getProjectLabourSummary, getRoi, getPhasePersonIds,
  getPersonSlotMap, getPersonUtilisation, getProjectEndMonth,
  getCurrentMonth, getCurrentDate, addDays, getWorkingDayRange, monthDiff, dateToMonth, formatDateShort,
  formatCurrency, formatSignedCurrency, formatHours, genId,
} from '../utils';
import { INITIATIVE_TYPES, INITIATIVE_STATUSES, HALVES } from '../constants';
import { addToast } from '../toast';

const DOW = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const dayLabel = d => { const dt = new Date(d + 'T12:00:00'); return `${DOW[dt.getDay()]} ${dt.getDate()}`; };

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
  const blendedRate = settings?.blendedRate ?? 110;

  const [personId, setPersonId] = useState(() => team[0]?.id ?? null);
  const [openProjectId, setOpenProjectId] = useState(null);
  const [noteText, setNoteText] = useState('');
  const [scope, setScope] = useState('active'); // 'active' (next 2 weeks) | 'all'

  // The two-week look-ahead window (working days).
  const days = useMemo(() => { const s = getCurrentDate(); return getWorkingDayRange(s, addDays(s, 13)); }, []);
  const now = getCurrentMonth();

  // Projects this person is assigned to, with their personal hours/cost.
  const assigned = useMemo(() => {
    if (!personId) return [];
    // Projects this person has a half-day on within the look-ahead window.
    const slotMap = getPersonSlotMap(personId, projects);
    const activeIds = new Set();
    for (const date of days) for (const half of HALVES) {
      for (const c of (slotMap.get(`${date}|${half}`) || [])) activeIds.add(c.projectId);
    }
    return projects.map(p => {
      const init = getInitiative(p);
      const summary = getProjectLabourSummary(p, blendedRate);
      const hours = summary.assignedHoursByPerson[personId] || 0;
      const { roi } = getRoi(init.estimatedValue, summary.cost);
      const endMonth = getProjectEndMonth(p);
      const toDeadline = endMonth ? monthDiff(now, dateToMonth(endMonth)) : null;
      const peopleIds = new Set();
      for (const ph of p.phases || []) for (const id of getPhasePersonIds(ph)) peopleIds.add(id);
      const people = [...peopleIds].map(id => team.find(m => m.id === id)?.name).filter(Boolean);
      return {
        id: p.id, name: p.name, color: p.color, init, hours, cost: hours * blendedRate, roi,
        start: p.start, deadline: p.deadline, people,
        totalCost: summary.cost, totalHours: summary.totalHours,
        activeNow: activeIds.has(p.id),
        overdue: init.status !== 'done' && toDeadline !== null && toDeadline < 0,
        deadlineSoon: init.status !== 'done' && toDeadline !== null && toDeadline >= 0 && toDeadline <= 2,
      };
    }).filter(x => x.hours > 0);
  }, [projects, personId, blendedRate, days, now]);

  // Default scope shows only what's active in the window; "All" reveals the rest.
  const visible = useMemo(
    () => (scope === 'active' ? assigned.filter(x => x.activeNow) : assigned),
    [assigned, scope]
  );

  // Days in the window where this engineer is double-booked.
  const overloadDays = useMemo(
    () => (personId ? getPersonUtilisation(personId, days, projects).filter(u => u.doubleBooked) : []),
    [personId, projects, days],
  );

  const summary = useMemo(() => {
    const totalHours = assigned.reduce((s, x) => s + x.hours, 0);
    const clientHours = assigned.filter(x => x.init.type === 'client').reduce((s, x) => s + x.hours, 0);
    return { count: assigned.length, totalHours, cost: totalHours * blendedRate, clientHours };
  }, [assigned, blendedRate]);

  const person = team.find(m => m.id === personId);
  const openProject = visible.find(x => x.id === openProjectId) || visible[0] || null;

  function copySummary() {
    if (!person) return;
    const lines = [`Stand-up — ${person.name}${person.role ? ` (${person.role})` : ''}`, ''];
    if (overloadDays.length) {
      lines.push(`⚠ Double-booked: ${overloadDays.map(o => dayLabel(o.date)).join(', ')}`, '');
    }
    if (visible.length === 0) {
      lines.push('No active work this period.');
    } else {
      for (const x of visible) {
        const flags = [x.overdue && 'overdue', x.deadlineSoon && 'deadline soon'].filter(Boolean);
        lines.push(`• ${x.name} — ${formatHours(x.hours)}, ${x.init.progress}% done${flags.length ? ` [${flags.join(', ')}]` : ''}`);
      }
    }
    lines.push('', 'Check-in questions:', ...STANDUP_QUESTIONS.map(q => `  - ${q}`));
    const text = lines.join('\n');
    navigator.clipboard?.writeText(text).then(
      () => addToast('Stand-up summary copied', 'success'),
      () => addToast('Could not copy to clipboard', 'error'),
    );
  }

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
            {overloadDays.length > 0 && (
              <div className="standup-overload" title={overloadDays.map(o => dayLabel(o.date)).join('\n')}>
                ⚠ Double-booked on {overloadDays.map(o => dayLabel(o.date)).join(', ')}
              </div>
            )}
          </div>

          {/* Toolbar: scope + copy */}
          <div className="standup-toolbar">
            <div className="standup-scope">
              <button className={`ov-filter-btn ${scope === 'active' ? 'active' : ''}`} onClick={() => setScope('active')}>Next 2 weeks</button>
              <button className={`ov-filter-btn ${scope === 'all' ? 'active' : ''}`} onClick={() => setScope('all')}>All assigned</button>
            </div>
            <button className="standup-copy-btn" onClick={copySummary} disabled={!person}>Copy summary</button>
          </div>

          {visible.length === 0 ? (
            <div className="empty-state">
              <p>{assigned.length === 0
                ? `${person.name} has no assigned work right now.`
                : `${person.name} has no work in the next 2 weeks — switch to "All assigned" to see everything.`}</p>
            </div>
          ) : (
            <div className="standup-body">
              <div className="standup-projects">
                {visible.map(x => (
                  <button key={x.id} className={`standup-project ${openProject?.id === x.id ? 'active' : ''}`}
                    onClick={() => setOpenProjectId(x.id)}>
                    <div className="standup-project-top">
                      <span className="project-dot" style={{ background: x.color }} />
                      <strong>{x.name}</strong>
                      <span className="standup-info" tabIndex={0} role="img" aria-label={`${x.name} details`}
                        onClick={e => e.stopPropagation()}>
                        i
                        <span className="standup-info-pop" style={{ borderColor: x.color }}>
                          <span className="sip-title" style={{ color: x.color }}>{x.name}</span>
                          {x.init.description && <span className="sip-desc">{x.init.description}</span>}
                          <span className="sip-badges">
                            <span className={`badge badge-type-${x.init.type}`}>{INITIATIVE_TYPES[x.init.type]?.label}</span>
                            <span className={`badge badge-status-${x.init.status}`}>{INITIATIVE_STATUSES[x.init.status]?.label}</span>
                            {x.init.chargeable && <span className="badge badge-chargeable">Chargeable</span>}
                          </span>
                          <span className="sip-rows">
                            <span><b>Runs</b>{(x.start || x.deadline) ? `${x.start ? formatDateShort(x.start) : '?'} → ${x.deadline ? formatDateShort(x.deadline) : '?'}` : '—'}</span>
                            <span><b>Progress</b>{x.init.progress}%</span>
                            <span><b>Total effort</b>{formatHours(x.totalHours)} · {formatCurrency(x.totalCost)}</span>
                            <span><b>Est. value</b>{x.init.estimatedValue > 0 ? formatCurrency(x.init.estimatedValue) : '—'}{x.init.valueNote ? ` (${x.init.valueNote})` : ''}</span>
                            <span><b>ROI</b><span className={x.roi >= 0 ? 'pos' : 'neg'}>{formatSignedCurrency(x.roi)}</span></span>
                            <span><b>Team</b>{x.people.length ? x.people.join(', ') : '—'}</span>
                          </span>
                        </span>
                      </span>
                    </div>
                    <div className="ov-badges">
                      <span className={`badge badge-type-${x.init.type}`}>{INITIATIVE_TYPES[x.init.type]?.label}</span>
                      <span className={`badge badge-status-${x.init.status}`}>{INITIATIVE_STATUSES[x.init.status]?.label}</span>
                      {x.init.chargeable && <span className="badge badge-chargeable">Chargeable</span>}
                      {x.overdue && <span className="badge badge-risk-critical">Overdue</span>}
                      {x.deadlineSoon && <span className="badge badge-risk-watch">Deadline soon</span>}
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
