import React, { useMemo } from 'react';
import { useStore } from '../store';
import { getMonthRange, getCurrentMonth, calculateLoad, getLoadColor, getLoadTextColor, getActivePhases, getPersonCapacity, getEffectiveUtilisation, monthLabelShort } from '../utils';
import { MONTH_WIDTH, PHASE_TYPES } from '../constants';

export default function HeatmapView({ viewStart, viewEnd, whatIfProject, finderMatches }) {
  const { team, projects, capacityOverrides } = useStore();
  const months = useMemo(() => getMonthRange(viewStart, viewEnd), [viewStart, viewEnd]);
  const now = getCurrentMonth();
  const gridWidth = months.length * MONTH_WIDTH;

  const loadMap = useMemo(() => {
    const map = {};
    for (const person of team) {
      map[person.id] = {};
      for (const m of months) {
        const base = calculateLoad(person.id, m, projects, null);
        const total = whatIfProject ? calculateLoad(person.id, m, projects, whatIfProject) : base;
        const capacity = getPersonCapacity(person.id, m, capacityOverrides);
        const effective = getEffectiveUtilisation(total, capacity);
        map[person.id][m] = { base, total, whatIfDelta: total - base, capacity, effective };
      }
    }
    return map;
  }, [team, months, projects, whatIfProject, capacityOverrides]);

  // Utilisation summary data
  const utilSummary = useMemo(() => {
    return team.map(person => {
      const loads = months.map(m => loadMap[person.id]?.[m]?.total ?? 0);
      const avg = loads.length > 0 ? loads.reduce((a, b) => a + b, 0) / loads.length : 0;
      const peak = loads.length > 0 ? Math.max(...loads) : 0;
      const freeMonths = loads.filter(l => l <= 60).length;
      return { person, avg: Math.round(avg), peak, freeMonths };
    });
  }, [team, months, loadMap]);

  return (
    <div className="heatmap-view">
      <div className="timeline-scroll">
        <div className="timeline-header" style={{ width: gridWidth }}>
          <div className="timeline-label-col">Team Member</div>
          <div className="timeline-months">
            {months.map(m => (
              <div key={m} className={`timeline-month-cell ${m === now ? 'current' : ''}`} style={{ width: MONTH_WIDTH }}>
                {monthLabelShort(m)}
              </div>
            ))}
          </div>
        </div>

        {team.map(person => (
          <HeatmapRow
            key={person.id}
            person={person}
            months={months}
            now={now}
            projects={projects}
            whatIfProject={whatIfProject}
            gridWidth={gridWidth}
            loads={loadMap[person.id]}
            finderMatches={finderMatches}
          />
        ))}

        {/* Summary row */}
        <div className="heatmap-summary-row">
          <div className="timeline-label-col person-label">
            <span className="person-name summary-label">Team Avg</span>
          </div>
          <div className="timeline-cells" style={{ width: gridWidth }}>
            {months.map(m => {
              const totalLoad = team.reduce((sum, p) => sum + (loadMap[p.id]?.[m]?.total ?? 0), 0);
              const avg = team.length ? Math.round(totalLoad / team.length) : 0;
              return (
                <div key={m} className={`heatmap-cell ${m === now ? 'current' : ''}`}
                  style={{ width: MONTH_WIDTH, background: getLoadColor(avg), color: getLoadTextColor(avg) }}>
                  {avg > 0 ? `${avg}%` : '—'}
                </div>
              );
            })}
          </div>
        </div>

        {/* Print legend — hidden on screen, visible in PDF */}
        <div className="print-legend">
          <span className="print-legend-title">Legend</span>
          <span className="print-legend-item"><span className="print-swatch" style={{ background: '#16a34a' }} />0–60% Light</span>
          <span className="print-legend-item"><span className="print-swatch" style={{ background: '#ca8a04' }} />61–80% Moderate</span>
          <span className="print-legend-item"><span className="print-swatch" style={{ background: '#ea580c' }} />81–100% At capacity</span>
          <span className="print-legend-item"><span className="print-swatch" style={{ background: '#dc2626' }} />Over 100% Overcommitted</span>
        </div>

        {/* Utilisation summary */}
        <div className="util-summary">
          <div className="util-header">Utilisation Summary — {months.length} months shown</div>
          {utilSummary.map(({ person, avg, peak, freeMonths }) => (
            <div key={person.id} className="util-row">
              <span className="util-name">{person.name}</span>
              <div className="util-bar-track">
                <div className="util-bar-fill" style={{ width: `${Math.min(avg, 150) / 1.5}%`, background: getLoadColor(avg) }} />
                {peak > avg && (
                  <div className="util-bar-peak" style={{ left: `${Math.min(peak, 150) / 1.5}%` }} title={`Peak: ${peak}%`} />
                )}
              </div>
              <span className="util-avg">{avg}% avg</span>
              <span className={`util-peak ${peak > 100 ? 'over' : ''}`}>{peak}% peak</span>
              <span className="util-free">{freeMonths} light</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

const HeatmapRow = React.memo(function HeatmapRow({ person, months, now, projects, whatIfProject, gridWidth, loads, finderMatches }) {
  const personFinderMonths = finderMatches?.[person.id];

  return (
    <div className="heatmap-row">
      <div className="timeline-label-col person-label">
        <span className="person-name">{person.name}</span>
      </div>
      <div className="timeline-cells" style={{ width: gridWidth }}>
        {months.map(m => {
          const { total, whatIfDelta, capacity, effective } = loads[m] || { total: 0, whatIfDelta: 0, capacity: 100, effective: 0 };
          const phases = getActivePhases(person.id, m, projects, whatIfProject);
          const hasWhatIf = whatIfDelta > 0;
          const hasCapOverride = capacity < 100;
          const colorLoad = hasCapOverride ? effective : total;
          const isFinderMatch = personFinderMonths?.has(m);

          return (
            <div
              key={m}
              className={`heatmap-cell ${m === now ? 'current' : ''} ${colorLoad > 100 ? 'overcommit' : ''} ${hasWhatIf ? 'has-whatif' : ''} ${isFinderMatch ? 'finder-match' : ''}`}
              style={{ width: MONTH_WIDTH, background: getLoadColor(colorLoad), color: getLoadTextColor(colorLoad) }}
              title={[
                ...phases.map(p => `${p.projectName}: ${PHASE_TYPES[p.type]?.label} (${p.intensityOverride ?? PHASE_TYPES[p.type]?.weight}%)${p.isWhatIf ? ' [what-if]' : ''}`),
                hasCapOverride ? `Capacity: ${capacity}%` : '',
              ].filter(Boolean).join('\n')}
            >
              <span className="heatmap-value">
                {total > 0 ? `${total}%` : '—'}
              </span>
              {hasCapOverride && total > 0 && (
                <span className="heatmap-cap-indicator" title={`${capacity}% capacity`}>
                  /{capacity}
                </span>
              )}
              {hasWhatIf && <span className="heatmap-whatif-delta">+{whatIfDelta}%</span>}
              {phases.length > 0 && (
                <div className="heatmap-projects">
                  {phases.map(p => (
                    <span key={p.id} className={`heatmap-dot ${p.isWhatIf ? 'whatif-dot' : ''}`} style={{ background: p.projectColor }} title={p.projectName} />
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
});
