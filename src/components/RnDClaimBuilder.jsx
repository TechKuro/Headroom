import React, { useState } from 'react';
import { useStore, useDispatch } from '../store';
import { genId } from '../utils';
import { RND_STATUSES, RND_CLAIM_STATUSES, RND_CATEGORIES, RND_WP_OUTCOMES, RAG_STATUSES, DEFAULT_RND_WORK_PACKAGE } from '../constants';
import { validateRndProject, canExportClaim } from '../rdValidation';
import { api } from '../api';
import { addToast } from '../toast';
import { getAccountName } from '../auth/authConfig';
import RnDCoachPanel from './RnDCoachPanel';

// Grouped builder sections. `key` matches the section keys validateRndProject
// emits, so issues can be counted per step.
const SECTIONS = [
  { key: 'meta', title: 'Setup' },
  { key: 'advance', title: 'Advance sought' },
  { key: 'uncertainty', title: 'Uncertainty' },
  { key: 'baseline', title: 'Baseline & prior art' },
  { key: 'workpackages', title: 'Work packages' },
  { key: 'professional', title: 'Competent professional' },
  { key: 'boundary', title: 'Boundary / non-R&D' },
  { key: 'funding', title: 'Funding & cost' },
  { key: 'review', title: 'Review' },
];

function Field({ label, value, onChange, area, type = 'text', placeholder, rows = 4, hint }) {
  return (
    <div className="rnd-field">
      <label>{label}{hint && <span className="rnd-hint"> — {hint}</span>}</label>
      {area
        ? <textarea className="init-textarea" rows={rows} value={value || ''} placeholder={placeholder} onChange={e => onChange(e.target.value)} />
        : <input className="init-text" type={type} value={value ?? ''} placeholder={placeholder} onChange={e => onChange(e.target.value)} />}
    </div>
  );
}

// "Review with AI" button + the resulting coach panel for a section.
function CoachControls({ section, busy, onReview, result, onApply }) {
  return (
    <div className="rnd-coach-wrap">
      <button className="btn btn-secondary btn-sm" disabled={busy === section} onClick={() => onReview(section)}>
        {busy === section ? 'Reviewing…' : '✨ Review with AI'}
      </button>
      <RnDCoachPanel result={result} onApply={onApply} />
    </div>
  );
}

// The focused, full-width claim builder for one R&D project. Edits the live
// rndProject in place (no import/export). AI coaching/assessment is wired in a
// later step; until then this captures and validates the claim.
export default function RnDClaimBuilder({ project, onBack }) {
  const { team, projects } = useStore();
  const dispatch = useDispatch();
  const [active, setActive] = useState('meta');
  const [coach, setCoach] = useState({}); // section -> AI review result
  const [busy, setBusy] = useState('');   // which AI call is running

  const update = patch => dispatch({ type: 'UPDATE_RND_PROJECT', payload: { id: project.id, ...patch } });
  const updateNested = (key, k, v) => update({ [key]: { ...(project[key] || {}), [k]: v } });

  // What each section sends to the AI coach.
  const sectionContent = section => {
    const b = project.boundary || {};
    switch (section) {
      case 'advance': return { advanceSought: project.advanceSought };
      case 'uncertainty': return { technologicalUncertainty: project.technologicalUncertainty };
      case 'baseline': return { baseline: project.baseline, priorArt: project.priorArt, whyNotDeducible: project.whyNotDeducible, howResolved: project.howResolved };
      case 'workpackages': return { workPackages: (project.workPackages || []).map(w => ({ title: w.title, hypothesis: w.hypothesis, method: w.method, metrics: w.metrics, outcome: w.outcome })) };
      case 'boundary': return { activities: b.activities, apportionmentBasis: b.apportionmentBasis };
      default: return {};
    }
  };

  async function runCoach(section) {
    setBusy(section);
    try {
      const res = await api.rdCoach({ section, rndProjectId: project.id, content: sectionContent(section), context: { name: project.name, category: project.category } });
      setCoach(c => ({ ...c, [section]: res }));
    } catch (e) { addToast(e?.message || 'AI review failed.', 'error'); }
    finally { setBusy(''); }
  }

  async function runAssess() {
    setBusy('assess');
    try {
      const cpd = project.competentProfessionalDetail || {};
      const b = project.boundary || {};
      const payload = {
        name: project.name, category: project.category,
        advanceSought: project.advanceSought, technologicalUncertainty: project.technologicalUncertainty,
        baseline: project.baseline, priorArt: project.priorArt, whyNotDeducible: project.whyNotDeducible, howResolved: project.howResolved,
        competentProfessional: cpd.name ? `${cpd.name}${cpd.role ? ', ' + cpd.role : ''}${cpd.years ? ' (' + cpd.years + ' yrs)' : ''}` : project.competentProfessional,
        boundary: { activities: b.activities, apportionmentBasis: b.apportionmentBasis },
        funding: project.funding,
        workPackages: (project.workPackages || []).map(w => ({ title: w.title, hypothesis: w.hypothesis, method: w.method, metrics: w.metrics, outcome: w.outcome, rdHoursEstimate: w.rdHoursEstimate })),
      };
      const res = await api.rdAssess({ rndProjectId: project.id, project: payload });
      update({
        lastAssessment: {
          overallScore: res.overallScore, ragStatus: res.ragStatus, sectionScores: res.sectionScores,
          gaps: res.gaps, hmrcReadinessSummary: res.hmrcReadinessSummary,
          generatedAt: new Date().toISOString(), by: getAccountName(),
        },
        ...(res.aifNarrative ? { aifNarrative: res.aifNarrative } : {}),
      });
      addToast(`Assessment complete — ${res.overallScore}/10`, res.ragStatus === 'red' ? 'warn' : 'success');
    } catch (e) { addToast(e?.message || 'Assessment failed.', 'error'); }
    finally { setBusy(''); }
  }

  const validation = validateRndProject(project);
  const exportable = canExportClaim(project);
  const issuesBySection = section => validation.issues.filter(i => i.section === section);

  // --- work package helpers ---
  const addWp = () => dispatch({ type: 'ADD_RND_WORK_PACKAGE', payload: { rndProjectId: project.id, workPackage: { ...DEFAULT_RND_WORK_PACKAGE, id: genId(), title: 'New work package' } } });
  const updWp = (id, patch) => dispatch({ type: 'UPDATE_RND_WORK_PACKAGE', payload: { rndProjectId: project.id, workPackage: { id, ...patch } } });
  const removeWp = id => dispatch({ type: 'REMOVE_RND_WORK_PACKAGE', payload: { rndProjectId: project.id, workPackageId: id } });

  const cp = project.competentProfessionalDetail || {};
  const boundary = project.boundary || {};
  const funding = project.funding || {};
  const fundingSum = Number(funding.selfPct || 0) + Number(funding.grantPct || 0) + Number(funding.otherSubsidisedPct || 0);
  const rag = project.lastAssessment?.ragStatus;

  return (
    <div className="rnd-builder">
      <div className="rnd-builder-head">
        <button className="text-btn-sm" onClick={onBack}>‹ Back to R&amp;D projects</button>
        <span className="rnd-builder-title">{project.name || 'Untitled R&D project'}</span>
        {rag && <span className={`badge badge-rag-${rag}`}>{RAG_STATUSES[rag]?.label || rag}{project.lastAssessment?.overallScore != null ? ` · ${project.lastAssessment.overallScore}/10` : ''}</span>}
        <span className="rnd-complete">{validation.completeness}% complete</span>
      </div>

      <div className="rnd-builder-body">
        <nav className="rnd-steps">
          {SECTIONS.map(s => {
            const high = issuesBySection(s.key).some(i => i.severity === 'high');
            return (
              <button key={s.key} className={`rnd-step ${active === s.key ? 'active' : ''}`} onClick={() => setActive(s.key)}>
                {s.title}
                {high && <span className="rnd-step-flag" title="Has a blocking issue">!</span>}
              </button>
            );
          })}
        </nav>

        <div className="rnd-step-content">
          {/* Inline issues for the active section (Review shows them all). */}
          {active !== 'review' && issuesBySection(active).map((i, n) => (
            <div key={n} className={`rnd-issue ${i.severity}`}>{i.severity === 'high' ? '⛔' : '⚠'} {i.message}</div>
          ))}

          {active === 'meta' && (
            <>
              <div className="rnd-row-fields">
                <Field label="Internal code" value={project.internalCode} onChange={v => update({ internalCode: v })} placeholder="e.g. NXT-RD-2026-001" />
                <Field label="Accounting period(s)" value={project.accountingPeriods} onChange={v => update({ accountingPeriods: v })} placeholder="e.g. FY2026" />
              </div>
              <div className="rnd-row-fields">
                <div className="rnd-field"><label>Project status</label>
                  <select className="init-select" value={project.status} onChange={e => update({ status: e.target.value })}>
                    {Object.entries(RND_STATUSES).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
                  </select></div>
                <div className="rnd-field"><label>Claim status</label>
                  <select className="init-select" value={project.claimStatus} onChange={e => update({ claimStatus: e.target.value })}>
                    {Object.entries(RND_CLAIM_STATUSES).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
                  </select></div>
                <div className="rnd-field"><label>Category</label>
                  <select className="init-select" value={project.category} onChange={e => update({ category: e.target.value })}>
                    <option value="">—</option>
                    {RND_CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                  </select></div>
              </div>
              <div className="rnd-field"><label>Project lead</label>
                <select className="init-select" value={project.lead} onChange={e => update({ lead: e.target.value })}>
                  <option value="">—</option>
                  {team.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
                </select></div>
              <Field label="Context" area value={project.context} onChange={v => update({ context: v })} hint="brief framing of the project" />
              <div className="rnd-field">
                <label>Linked tracker projects</label>
                <div className="rnd-links">
                  {projects.map(p => {
                    const on = (project.trackerProjectIds || []).includes(p.id);
                    return (
                      <label key={p.id} className={`rnd-link ${on ? 'on' : ''}`}>
                        <input type="checkbox" checked={on} onChange={() => update({ trackerProjectIds: on ? project.trackerProjectIds.filter(x => x !== p.id) : [...(project.trackerProjectIds || []), p.id] })} />
                        <span className="project-dot" style={{ background: p.color }} />{p.name}
                      </label>
                    );
                  })}
                </div>
              </div>
            </>
          )}

          {active === 'advance' && (
            <>
              <Field label="Advance sought" area rows={8} value={project.advanceSought} onChange={v => update({ advanceSought: v })}
                hint="the technological advance — a new capability/architecture, not a client benefit" />
              <CoachControls section="advance" busy={busy} onReview={runCoach} result={coach.advance} onApply={t => update({ advanceSought: t })} />
            </>
          )}

          {active === 'uncertainty' && (
            <>
              <Field label="Technological uncertainty" area rows={8} value={project.technologicalUncertainty} onChange={v => update({ technologicalUncertainty: v })}
                hint="what was genuinely uncertain that a competent professional could not readily resolve" />
              <CoachControls section="uncertainty" busy={busy} onReview={runCoach} result={coach.uncertainty} onApply={t => update({ technologicalUncertainty: t })} />
            </>
          )}

          {active === 'baseline' && (
            <>
              <Field label="Baseline & gaps" area rows={5} value={project.baseline} onChange={v => update({ baseline: v })} hint="the state of knowledge before the work, and where it fell short" />
              <Field label="Prior art reviewed" area rows={3} value={project.priorArt} onChange={v => update({ priorArt: v })} hint="vendor docs, OSS, standards, papers, internal projects…" />
              <Field label="Why not readily deducible" area rows={4} value={project.whyNotDeducible} onChange={v => update({ whyNotDeducible: v })} />
              <Field label="How resolved" area rows={4} value={project.howResolved} onChange={v => update({ howResolved: v })} />
              <CoachControls section="baseline" busy={busy} onReview={runCoach} result={coach.baseline} onApply={t => update({ baseline: t })} />
            </>
          )}

          {active === 'workpackages' && (
            <>
              {(project.workPackages || []).map((wp, i) => (
                <div key={wp.id} className="rnd-wp-card">
                  <div className="rnd-card-top">
                    <input className="rnd-name" value={wp.title} onChange={e => updWp(wp.id, { title: e.target.value })} placeholder={`Work package ${i + 1}`} />
                    <button className="icon-btn-sm danger" title="Remove" onClick={() => removeWp(wp.id)}>×</button>
                  </div>
                  <Field label="Hypothesis" area rows={2} value={wp.hypothesis} onChange={v => updWp(wp.id, { hypothesis: v })} />
                  <div className="rnd-row-fields">
                    <Field label="Method" area rows={2} value={wp.method} onChange={v => updWp(wp.id, { method: v })} />
                    <Field label="Metrics" area rows={2} value={wp.metrics} onChange={v => updWp(wp.id, { metrics: v })} />
                  </div>
                  <div className="rnd-row-fields">
                    <div className="rnd-field"><label>Outcome</label>
                      <select className="init-select" value={wp.outcome} onChange={e => updWp(wp.id, { outcome: e.target.value })}>
                        {Object.entries(RND_WP_OUTCOMES).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
                      </select></div>
                    <Field label="R&D hours estimate" type="number" value={wp.rdHoursEstimate} onChange={v => updWp(wp.id, { rdHoursEstimate: Number(v) || 0 })} />
                  </div>
                  <div className="rnd-field"><label>Team</label>
                    <div className="rnd-links">
                      {team.map(m => {
                        const on = (wp.teamMemberIds || []).includes(m.id);
                        return (
                          <label key={m.id} className={`rnd-link ${on ? 'on' : ''}`}>
                            <input type="checkbox" checked={on} onChange={() => updWp(wp.id, { teamMemberIds: on ? wp.teamMemberIds.filter(x => x !== m.id) : [...(wp.teamMemberIds || []), m.id] })} />
                            {m.name}
                          </label>
                        );
                      })}
                    </div>
                  </div>
                </div>
              ))}
              <button className="text-btn-sm" onClick={addWp}>+ Add work package</button>
              <CoachControls section="workpackages" busy={busy} onReview={runCoach} result={coach.workpackages} />
            </>
          )}

          {active === 'professional' && (
            <>
              <div className="rnd-field"><label>Pick from team (fills name & role)</label>
                <select className="init-select" value="" onChange={e => { const m = team.find(t => t.id === e.target.value); if (m) update({ competentProfessionalDetail: { ...cp, name: m.name, role: m.role || cp.role || '' } }); }}>
                  <option value="">—</option>
                  {team.map(m => <option key={m.id} value={m.id}>{m.name}{m.role ? ` — ${m.role}` : ''}</option>)}
                </select></div>
              <div className="rnd-row-fields">
                <Field label="Name" value={cp.name} onChange={v => updateNested('competentProfessionalDetail', 'name', v)} />
                <Field label="Role" value={cp.role} onChange={v => updateNested('competentProfessionalDetail', 'role', v)} />
                <Field label="Years of experience" type="number" value={cp.years} onChange={v => updateNested('competentProfessionalDetail', 'years', Number(v) || 0)} />
              </div>
              <Field label="Experience summary" area rows={4} value={cp.experienceSummary} onChange={v => updateNested('competentProfessionalDetail', 'experienceSummary', v)}
                hint="why this person qualifies as a competent professional in the relevant field" />
            </>
          )}

          {active === 'boundary' && (
            <>
              <Field label="Non-R&D activities" area rows={4} value={boundary.activities} onChange={v => updateNested('boundary', 'activities', v)} hint="routine config, deployment, support, PM, UI…" />
              <Field label="Apportionment basis" area rows={3} value={boundary.apportionmentBasis} onChange={v => updateNested('boundary', 'apportionmentBasis', v)} hint="how R&D vs non-R&D time is split — e.g. Headroom slots/phases" />
              <CoachControls section="boundary" busy={busy} onReview={runCoach} result={coach.boundary} onApply={t => updateNested('boundary', 'activities', t)} />
            </>
          )}

          {active === 'funding' && (
            <>
              <div className="rnd-row-fields">
                <Field label="Self-funded %" type="number" value={funding.selfPct} onChange={v => updateNested('funding', 'selfPct', Number(v) || 0)} />
                <Field label="Grant %" type="number" value={funding.grantPct} onChange={v => updateNested('funding', 'grantPct', Number(v) || 0)} />
                <Field label="Other subsidised %" type="number" value={funding.otherSubsidisedPct} onChange={v => updateNested('funding', 'otherSubsidisedPct', Number(v) || 0)} />
              </div>
              <div className={`rnd-fund-sum ${fundingSum === 100 ? 'ok' : 'bad'}`}>Sums to {fundingSum}%{fundingSum === 100 ? ' ✓' : ' — must total 100%'}</div>
              <label className="init-checkbox"><input type="checkbox" checked={!!funding.notifiedStateAid} onChange={e => updateNested('funding', 'notifiedStateAid', e.target.checked)} /> Grant is notified state aid</label>
              <label className="init-checkbox"><input type="checkbox" checked={!!funding.claimNotificationMade} onChange={e => updateNested('funding', 'claimNotificationMade', e.target.checked)} /> Claim-notification form submitted</label>
            </>
          )}

          {active === 'review' && (
            <div className="rnd-review">
              <div className="rnd-review-stat">
                <span className="rnd-complete">{validation.completeness}% complete</span>
                {rag
                  ? <span className={`badge badge-rag-${rag}`}>Readiness: {RAG_STATUSES[rag]?.label}{project.lastAssessment?.overallScore != null ? ` · ${project.lastAssessment.overallScore}/10` : ''}</span>
                  : <span className="rnd-hint">Not yet assessed</span>}
              </div>

              {validation.issues.length === 0
                ? <div className="rnd-issue ok">✓ No validation issues.</div>
                : validation.issues.map((i, n) => (
                    <div key={n} className={`rnd-issue ${i.severity}`} role="button" tabIndex={0}
                      onClick={() => setActive(i.section)} onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setActive(i.section); } }}>
                      {i.severity === 'high' ? '⛔' : '⚠'} {i.message} <span className="rnd-hint">→ {SECTIONS.find(s => s.key === i.section)?.title}</span>
                    </div>
                  ))}

              <button className="btn btn-primary" disabled={busy === 'assess'} onClick={runAssess}>
                {busy === 'assess' ? 'Assessing…' : '✨ Run AI readiness assessment'}
              </button>

              {project.lastAssessment && (
                <div className="rnd-assessment">
                  {project.lastAssessment.sectionScores && (
                    <div className="rnd-score-chips">
                      {Object.entries(project.lastAssessment.sectionScores).map(([k, v]) => (
                        <span key={k} className="rnd-score-chip">{k}: {v}/10</span>
                      ))}
                    </div>
                  )}
                  {(project.lastAssessment.gaps || []).map((g, n) => (
                    <div key={n} className={`rnd-issue ${g.severity === 'high' ? 'high' : 'med'}`}>
                      {g.severity === 'high' ? '⛔' : '⚠'} <strong>{g.section}:</strong> {g.description}{g.recommendation && <span className="rnd-hint"> → {g.recommendation}</span>}
                    </div>
                  ))}
                  {project.lastAssessment.hmrcReadinessSummary && <p className="rnd-coach-note">{project.lastAssessment.hmrcReadinessSummary}</p>}
                </div>
              )}

              <Field label="AIF narrative draft" area rows={8} value={project.aifNarrative} onChange={v => update({ aifNarrative: v })}
                hint="the Additional Information Form narrative — AI fills this on assessment; editable before export" />

              <div className="ts-advisory">
                AI guidance is advisory and must be reviewed before submission — it is not a substitute for professional tax advice. Export from the <strong>Packs</strong> tab unlocks at readiness ≥ 6/10 with no blocking issues.
              </div>

              {!exportable.ok && (
                <div className="rnd-issue amber">Not yet exportable: {exportable.reasons.join(' ')}</div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
