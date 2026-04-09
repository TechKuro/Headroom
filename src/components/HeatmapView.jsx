import React, { useMemo } from 'react';
import { useStore } from '../store';
import { getMonthRange, getCurrentMonth, calculateLoad, getLoadColor, getLoadTextColor, getActivePhases } from '../utils';
import { MONTH_WIDTH, PHASE_TYPES } from '../constants';

export default function HeatmapView({ viewStart, viewEnd, whatIfProject }) {
  const { team, projects } = useStore();
  const months = useMemo(() => getMonthRange(viewStart, viewEnd), [viewStart, viewEnd]);
  const now = getCurrentMonth();
  const gridWidth = months.length * MONTH_WIDTH;

  return (
    <div className="heatmap-view">
      <div className="timeline-scroll">
        {/* Header */}
        <div className="timeline-header" style={{ width: gridWidth }}>
          <div className="timeline-label-col">Team Member</div>
          <div className="timeline-months">
            {months.map(m => (
              <div key={m} className={`timeline-month-cell ${m === now ? 'current' : ''}`} style={{ width: MONTH_WIDTH }}>
                {formatMonth(m)}
              </div>
            ))}
          </div>
        </div>

        {/* Rows */}
        {team.map(person => (
          <HeatmapRow
            key={person.id}
            person={person}
            months={months}
            now={now}
            projects={projects}
            whatIfProject={whatIfProject}
            gridWidth={gridWidth}
          />
        ))}

        {/* Summary row */}
        <div className="heatmap-summary-row">
          <div className="timeline-label-col person-label">
            <span className="person-name summary-label">Team Avg</span>
          </div>
          <div className="timeline-cells" style={{ width: gridWidth }}>
            {months.map(m => {
              const totalLoad = team.reduce((sum, p) => sum + calculateLoad(p.id, m, projects, whatIfProject), 0);
              const avg = team.length ? Math.round(totalLoad / team.length) : 0;
              return (
                <div
                  key={m}
                  className={`heatmap-cell ${m === now ? 'current' : ''}`}
                  style={{ width: MONTH_WIDTH, background: getLoadColor(avg), color: getLoadTextColor(avg) }}
                >
                  {avg > 0 ? `${avg}%` : '—'}
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}

function HeatmapRow({ person, months, now, projects, whatIfProject, gridWidth }) {
  return (
    <div className="heatmap-row">
      <div className="timeline-label-col person-label">
        <span className="person-name">{person.name}</span>
      </div>
      <div className="timeline-cells" style={{ width: gridWidth }}>
        {months.map(m => {
          const load = calculateLoad(person.id, m, projects, whatIfProject);
          const phases = getActivePhases(person.id, m, projects, whatIfProject);
          return (
            <div
              key={m}
              className={`heatmap-cell ${m === now ? 'current' : ''} ${load > 100 ? 'overcommit' : ''}`}
              style={{ width: MONTH_WIDTH, background: getLoadColor(load), color: getLoadTextColor(load) }}
              title={phases.map(p => `${p.projectName}: ${PHASE_TYPES[p.type]?.label} (${p.intensityOverride ?? PHASE_TYPES[p.type]?.weight}%)`).join('\n')}
            >
              <span className="heatmap-value">{load > 0 ? `${load}%` : '—'}</span>
              {phases.length > 0 && (
                <div className="heatmap-projects">
                  {phases.map(p => (
                    <span key={p.id} className="heatmap-dot" style={{ background: p.projectColor }} title={p.projectName} />
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function formatMonth(m) {
  const [y, mo] = m.split('-');
  const names = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  return `${names[parseInt(mo) - 1]} '${y.slice(2)}`;
}
