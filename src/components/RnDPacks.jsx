import React, { useState, useMemo } from 'react';
import { useStore } from '../store';
import { api } from '../api';
import {
  resolveEffectiveEntries, getClaimableByPerson, toCsv, lastDayOfMonth,
  formatHours, formatCurrency, isQualifying,
} from '../utils';
import { CLASSIFICATIONS, FUNDING_SOURCES, MAX_HOURS_PER_DAY, RAG_STATUSES, RND_WP_OUTCOMES } from '../constants';
import { canExportClaim } from '../rdValidation';
import { addToast } from '../toast';

const PRODUCTIVE_DAYS = 220; // §5: annual salary ÷ ~220 productive days
const pad = n => String(n).padStart(2, '0');
const thisYear = () => new Date().getFullYear();

function download(filename, text) {
  const blob = new Blob([text], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = filename; a.click();
  URL.revokeObjectURL(url);
}

export default function RnDPacks() {
  const [tab, setTab] = useState('grant');
  return (
    <div className="rnd-section">
      <div className="rnd-subnav" style={{ marginBottom: 12 }}>
        <button className={`ov-filter-btn ${tab === 'grant' ? 'active' : ''}`} onClick={() => setTab('grant')}>Grant claim pack</button>
        <button className={`ov-filter-btn ${tab === 'relief' ? 'active' : ''}`} onClick={() => setTab('relief')}>Tax-relief pack</button>
      </div>
      <div className="pack-draft">DRAFT — pending specialist / IAR review. Figures are a basis for review, not a final claim.</div>
      {tab === 'grant' ? <GrantPack /> : <ReliefPack />}
    </div>
  );
}

function GrantPack() {
  const { grants } = useStore();
  const [grantId, setGrantId] = useState(grants[0]?.id || '');
  const [year, setYear] = useState(thisYear());
  const [quarter, setQuarter] = useState(Math.floor(new Date().getMonth() / 3) + 1);
  const [salaries, setSalaries] = useState({}); // personId -> annual salary
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const grant = grants.find(g => g.id === grantId);
  const wpName = id => grant?.workPackages?.find(w => w.id === id)?.name || '(unassigned WP)';

  function range() {
    const m0 = (quarter - 1) * 3; // 0-based first month
    const from = `${year}-${pad(m0 + 1)}-01`;
    const endMonth = `${year}-${pad(m0 + 3)}`;
    return { from, to: `${endMonth}-${pad(lastDayOfMonth(endMonth))}` };
  }

  async function generate() {
    if (!grant) return;
    setLoading(true); setError(null);
    try {
      const { from, to } = range();
      const res = await api.listTimeEntries({ from, to });
      const wpIds = new Set((grant.workPackages || []).map(w => w.id));
      // Authorised/locked, linked to this grant's work packages.
      const eff = resolveEffectiveEntries(res.entries || []).filter(e => wpIds.has(e.work_package_id));
      // Group by work package → person.
      const byWp = new Map();
      for (const e of eff) {
        const arr = byWp.get(e.work_package_id) || [];
        arr.push(e);
        byWp.set(e.work_package_id, arr);
      }
      const rows = [];
      for (const [wpId, list] of byWp) {
        const claim = getClaimableByPerson(list);
        for (const [pid, c] of Object.entries(claim)) {
          const authoriser = list.find(e => e.person_id === pid)?.authorised_by || '';
          rows.push({ wpId, wpName: wpName(wpId), personId: pid, name: c.name, actual: c.actual, claimable: c.claimable, authoriser });
        }
      }
      rows.sort((a, b) => a.wpName.localeCompare(b.wpName) || a.name.localeCompare(b.name));
      setResult({ from, to, rows, generatedAt: new Date().toISOString() });
    } catch (e) { setError(e?.message || 'Could not generate.'); }
    finally { setLoading(false); }
  }

  const rowsWithCost = useMemo(() => (result?.rows || []).map(r => {
    const salary = Number(salaries[r.personId]) || 0;
    const dayRate = salary ? salary / PRODUCTIVE_DAYS : 0;
    const claimDays = r.claimable / MAX_HOURS_PER_DAY;
    return { ...r, salary, dayRate, claimDays, cost: claimDays * dayRate };
  }), [result, salaries]);

  const people = useMemo(() => {
    const seen = new Map();
    for (const r of result?.rows || []) if (!seen.has(r.personId)) seen.set(r.personId, r.name);
    return [...seen.entries()];
  }, [result]);

  function exportCsv() {
    const headers = ['Grant', 'Reference', 'Quarter', 'Work package', 'Person', 'Actual hours', 'Claimable hours', 'Claimable days', 'Day rate (£)', 'Cost (£)', 'Authoriser'];
    const body = rowsWithCost.map(r => [grant.funder, grant.reference, `${year} Q${quarter}`, r.wpName, r.name,
      r.actual, r.claimable, r.claimDays.toFixed(2), r.dayRate.toFixed(2), r.cost.toFixed(2), r.authoriser]);
    download(`grant-claim-${grant.reference || grant.funder}-${year}Q${quarter}-DRAFT.csv`, toCsv(headers, body));
  }

  const total = rowsWithCost.reduce((s, r) => s + r.cost, 0);

  return (
    <div>
      <div className="pack-controls">
        <label>Grant
          <select value={grantId} onChange={e => setGrantId(e.target.value)}>
            {grants.map(g => <option key={g.id} value={g.id}>{g.funder} · {g.reference}</option>)}
          </select>
        </label>
        <label>Year <input type="number" value={year} onChange={e => setYear(Number(e.target.value))} /></label>
        <label>Quarter
          <select value={quarter} onChange={e => setQuarter(Number(e.target.value))}>
            {[1, 2, 3, 4].map(q => <option key={q} value={q}>Q{q}</option>)}
          </select>
        </label>
        <button className="btn btn-primary" onClick={generate} disabled={loading || !grant}>{loading ? 'Generating…' : 'Generate'}</button>
      </div>
      {error && <div className="ts-error">{error}</div>}

      {result && (
        <>
          {people.length > 0 && (
            <div className="pack-salaries">
              <div className="pack-sub">Day-rate basis — enter annual salary (÷ {PRODUCTIVE_DAYS} days). Not stored.</div>
              {people.map(([pid, name]) => (
                <label key={pid} className="pack-salary">{name}
                  <input type="number" min="0" placeholder="annual £" value={salaries[pid] ?? ''}
                    onChange={e => setSalaries(s => ({ ...s, [pid]: e.target.value }))} />
                </label>
              ))}
            </div>
          )}
          {rowsWithCost.length === 0 ? (
            <div className="empty-state"><p>No authorised time against this grant's work packages in {year} Q{quarter}.</p></div>
          ) : (
            <>
              <table className="pack-table">
                <thead><tr><th>Work package</th><th>Person</th><th className="num">Actual</th><th className="num">Claimable</th><th className="num">Days</th><th className="num">Day rate</th><th className="num">Cost</th><th>Authoriser</th></tr></thead>
                <tbody>
                  {rowsWithCost.map((r, i) => (
                    <tr key={i}>
                      <td>{r.wpName}</td><td>{r.name}</td>
                      <td className="num mono">{formatHours(r.actual)}</td>
                      <td className="num mono">{formatHours(r.claimable)}{r.claimable < r.actual ? ' *' : ''}</td>
                      <td className="num mono">{r.claimDays.toFixed(2)}</td>
                      <td className="num mono">{r.dayRate ? formatCurrency(r.dayRate) : '—'}</td>
                      <td className="num mono">{r.dayRate ? formatCurrency(r.cost) : '—'}</td>
                      <td>{r.authoriser || <em>—</em>}</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot><tr><td colSpan={6}>Total claimable cost</td><td className="num mono">{formatCurrency(total)}</td><td /></tr></tfoot>
              </table>
              <div className="pack-foot">
                <span className="pack-note">* claimable capped at {MAX_HOURS_PER_DAY}h/day, 40h/week. Generated {new Date(result.generatedAt).toLocaleString('en-GB')}.</span>
                <button className="btn btn-secondary" onClick={exportCsv}>Download CSV</button>
              </div>
            </>
          )}
        </>
      )}
    </div>
  );
}

function ReliefPack() {
  const { rndProjects } = useStore();
  const [year, setYear] = useState(thisYear());
  const [rndId, setRndId] = useState('');
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const rnd = rndProjects.find(r => r.id === rndId);
  const gate = rnd ? canExportClaim(rnd) : null; // export gate when a specific project is selected

  async function generate() {
    setLoading(true); setError(null);
    try {
      const from = `${year}-01-01`, to = `${year}-12-31`;
      const res = await api.listTimeEntries({ from, to });
      let eff = resolveEffectiveEntries(res.entries || []);
      if (rndId) eff = eff.filter(e => e.rnd_project_id === rndId);
      const byClass = { qualifying_direct: 0, qualifying_indirect: 0, non_qualifying: 0, unclassified: 0 };
      const byFunding = {};
      let total = 0, qualifying = 0;
      for (const e of eff) {
        const h = Number(e.hours) || 0;
        total += h;
        const c = e.classification || 'unclassified';
        byClass[c] = (byClass[c] || 0) + h;
        if (isQualifying(e.classification)) {
          qualifying += h;
          const f = e.funding_source || 'unspecified';
          byFunding[f] = (byFunding[f] || 0) + h;
        }
      }
      setResult({ from, to, byClass, byFunding, total, qualifying, generatedAt: new Date().toISOString() });
    } catch (e) { setError(e?.message || 'Could not generate.'); }
    finally { setLoading(false); }
  }

  function exportCsv() {
    const { byClass, byFunding, total, qualifying } = result;
    const rows = [];
    rows.push(['Section', 'Key', 'Hours', 'Proportion']);
    for (const [k, h] of Object.entries(byClass)) rows.push(['Classification', CLASSIFICATIONS[k]?.label || k, h, total ? `${Math.round((h / total) * 100)}%` : '0%']);
    rows.push(['Qualifying total', '', qualifying, total ? `${Math.round((qualifying / total) * 100)}%` : '0%']);
    for (const [k, h] of Object.entries(byFunding)) rows.push(['Qualifying by funding', FUNDING_SOURCES[k]?.label || k, h, qualifying ? `${Math.round((h / qualifying) * 100)}%` : '0%']);
    if (rnd) {
      const cp = rnd.competentProfessionalDetail || {};
      const cpLine = cp.name
        ? `${cp.name}${cp.role ? ', ' + cp.role : ''}${cp.years ? ' (' + cp.years + ' yrs)' : ''}`
        : (rnd.competentProfessional || '');
      rows.push([], ['Narrative', 'Context', rnd.context || '', '']);
      rows.push(['Narrative', 'Advance sought', rnd.advanceSought || '', '']);
      rows.push(['Narrative', 'Technological uncertainty', rnd.technologicalUncertainty || '', '']);
      rows.push(['Narrative', 'Baseline & gaps', rnd.baseline || '', '']);
      rows.push(['Narrative', 'Prior art reviewed', rnd.priorArt || '', '']);
      rows.push(['Narrative', 'Why not readily deducible', rnd.whyNotDeducible || '', '']);
      rows.push(['Narrative', 'How resolved', rnd.howResolved || '', '']);
      rows.push(['Narrative', 'Competent professional', cpLine, '']);
      if (cp.experienceSummary) rows.push(['Narrative', 'CP experience', cp.experienceSummary, '']);
      rows.push(['Narrative', 'Boundary / non-R&D', (rnd.boundary || {}).activities || '', '']);
      rows.push(['Narrative', 'Apportionment basis', (rnd.boundary || {}).apportionmentBasis || '', '']);
      for (const wp of (rnd.workPackages || [])) {
        rows.push([], ['Work package', wp.title || '(untitled)', 'Hypothesis', wp.hypothesis || '']);
        rows.push(['Work package', wp.title || '', 'Method', wp.method || '']);
        rows.push(['Work package', wp.title || '', 'Metrics', wp.metrics || '']);
        rows.push(['Work package', wp.title || '', 'Outcome', RND_WP_OUTCOMES[wp.outcome]?.label || wp.outcome || '']);
        rows.push(['Work package', wp.title || '', 'R&D hours (est)', String(wp.rdHoursEstimate || 0)]);
      }
      if (rnd.aifNarrative) rows.push([], ['AIF narrative', '', rnd.aifNarrative, '']);
      if (rnd.lastAssessment) rows.push([], ['Readiness', 'Score', String(rnd.lastAssessment.overallScore ?? ''), rnd.lastAssessment.ragStatus || '']);
    }
    download(`tax-relief-${rnd ? rnd.name.replace(/\s+/g, '-') : 'all'}-${year}-DRAFT.csv`, toCsv([`Tax-relief pack ${year} — DRAFT`], rows));
  }

  return (
    <div>
      <div className="pack-controls">
        <label>Accounting year <input type="number" value={year} onChange={e => setYear(Number(e.target.value))} /></label>
        <label>R&amp;D project
          <select value={rndId} onChange={e => setRndId(e.target.value)}>
            <option value="">All</option>
            {rndProjects.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
          </select>
        </label>
        <button className="btn btn-primary" onClick={generate} disabled={loading}>{loading ? 'Generating…' : 'Generate'}</button>
      </div>
      {error && <div className="ts-error">{error}</div>}

      {result && (result.total === 0 ? (
        <div className="empty-state"><p>No authorised time {rnd ? `for ${rnd.name}` : ''} in {year}.</p></div>
      ) : (
        <>
          <table className="pack-table">
            <thead><tr><th>Classification</th><th className="num">Hours</th><th className="num">Proportion</th></tr></thead>
            <tbody>
              {Object.entries(result.byClass).map(([k, h]) => h > 0 && (
                <tr key={k}><td>{CLASSIFICATIONS[k]?.label || 'Unclassified'}</td><td className="num mono">{formatHours(h)}</td><td className="num mono">{Math.round((h / result.total) * 100)}%</td></tr>
              ))}
              <tr className="pack-total-row"><td>Qualifying total</td><td className="num mono">{formatHours(result.qualifying)}</td><td className="num mono">{Math.round((result.qualifying / result.total) * 100)}%</td></tr>
            </tbody>
          </table>
          <div className="pack-sub">Qualifying hours by funding source (grant-funded is segregated for relief)</div>
          <table className="pack-table">
            <tbody>
              {Object.keys(result.byFunding).length === 0 ? <tr><td><em>No qualifying hours</em></td></tr> :
                Object.entries(result.byFunding).map(([k, h]) => (
                  <tr key={k}><td>{FUNDING_SOURCES[k]?.label || 'Unspecified'}</td><td className="num mono">{formatHours(h)}</td><td className="num mono">{Math.round((h / result.qualifying) * 100)}%</td></tr>
                ))}
            </tbody>
          </table>
          {rnd && (
            <div className="rnd-review-stat" style={{ marginTop: 4 }}>
              {rnd.lastAssessment?.ragStatus
                ? <span className={`badge badge-rag-${rnd.lastAssessment.ragStatus}`}>Readiness: {RAG_STATUSES[rnd.lastAssessment.ragStatus]?.label}{rnd.lastAssessment.overallScore != null ? ` · ${rnd.lastAssessment.overallScore}/10` : ''}</span>
                : <span className="rnd-hint">Not yet assessed — run the readiness assessment in the claim builder.</span>}
              {(rnd.workPackages || []).length > 0 && <span className="rnd-hint">· {rnd.workPackages.length} work package{rnd.workPackages.length === 1 ? '' : 's'} included</span>}
            </div>
          )}
          <div className="pack-foot">
            <span className="pack-note">No £ relief computed — for the specialist to apply current scheme rules. Generated {new Date(result.generatedAt).toLocaleString('en-GB')}.</span>
            <button className="btn btn-secondary" onClick={exportCsv} disabled={gate && !gate.ok} title={gate && !gate.ok ? gate.reasons.join(' ') : undefined}>Download CSV</button>
          </div>
          {gate && !gate.ok && <div className="rnd-issue amber" style={{ marginTop: 8 }}>Export gated: {gate.reasons.join(' ')}</div>}
        </>
      ))}
    </div>
  );
}
