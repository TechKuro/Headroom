import React, { useMemo, useState } from 'react';
import { useStore } from '../store';
import {
  getInitiative, getProjectLabourSummary, getRoi, getProjectRisk,
  getPhasePersonIds, formatCurrency, formatSignedCurrency, formatHours,
} from '../utils';
import { INITIATIVE_TYPES, INITIATIVE_STATUSES, RISK_LEVELS } from '../constants';

const SORT_OPTIONS = [
  { key: 'risk',     label: 'Risk' },
  { key: 'roi',      label: 'ROI' },
  { key: 'cost',     label: 'Labour cost' },
  { key: 'progress', label: 'Progress' },
  { key: 'hours',    label: 'Est. hours' },
  { key: 'name',     label: 'Name' },
];

// What each "needs info" gap means, for the chip tooltip.
const NEEDS_INFO_LABELS = {
  value: 'No estimated value',
  metadata: 'No initiative details set',
};

export default function OverviewView() {
  const { team, projects, settings, capacityOverrides } = useStore();
  const blendedRate = settings?.blendedRate ?? 110;

  const [statusFilter, setStatusFilter] = useState('all');   // all | done | progress | backlog
  const [typeFilter, setTypeFilter] = useState('all');       // all | internal | client
  const [chargeableOnly, setChargeableOnly] = useState(false);
  const [riskFilter, setRiskFilter] = useState('all');       // all | critical | at-risk | watch | low
  const [needsInfoOnly, setNeedsInfoOnly] = useState(false);
  const [sortKey, setSortKey] = useState('risk');
  const [sortDir, setSortDir] = useState('desc');            // asc | desc

  // Derive a commercial row per project.
  const rows = useMemo(() => projects.map(p => {
    const init = getInitiative(p);
    const summary = getProjectLabourSummary(p, blendedRate);
    const { roi, roiPercent } = getRoi(init.estimatedValue, summary.cost);
    const risk = getProjectRisk(p, { projects, blendedRate, capacityOverrides });

    const peopleIds = new Set();
    for (const ph of p.phases) for (const id of getPhasePersonIds(ph)) peopleIds.add(id);
    const people = [...peopleIds].map(id => team.find(m => m.id === id)?.name).filter(Boolean);

    return {
      id: p.id, name: p.name, color: p.color, init,
      hours: summary.totalHours, cost: summary.cost,
      value: init.estimatedValue, roi, roiPercent, people, risk,
    };
  }), [projects, team, blendedRate, capacityOverrides]);

  const filtered = useMemo(() => rows.filter(r => {
    if (statusFilter !== 'all' && r.init.status !== statusFilter) return false;
    if (typeFilter !== 'all' && r.init.type !== typeFilter) return false;
    if (chargeableOnly && !r.init.chargeable) return false;
    if (riskFilter !== 'all' && r.risk.level !== riskFilter) return false;
    if (needsInfoOnly && r.risk.needsInfo.length === 0) return false;
    return true;
  }), [rows, statusFilter, typeFilter, chargeableOnly, riskFilter, needsInfoOnly]);

  const sorted = useMemo(() => {
    const dir = sortDir === 'asc' ? 1 : -1;
    const val = r => ({
      risk: RISK_LEVELS[r.risk.level].order, roi: r.roi, cost: r.cost,
      progress: r.init.progress, hours: r.hours, name: r.name,
    }[sortKey]);
    return [...filtered].sort((a, b) => {
      const va = val(a), vb = val(b);
      if (typeof va === 'string') return va.localeCompare(vb) * dir;
      // Tie-break risk on score so a 2-factor "At risk" outranks a 1-factor one.
      if (sortKey === 'risk' && va === vb) return (a.risk.score - b.risk.score) * dir;
      return (va - vb) * dir;
    });
  }, [filtered, sortKey, sortDir]);

  // Metrics reflect the currently-filtered set, so they answer "what am I looking at?"
  const metrics = useMemo(() => {
    const totalHours = filtered.reduce((s, r) => s + r.hours, 0);
    const totalCost = filtered.reduce((s, r) => s + r.cost, 0);
    const totalValue = filtered.reduce((s, r) => s + r.value, 0);
    const avgProgress = filtered.length
      ? Math.round(filtered.reduce((s, r) => s + r.init.progress, 0) / filtered.length)
      : 0;
    const atRisk = filtered.filter(r => r.risk.level === 'at-risk' || r.risk.level === 'critical').length;
    return {
      count: filtered.length, totalHours, totalCost, totalValue,
      netRoi: totalValue - totalCost, avgProgress, atRisk,
    };
  }, [filtered]);

  function setSort(key) {
    if (key === sortKey) {
      setSortDir(d => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortKey(key);
      setSortDir(key === 'name' ? 'asc' : 'desc');
    }
  }

  return (
    <div className="overview-view">
      {/* Metrics strip */}
      <div className="ov-metrics">
        <Metric label="Initiatives" value={metrics.count} />
        <Metric label="Est. hours" value={formatHours(metrics.totalHours)} />
        <Metric label="Labour cost" value={formatCurrency(metrics.totalCost)} />
        <Metric label="Est. value" value={formatCurrency(metrics.totalValue)} />
        <Metric label="Net ROI" value={formatSignedCurrency(metrics.netRoi)} tone={metrics.netRoi >= 0 ? 'pos' : 'neg'} />
        <Metric label="Avg progress" value={`${metrics.avgProgress}%`} />
        <Metric label="At risk" value={metrics.atRisk} tone={metrics.atRisk > 0 ? 'neg' : undefined} />
      </div>

      {/* Filters + sort */}
      <div className="ov-controls">
        <div className="ov-filter-group">
          <span className="ov-filter-label">Status</span>
          <FilterBtn active={statusFilter === 'all'} onClick={() => setStatusFilter('all')}>All</FilterBtn>
          {Object.entries(INITIATIVE_STATUSES).map(([k, v]) => (
            <FilterBtn key={k} active={statusFilter === k} onClick={() => setStatusFilter(k)}>{v.label}</FilterBtn>
          ))}
        </div>
        <div className="ov-filter-group">
          <span className="ov-filter-label">Type</span>
          <FilterBtn active={typeFilter === 'all'} onClick={() => setTypeFilter('all')}>All</FilterBtn>
          {Object.entries(INITIATIVE_TYPES).map(([k, v]) => (
            <FilterBtn key={k} active={typeFilter === k} onClick={() => setTypeFilter(k)}>{v.label}</FilterBtn>
          ))}
        </div>
        <div className="ov-filter-group">
          <span className="ov-filter-label">Risk</span>
          <FilterBtn active={riskFilter === 'all'} onClick={() => setRiskFilter('all')}>All</FilterBtn>
          {Object.entries(RISK_LEVELS).slice().reverse().map(([k, v]) => (
            <FilterBtn key={k} active={riskFilter === k} onClick={() => setRiskFilter(k)}>{v.label}</FilterBtn>
          ))}
        </div>
        <div className="ov-filter-group">
          <FilterBtn active={chargeableOnly} onClick={() => setChargeableOnly(c => !c)}>Chargeable only</FilterBtn>
          <FilterBtn active={needsInfoOnly} onClick={() => setNeedsInfoOnly(n => !n)}>Needs info</FilterBtn>
        </div>
        <div className="ov-filter-group ov-sort">
          <span className="ov-filter-label">Sort</span>
          {SORT_OPTIONS.map(o => (
            <FilterBtn key={o.key} active={sortKey === o.key} onClick={() => setSort(o.key)}>
              {o.label}{sortKey === o.key ? (sortDir === 'asc' ? ' ↑' : ' ↓') : ''}
            </FilterBtn>
          ))}
        </div>
      </div>

      {/* Initiative table */}
      {sorted.length === 0 ? (
        <div className="empty-state"><p>No initiatives match these filters.</p></div>
      ) : (
        <div className="ov-table-wrap">
          <table className="ov-table">
            <thead>
              <tr>
                <th>Initiative</th>
                <th>Status</th>
                <th>Risk</th>
                <th className="num">Progress</th>
                <th className="num">Est. hours</th>
                <th className="num">Labour cost</th>
                <th className="num">Est. value</th>
                <th className="num">ROI</th>
              </tr>
            </thead>
            <tbody>
              {sorted.map(r => (
                <tr key={r.id}>
                  <td>
                    <div className="ov-init-name">
                      <span className="project-dot" style={{ background: r.color }} />
                      <strong>{r.name}</strong>
                    </div>
                    {r.init.description && <div className="ov-init-desc">{r.init.description}</div>}
                    {r.people.length > 0 && <div className="ov-init-people">{r.people.join(', ')}</div>}
                  </td>
                  <td>
                    <div className="ov-badges">
                      <span className={`badge badge-type-${r.init.type}`}>{INITIATIVE_TYPES[r.init.type]?.label || r.init.type}</span>
                      <span className={`badge badge-status-${r.init.status}`}>{INITIATIVE_STATUSES[r.init.status]?.label || r.init.status}</span>
                      {r.init.chargeable && <span className="badge badge-chargeable">Chargeable</span>}
                    </div>
                  </td>
                  <td><RiskCell risk={r.risk} /></td>
                  <td className="num">
                    <div className="ov-progress">
                      <div className="ov-progress-track"><div className="ov-progress-fill" style={{ width: `${r.init.progress}%` }} /></div>
                      <span className="ov-progress-pct">{r.init.progress}%</span>
                    </div>
                  </td>
                  <td className="num mono">{formatHours(r.hours)}</td>
                  <td className="num mono">{formatCurrency(r.cost)}</td>
                  <td className="num">
                    <div className="mono">{formatCurrency(r.value)}</div>
                    {r.init.valueNote && <div className="ov-value-note">{r.init.valueNote}</div>}
                  </td>
                  <td className="num">
                    <div className={`mono ov-roi ${r.roi >= 0 ? 'pos' : 'neg'}`}>{formatSignedCurrency(r.roi)}</div>
                    <div className="ov-roi-pct">{r.roiPercent >= 0 ? '+' : ''}{Math.round(r.roiPercent)}%</div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function RiskCell({ risk }) {
  // The fired factors ARE the explanation — surface them on hover so the
  // label is never a black box.
  const factorTitle = risk.factors.length
    ? risk.factors.map(f => f.label).join('\n')
    : 'No risk signals';
  const needsInfoTitle = risk.needsInfo.map(k => NEEDS_INFO_LABELS[k] || k).join('\n');
  return (
    <div className="ov-risk">
      <span className={`badge badge-risk-${risk.level}`} title={factorTitle}>
        {RISK_LEVELS[risk.level].label}
      </span>
      {risk.needsInfo.length > 0 && (
        <span className="badge badge-needs-info" title={needsInfoTitle}>Needs info</span>
      )}
    </div>
  );
}

function Metric({ label, value, tone }) {
  return (
    <div className="ov-metric">
      <div className={`ov-metric-value ${tone ? `tone-${tone}` : ''}`}>{value}</div>
      <div className="ov-metric-label">{label}</div>
    </div>
  );
}

function FilterBtn({ active, onClick, children }) {
  return (
    <button className={`ov-filter-btn ${active ? 'active' : ''}`} onClick={onClick}>{children}</button>
  );
}
