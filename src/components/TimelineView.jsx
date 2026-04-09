import React, { useMemo } from 'react';
import { useStore } from '../store';
import { getMonthRange, getCurrentMonth, getPersonPhases, stackBars, monthDiff, getPhaseIntensity, calculateLoad } from '../utils';
import { PHASE_TYPES, MONTH_WIDTH, BAR_HEIGHT, BAR_GAP, ROW_PADDING } from '../constants';

export default function TimelineView({ viewStart, viewEnd, whatIfProject, onAddPhase, onEditPhase }) {
  const { team, projects } = useStore();
  const months = useMemo(() => getMonthRange(viewStart, viewEnd), [viewStart, viewEnd]);
  const now = getCurrentMonth();

  // Collect deadline markers
  const deadlines = useMemo(() => {
    const all = [...projects];
    if (whatIfProject) all.push(whatIfProject);
    return all.filter(p => p.deadline && p.deadline >= viewStart && p.deadline <= viewEnd)
      .map(p => ({ projectId: p.id, name: p.name, color: p.color, month: p.deadline, offset: monthDiff(viewStart, p.deadline) }));
  }, [projects, whatIfProject, viewStart, viewEnd]);

  const gridWidth = months.length * MONTH_WIDTH;

  return (
    <div className="timeline-view">
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

        {/* Current month indicator */}
        {now >= viewStart && now <= viewEnd && (
          <div
            className="current-month-line"
            style={{ left: `calc(var(--label-width) + ${monthDiff(viewStart, now) * MONTH_WIDTH + MONTH_WIDTH / 2}px)` }}
          />
        )}

        {/* Deadline markers */}
        {deadlines.map(d => (
          <div
            key={d.projectId}
            className="deadline-line"
            style={{
              left: `calc(var(--label-width) + ${d.offset * MONTH_WIDTH + MONTH_WIDTH - 2}px)`,
              borderColor: d.color,
            }}
          >
            <span className="deadline-label" style={{ color: d.color }}>{d.name}</span>
          </div>
        ))}

        {/* Rows */}
        {team.map(person => (
          <PersonRow
            key={person.id}
            person={person}
            projects={projects}
            whatIfProject={whatIfProject}
            months={months}
            viewStart={viewStart}
            gridWidth={gridWidth}
            now={now}
            onAddPhase={onAddPhase}
            onEditPhase={onEditPhase}
          />
        ))}
      </div>
    </div>
  );
}

function PersonRow({ person, projects, whatIfProject, months, viewStart, gridWidth, now, onAddPhase, onEditPhase }) {
  const bars = useMemo(() => getPersonPhases(person.id, projects, whatIfProject), [person.id, projects, whatIfProject]);
  const { bars: stacked, rowCount } = useMemo(() => stackBars(bars), [bars]);
  const rowHeight = Math.max(1, rowCount) * (BAR_HEIGHT + BAR_GAP) + ROW_PADDING * 2;

  // Current month load for the badge
  const currentLoad = useMemo(() => calculateLoad(person.id, now, projects, whatIfProject), [person.id, now, projects, whatIfProject]);

  return (
    <div className="timeline-row" style={{ minHeight: rowHeight }}>
      <div className="timeline-label-col person-label">
        <span className="person-name">{person.name}</span>
        {currentLoad > 0 && (
          <span className={`load-badge ${currentLoad > 100 ? 'over' : currentLoad > 80 ? 'warn' : 'ok'}`}>
            {currentLoad}%
          </span>
        )}
      </div>
      <div className="timeline-cells" style={{ width: gridWidth }}>
        {/* Grid lines */}
        {months.map(m => (
          <div
            key={m}
            className={`timeline-cell ${m === now ? 'current' : ''}`}
            style={{ width: MONTH_WIDTH }}
            onClick={() => {
              // Quick-add: clicking empty cell opens phase modal with month preset
              if (projects.length > 0) {
                onAddPhase(projects[0].id, { personId: person.id, startMonth: m, endMonth: m });
              }
            }}
          />
        ))}
        {/* Phase bars */}
        {stacked.map(bar => {
          const startOffset = monthDiff(viewStart, bar.startMonth);
          const span = monthDiff(bar.startMonth, bar.endMonth) + 1;
          if (startOffset + span < 0 || startOffset > months.length) return null;
          const left = Math.max(0, startOffset) * MONTH_WIDTH;
          const clippedSpan = Math.min(span - Math.max(0, -startOffset), months.length - Math.max(0, startOffset));
          const width = clippedSpan * MONTH_WIDTH - 4;
          const top = ROW_PADDING + bar._row * (BAR_HEIGHT + BAR_GAP);
          const intensity = getPhaseIntensity(bar);
          const phaseInfo = PHASE_TYPES[bar.type];

          return (
            <div
              key={bar.id}
              className={`phase-bar ${bar.isWhatIf ? 'what-if' : ''}`}
              style={{
                left,
                top,
                width: Math.max(width, 30),
                height: BAR_HEIGHT,
                background: bar.projectColor,
                opacity: 0.4 + (intensity / 100) * 0.6,
              }}
              title={`${bar.projectName} — ${phaseInfo?.label || bar.type} (${intensity}%)`}
              onClick={(e) => {
                e.stopPropagation();
                onEditPhase(bar.projectId, bar);
              }}
            >
              <span className="bar-label">
                {bar.projectName}
                <span className="bar-phase">{phaseInfo?.short || bar.type}</span>
              </span>
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
