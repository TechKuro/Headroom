import React, { useMemo } from 'react';
import { useStore } from '../store';
import { getInitiative, getProjectLabourSummary, formatCurrency, formatHours } from '../utils';

export default function PeopleCostView() {
  const { team, projects, settings } = useStore();
  const blendedRate = settings?.blendedRate ?? 45;

  // Compute each project's labour summary once, then attribute hours per person.
  const people = useMemo(() => {
    const summaries = projects.map(p => ({ type: getInitiative(p).type, summary: getProjectLabourSummary(p, blendedRate) }));
    return team.map(m => {
      let clientHours = 0, internalHours = 0;
      for (const { type, summary } of summaries) {
        const h = summary.assignedHoursByPerson[m.id] || 0;
        if (h <= 0) continue;
        if (type === 'client') clientHours += h; else internalHours += h;
      }
      const totalHours = clientHours + internalHours;
      return { id: m.id, name: m.name, role: m.role, clientHours, internalHours, totalHours, cost: totalHours * blendedRate };
    }).sort((a, b) => b.totalHours - a.totalHours);
  }, [team, projects, blendedRate]);

  const maxHours = Math.max(1, ...people.map(p => p.totalHours));

  if (team.length === 0) {
    return <div className="empty-state"><p>Add team members to see workload and cost.</p></div>;
  }

  return (
    <div className="people-cost-view">
      <div className="pc-legend">
        <span><span className="pc-swatch client" /> Client</span>
        <span><span className="pc-swatch internal" /> Internal</span>
      </div>

      <div className="pc-list">
        {people.map(p => {
          const barPct = (p.totalHours / maxHours) * 100;
          const clientShare = p.totalHours > 0 ? (p.clientHours / p.totalHours) * 100 : 0;
          const internalShare = p.totalHours > 0 ? (p.internalHours / p.totalHours) * 100 : 0;
          return (
            <div key={p.id} className="pc-row">
              <div className="pc-name">
                <strong>{p.name}</strong>
                {p.role && <span className="pc-role">{p.role}</span>}
              </div>
              <div className="pc-bar-area">
                <div className="pc-bar-track">
                  <div className="pc-bar" style={{ width: `${barPct}%` }}>
                    {clientShare > 0 && <div className="pc-seg client" style={{ width: `${clientShare}%` }} title={`Client: ${formatHours(p.clientHours)}`} />}
                    {internalShare > 0 && <div className="pc-seg internal" style={{ width: `${internalShare}%` }} title={`Internal: ${formatHours(p.internalHours)}`} />}
                  </div>
                </div>
                <div className="pc-seg-labels">
                  {p.clientHours > 0 && <span className="pc-label client">{formatHours(p.clientHours)} client</span>}
                  {p.internalHours > 0 && <span className="pc-label internal">{formatHours(p.internalHours)} internal</span>}
                  {p.totalHours === 0 && <span className="pc-label none">No assigned work</span>}
                </div>
              </div>
              <div className="pc-totals">
                <div className="pc-hours mono">{formatHours(p.totalHours)}</div>
                <div className="pc-cost mono">{formatCurrency(p.cost)}</div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
