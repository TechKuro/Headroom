import React, { useMemo } from 'react';
import { useStore } from '../store';
import {
  getPersonWorkload, getPersonUtilisation,
  getCurrentDate, addDays, getWorkingDayRange,
  getLoadColor, formatCurrency, formatHours,
} from '../utils';

// Rolling forecast window (working days) for the utilisation strip.
const HORIZON_CAL_DAYS = 20; // ~4 working weeks

const DOW = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const dayLabel = d => { const dt = new Date(d + 'T12:00:00'); return `${DOW[dt.getDay()]} ${dt.getDate()}`; };

export default function PeopleCostView() {
  const { team, projects, settings } = useStore();
  const blendedRate = settings?.blendedRate ?? 110;

  const days = useMemo(() => {
    const start = getCurrentDate();
    return getWorkingDayRange(start, addDays(start, HORIZON_CAL_DAYS));
  }, []);
  const firstDay = days[0];

  const people = useMemo(() => {
    return team.map(m => {
      const workload = getPersonWorkload(m.id, projects, blendedRate);
      const util = getPersonUtilisation(m.id, days, projects);
      const fills = util.map(u => u.util);
      const avgFill = fills.length ? Math.round(fills.reduce((s, u) => s + u, 0) / fills.length) : 0;
      const doubleDays = util.filter(u => u.doubleBooked).map(u => u.date);
      const firstFree = util.find(u => u.util < 100);
      return {
        id: m.id, name: m.name, role: m.role, workload, util,
        avgFill, doubleDays, availableNext: firstFree ? firstFree.date : null,
      };
    }).sort((a, b) => b.workload.totalHours - a.workload.totalHours);
  }, [team, projects, blendedRate, days]);

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
          Utilisation, next {days.length} working days:
          <span className="pc-util-key" style={{ background: getLoadColor(50) }} /> half
          <span className="pc-util-key" style={{ background: getLoadColor(100) }} /> full
          <span className="pc-util-key" style={{ background: '#dc2626' }} /> double-booked
        </span>
      </div>

      <div className="pc-list">
        {people.map(p => {
          const w = p.workload;
          const clientShare = w.totalHours > 0 ? (w.clientHours / w.totalHours) * 100 : 0;
          const internalShare = w.totalHours > 0 ? (w.internalHours / w.totalHours) * 100 : 0;
          const availableLabel = p.availableNext === null
            ? 'Fully booked'
            : p.availableNext === firstDay ? 'Now' : dayLabel(p.availableNext);

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
                  <Stat label="Avg fill" value={`${p.avgFill}%`} />
                  <Stat label="Double-booked" value={`${p.doubleDays.length}d`} tone={p.doubleDays.length ? 'neg' : undefined} />
                </div>
              </div>

              {/* Utilisation forecast (working days) */}
              <div className="pc-util">
                <div className="pc-util-strip">
                  {p.util.map(u => (
                    <div
                      key={u.date}
                      className={`pc-util-cell ${u.doubleBooked ? 'over' : ''}`}
                      style={{ background: u.doubleBooked ? '#dc2626' : getLoadColor(u.util) }}
                      title={`${dayLabel(u.date)} · ${u.util}%${u.doubleBooked ? ' · double-booked' : ''}`}
                    />
                  ))}
                </div>
                <div className="pc-util-axis">
                  <span>{dayLabel(days[0])}</span>
                  <span>{dayLabel(days[days.length - 1])}</span>
                </div>
              </div>

              {/* Workload composition + signals */}
              <div className="pc-card-foot">
                <div className="pc-bar-area">
                  <div className="pc-bar-track">
                    <div className="pc-bar" style={{ width: `${(w.totalHours / maxHours) * 100}%` }}>
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
                  {p.doubleDays.length > 0 && (
                    <span className="pc-warn" title={p.doubleDays.map(dayLabel).join('\n')}>
                      Double-booked · {p.doubleDays.length}d
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

function Stat({ label, value, tone }) {
  return (
    <div className="pc-stat">
      <div className={`pc-stat-value ${tone ? `tone-${tone}` : ''}`}>{value}</div>
      <div className="pc-stat-label">{label}</div>
    </div>
  );
}
