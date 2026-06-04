import React, { useMemo, useState } from 'react';
import { useStore } from '../store';
import {
  getInitiative, getProjectLabourSummary, getRoi,
  formatCurrency, formatSignedCurrency, formatHours,
} from '../utils';
import { INITIATIVE_TYPES, INITIATIVE_STATUSES } from '../constants';

// Deterministic check-in prompts — no AI call. Same four questions per project.
const STANDUP_QUESTIONS = [
  'What changed since the last check-in?',
  'What is the next concrete deliverable?',
  'Is the remaining estimate still accurate?',
  'Any blockers, scope risk, or client-expectation issues?',
];

export default function StandupView() {
  const { team, projects, settings } = useStore();
  const blendedRate = settings?.blendedRate ?? 45;

  const [personId, setPersonId] = useState(() => team[0]?.id ?? null);
  const [openProjectId, setOpenProjectId] = useState(null);

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
