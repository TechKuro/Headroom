import React, { useMemo } from 'react';
import { useStore } from '../store';
import {
  getPersonWorkload, getPersonUtilisation,
  getCurrentMonth, addMonths, getMonthRange, monthLabelShort,
  getLoadColor, formatCurrency, formatHours,
} from '../utils';

// Rolling forecast window for the utilisation strip.
const HORIZON_MONTHS = 12;

export default function PeopleCostView() {
  const { team, projects, settings, capacityOverrides } = useStore();
  const blendedRate = settings?.blendedRate ?? 45;

  const months = useMemo(() => {
    const now = getCurrentMonth();
    return getMonthRange(now, addMonths(now, HORIZON_MONTHS - 1));
  }, []);
  const nowMonth = months[0];

  const people = useMemo(() => {
    return team.map(m => {
      const workload = getPersonWorkload(m.id, projects, blendedRate);
      const util = getPersonUtilisation(m.id, months, projects, capacityOverrides);
      const utils = util.map(u => u.util);
      const avgUtil = utils.length ? Math.round(utils.reduce((s, u) => s + u, 0) / utils.length) : 0;
      const peakUtil = utils.length ? Math.max(...utils) : 0;
      const overloadMonths = util.filter(u => u.util > 100).map(u => u.month);
      const firstFree = util.find(u => u.util < 100);
      return {
        id: m.id, name: m.name, role: m.role, workload, util,
        avgUtil, peakUtil, overloadMonths,
        availableNext: firstFree ? firstFree.month : null,
      };
    }).sort((a, b) => b.workload.totalHours - a.workload.totalHours);
  }, [team, projects, blendedRate, capacityOverrides, months]);

  const maxHours = Math.max(1, ...people.map(p => p.workload.totalHours));

  if (team.length === 0) {
    return <div className="empty-state"><p>Add team members to see workload and cost.</p></div>;
  }

  return (
    <div className="people-cost-view">
      <div className="pc-legend">
        <span><span className="pc-swatch client" /> Client</span>
        <span><span className="pc-swatch internal" /> Internal</span>
        <span className="pc-legend-sep" />
        <span className="pc-legend-util">
          Utilisation, next {HORIZON_MONTHS} months:
          <span className="pc-util-key" style={{ background: getLoadColor(50) }} /> light
          <span className="pc-util-key" style={{ background: getLoadColor(75) }} /> moderate
          <span className="pc-util-key" style={{ background: getLoadColor(95) }} /> heavy
          <span className="pc-util-key" style={{ background: getLoadColor(120) }} /> over
        </span>
      </div>

      <div className="pc-list">
        {people.map(p => {
          const w = p.workload;
          const barPct = (w.totalHours / maxHours) * 100;
          const clientShare = w.totalHours > 0 ? (w.clientHours / w.totalHours) * 100 : 0;
          const internalShare = w.totalHours > 0 ? (w.internalHours / w.totalHours) * 100 : 0;
          const availableLabel = p.availableNext === null
            ? 'Fully booked'
            : p.availableNext === nowMonth ? 'Now' : monthLabelShort(p.availableNext);

          return (
            <div key={p.id} className="pc-card">
              <div className="pc-card-head">
                <div className="pc-name">
                  <strong>{p.name}</strong>
                  {p.role && <span className="pc-role">{p.role}</span>}
                </div>
                <div className="pc-stats">
                  <Stat label="Hours" value={formatHours(w.totalHours)} />
                  <Stat label="Cost" value={formatCurrency(w.cost)} />
                  <Stat label="Billable" value={`${Math.round(w.billablePct)}%`} />
                  <Stat label="Avg util" value={`${p.avgUtil}%`} tone={utilTone(p.avgUtil)} />
                  <Stat label="Peak util" value={`${p.peakUtil}%`} tone={utilTone(p.peakUtil)} />
                </div>
              </div>

              {/* 12-month utilisation forecast */}
              <div className="pc-util">
                <div className="pc-util-strip">
                  {p.util.map(u => (
                    <div
                      key={u.month}
                      className={`pc-util-cell ${u.util > 100 ? 'over' : ''}`}
                      style={{ background: getLoadColor(u.util) }}
                      title={`${monthLabelShort(u.month)} · ${u.util}%`}
                    />
                  ))}
                </div>
                <div className="pc-util-axis">
                  <span>{monthLabelShort(months[0])}</span>
                  <span>{monthLabelShort(months[months.length - 1])}</span>
                </div>
              </div>

              {/* Workload composition + signals */}
              <div className="pc-card-foot">
                <div className="pc-bar-area">
                  <div className="pc-bar-track">
                    <div className="pc-bar" style={{ width: `${barPct}%` }}>
                      {clientShare > 0 && <div className="pc-seg client" style={{ width: `${clientShare}%` }} title={`Client: ${formatHours(w.clientHours)}`} />}
                      {internalShare > 0 && <div className="pc-seg internal" style={{ width: `${internalShare}%` }} title={`Internal: ${formatHours(w.internalHours)}`} />}
                    </div>
                  </div>
                  <div className="pc-seg-labels">
                    {w.clientHours > 0 && <span className="pc-label client">{formatHours(w.clientHours)} client</span>}
                    {w.internalHours > 0 && <span className="pc-label internal">{formatHours(w.internalHours)} internal</span>}
                    {w.totalHours === 0 && <span className="pc-label none">No assigned work</span>}
                    {w.byProject.length > 0 && (
                      <span className="pc-top-projects" title={w.byProject.map(b => `${b.name}: ${formatHours(b.hours)}`).join('\n')}>
                        Top: {w.byProject.slice(0, 2).map(b => b.name).join(', ')}
                      </span>
                    )}
                  </div>
                </div>
                <div className="pc-signals">
                  <span className="pc-avail">Available: <strong>{availableLabel}</strong></span>
                  {p.overloadMonths.length > 0 && (
                    <span className="pc-warn" title={p.overloadMonths.map(monthLabelShort).join('\n')}>
                      Over capacity · {p.overloadMonths.length} mo
                    </span>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// Amber once heavy, red once over capacity — matches the load palette.
function utilTone(util) {
  if (util > 100) return 'neg';
  if (util > 80) return 'warn';
  return undefined;
}

function Stat({ label, value, tone }) {
  return (
    <div className="pc-stat">
      <div className={`pc-stat-value ${tone ? `tone-${tone}` : ''}`}>{value}</div>
      <div className="pc-stat-label">{label}</div>
    </div>
  );
}
