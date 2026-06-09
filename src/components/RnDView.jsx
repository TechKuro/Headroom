import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useStore, useDispatch } from '../store';
import { api } from '../api';
import {
  genId, getCurrentDate, addDays, getWorkingDayRange, formatHours,
  isQualifying, classificationComplete,
} from '../utils';
import {
  CLASSIFICATIONS, FUNDING_SOURCES, RND_CLAIM_STATUSES, RAG_STATUSES,
  DEFAULT_RND_PROJECT, DEFAULT_GRANT,
} from '../constants';
import { validateRndProject } from '../rdValidation';
import { addToast } from '../toast';
import { confirmDialog } from '../confirm';
import RnDPacks from './RnDPacks';
import RnDClaimBuilder from './RnDClaimBuilder';

const DOW = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const dayLabel = d => { const dt = new Date(d + 'T12:00:00'); return `${DOW[dt.getDay()]} ${dt.getDate()}`; };
const mondayOf = date => { let d = date; while (new Date(d + 'T12:00:00').getDay() !== 1) d = addDays(d, -1); return d; };

// Technical-lead-facing R&D view: define the tax R&D projects and the grant/work
// packages, and classify confirmed time (qualifying vs not + funding source).
export default function RnDView() {
  const [section, setSection] = useState('projects');
  return (
    <div className="rnd-view">
      <div className="rnd-subnav">
        <button className={`ov-filter-btn ${section === 'projects' ? 'active' : ''}`} onClick={() => setSection('projects')}>R&amp;D Projects</button>
        <button className={`ov-filter-btn ${section === 'grants' ? 'active' : ''}`} onClick={() => setSection('grants')}>Grants</button>
        <button className={`ov-filter-btn ${section === 'classify' ? 'active' : ''}`} onClick={() => setSection('classify')}>Classify time</button>
        <button className={`ov-filter-btn ${section === 'packs' ? 'active' : ''}`} onClick={() => setSection('packs')}>Packs</button>
      </div>
      {section === 'projects' && <RnDProjects />}
      {section === 'grants' && <Grants />}
      {section === 'classify' && <Classify />}
      {section === 'packs' && <RnDPacks />}
    </div>
  );
}

function RnDProjects() {
  const { rndProjects } = useStore();
  const dispatch = useDispatch();
  const [openId, setOpenId] = useState(null);
  const add = () => {
    const id = genId();
    dispatch({ type: 'ADD_RND_PROJECT', payload: { id, ...DEFAULT_RND_PROJECT, name: 'New R&D project' } });
    setOpenId(id); // drop straight into the builder for a new project
  };

  const open = (rndProjects || []).find(r => r.id === openId);
  if (open) return <RnDClaimBuilder project={open} onBack={() => setOpenId(null)} />;

  return (
    <div className="rnd-section">
      <div className="rnd-section-head"><h3>R&amp;D Projects <span className="rnd-hint">— the tax unit; open one to build its claim narrative</span></h3><button className="text-btn-sm" onClick={add}>+ Add</button></div>
      {(rndProjects || []).length === 0 && <div className="empty-state"><p>No R&amp;D projects yet.</p></div>}
      {(rndProjects || []).map(r => {
        const { completeness } = validateRndProject(r);
        const rag = r.lastAssessment?.ragStatus;
        return (
          <div key={r.id} className="rnd-proj-row" role="button" tabIndex={0}
            onClick={() => setOpenId(r.id)}
            onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setOpenId(r.id); } }}>
            <span className="rnd-proj-name">{r.name || 'Untitled R&D project'}</span>
            <span className={`badge badge-status-${r.claimStatus === 'ready' ? 'done' : r.claimStatus === 'in-review' ? 'progress' : 'not-started'}`}>{RND_CLAIM_STATUSES[r.claimStatus]?.label || 'Draft'}</span>
            {rag
              ? <span className={`badge badge-rag-${rag}`}>{RAG_STATUSES[rag]?.label}{r.lastAssessment?.overallScore != null ? ` · ${r.lastAssessment.overallScore}/10` : ''}</span>
              : <span className="rnd-proj-unassessed">not assessed</span>}
            <span className="rnd-proj-complete">{completeness}%</span>
            <button className="icon-btn-sm danger" title="Remove" onClick={async e => {
              e.stopPropagation();
              if (await confirmDialog({ title: 'Remove R&D project', message: `Remove "${r.name}"?`, confirmLabel: 'Remove', danger: true })) dispatch({ type: 'REMOVE_RND_PROJECT', payload: r.id });
            }}>×</button>
            <span className="rnd-proj-open" aria-hidden="true">›</span>
          </div>
        );
      })}
    </div>
  );
}

function Grants() {
  const { grants } = useStore();
  const dispatch = useDispatch();
  const update = (id, patch) => dispatch({ type: 'UPDATE_GRANT', payload: { id, ...patch } });
  const add = () => dispatch({ type: 'ADD_GRANT', payload: { id: genId(), ...DEFAULT_GRANT } });

  return (
    <div className="rnd-section">
      <div className="rnd-section-head"><h3>Grants</h3><button className="text-btn-sm" onClick={add}>+ Add</button></div>
      {(grants || []).length === 0 && <div className="empty-state"><p>No grants yet.</p></div>}
      {(grants || []).map(g => (
        <div key={g.id} className="rnd-card">
          <div className="rnd-card-top">
            <input className="rnd-name" value={g.funder} onChange={e => update(g.id, { funder: e.target.value })} placeholder="Funder" />
            <input className="init-text" value={g.reference} onChange={e => update(g.id, { reference: e.target.value })} placeholder="Reference" />
            <button className="icon-btn-sm danger" title="Remove" onClick={async () => { if (await confirmDialog({ title: 'Remove grant', message: `Remove grant ${g.reference || g.funder || ''}?`, confirmLabel: 'Remove', danger: true })) dispatch({ type: 'REMOVE_GRANT', payload: g.id }); }}>×</button>
          </div>
          <div className="rnd-row-fields">
            <Field label="Budget £" type="number" value={g.budget} onChange={v => update(g.id, { budget: Number(v) || 0 })} />
            <Field label="Start" type="date" value={g.start} onChange={v => update(g.id, { start: v })} />
            <Field label="End" type="date" value={g.end} onChange={v => update(g.id, { end: v })} />
            <Field label="Claim cadence" value={g.claimCadence} onChange={v => update(g.id, { claimCadence: v })} />
          </div>
          <Field label="IAR milestones" value={g.iarMilestones} onChange={v => update(g.id, { iarMilestones: v })} />
          <div className="rnd-field">
            <label>Work packages</label>
            {(g.workPackages || []).map(wp => (
              <div key={wp.id} className="rnd-wp">
                <input className="init-text" value={wp.name} onChange={e => dispatch({ type: 'UPDATE_WORK_PACKAGE', payload: { grantId: g.id, workPackage: { id: wp.id, name: e.target.value } } })} />
                <button className="icon-btn-sm danger" onClick={() => dispatch({ type: 'REMOVE_WORK_PACKAGE', payload: { grantId: g.id, workPackageId: wp.id } })}>×</button>
              </div>
            ))}
            <button className="text-btn-sm" onClick={() => dispatch({ type: 'ADD_WORK_PACKAGE', payload: { grantId: g.id, workPackage: { id: genId(), name: 'New work package' } } })}>+ Work package</button>
          </div>
        </div>
      ))}
    </div>
  );
}

function Classify() {
  const { rndProjects, grants } = useStore();
  const [weekStart, setWeekStart] = useState(() => mondayOf(getCurrentDate()));
  const [entries, setEntries] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const days = useMemo(() => getWorkingDayRange(weekStart, addDays(weekStart, 4)), [weekStart]);
  const from = days[0], to = days[days.length - 1];

  const wpOptions = useMemo(() => (grants || []).flatMap(g => (g.workPackages || []).map(wp => ({ id: wp.id, label: `${g.reference || g.funder} — ${wp.name}` }))), [grants]);

  const load = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      const res = await api.listTimeEntries({ from, to });
      // Classify primary, non-draft entries (something the engineer has confirmed).
      setEntries((res.entries || []).filter(e => !e.adjusts_entry_id && e.status !== 'draft'));
    } catch (e) { setError(e?.message || 'Could not load entries.'); }
    finally { setLoading(false); }
  }, [from, to]);
  useEffect(() => { load(); }, [load]);

  async function patch(entry, field, value) {
    // Optimistic; revert on failure (e.g. server rejects qualifying without funding).
    const prev = entries;
    setEntries(es => es.map(e => e.id === entry.id ? { ...e, [field]: value } : e));
    try {
      const map = { classification: 'classification', funding_source: 'fundingSource', rnd_project_id: 'rndProjectId', work_package_id: 'workPackageId' };
      await api.updateTimeEntry(entry.id, { [map[field]]: value });
    } catch (e) {
      setEntries(prev);
      addToast(e?.message || 'Update rejected', 'error');
    }
  }

  return (
    <div className="rnd-section">
      <div className="ts-toolbar">
        <div className="timeline-nav">
          <button className="icon-btn" onClick={() => setWeekStart(w => mondayOf(addDays(w, -7)))} title="Previous week">‹</button>
          <button className="text-btn" onClick={() => setWeekStart(mondayOf(getCurrentDate()))}>This week</button>
          <button className="icon-btn" onClick={() => setWeekStart(w => mondayOf(addDays(w, 7)))} title="Next week">›</button>
        </div>
        <span className="alloc-hint">{dayLabel(from)} – {dayLabel(to)} · classify confirmed time</span>
      </div>
      {error && <div className="ts-error">{error}</div>}
      {entries.length === 0 ? (
        <div className="empty-state"><p>No confirmed time to classify this week.</p></div>
      ) : (
        <div className="rnd-classify">
          <div className="rnd-classify-head">
            <span>Date</span><span>Person</span><span>Hours</span>
            <span>Funding</span><span>Classification</span><span>R&amp;D project</span><span>Work package</span>
          </div>
          {entries.map(e => {
            const incomplete = !classificationComplete(e.classification, e.funding_source);
            const locked = e.status === 'locked';
            return (
              <div key={e.id} className={`rnd-classify-row ${incomplete ? 'incomplete' : ''}`} title={locked ? 'In a locked period — reopen to reclassify' : undefined}>
                <span>{dayLabel(String(e.work_date).slice(0, 10))}</span>
                <span>{e.person_name || e.person_id}</span>
                <span className="mono">{formatHours(Number(e.hours))}</span>
                <select disabled={locked} className={isQualifying(e.classification) && !e.funding_source ? 'needs' : ''} value={e.funding_source || ''} onChange={ev => patch(e, 'funding_source', ev.target.value || null)}>
                  <option value="">{isQualifying(e.classification) ? 'required…' : '—'}</option>
                  {Object.entries(FUNDING_SOURCES).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
                </select>
                <select disabled={locked} value={e.classification || ''} onChange={ev => patch(e, 'classification', ev.target.value || null)}>
                  <option value="">—</option>
                  {Object.entries(CLASSIFICATIONS).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
                </select>
                <select disabled={locked} value={e.rnd_project_id || ''} onChange={ev => patch(e, 'rnd_project_id', ev.target.value || null)}>
                  <option value="">—</option>
                  {(rndProjects || []).map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
                </select>
                <select disabled={locked} value={e.work_package_id || ''} onChange={ev => patch(e, 'work_package_id', ev.target.value || null)}>
                  <option value="">—</option>
                  {wpOptions.map(w => <option key={w.id} value={w.id}>{w.label}</option>)}
                </select>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function Field({ label, value, onChange, area, type = 'text', placeholder }) {
  return (
    <div className="rnd-field">
      <label>{label}</label>
      {area
        ? <textarea className="init-textarea" rows={2} value={value || ''} placeholder={placeholder} onChange={e => onChange(e.target.value)} />
        : <input className="init-text" type={type} value={value ?? ''} placeholder={placeholder} onChange={e => onChange(e.target.value)} />}
    </div>
  );
}
