// Pure validation + export-gating for an R&D claim project. Shared by the claim
// builder (live issue list, "ready" badge) and the Tax-relief pack (export gate).
// Deterministic and local — no AI. The AI readiness score feeds the export gate
// separately, via project.lastAssessment.

const str = v => String(v ?? '').trim();

// Fields that make up a "complete" claim, for the list completeness badge.
function completenessOf(p = {}) {
  const cp = p.competentProfessionalDetail || {};
  const wps = Array.isArray(p.workPackages) ? p.workPackages : [];
  const checks = [
    str(p.internalCode), str(p.accountingPeriods), str(p.category),
    str(p.advanceSought), str(p.technologicalUncertainty), str(p.baseline),
    str(p.whyNotDeducible), str(cp.name) || str(p.competentProfessional),
    wps.some(w => str(w.title)) ? 'y' : '', str((p.boundary || {}).apportionmentBasis),
  ];
  const filled = checks.filter(Boolean).length;
  return Math.round((filled / checks.length) * 100);
}

/**
 * Validate an R&D claim project.
 * @returns { issues:[{section,severity,message}], hasHigh, completeness }
 * `section` matches a builder step key so the UI can deep-link to the fix.
 */
export function validateRndProject(p = {}) {
  const issues = [];
  const add = (section, severity, message) => issues.push({ section, severity, message });

  const f = p.funding || {};
  const fSum = Number(f.selfPct || 0) + Number(f.grantPct || 0) + Number(f.otherSubsidisedPct || 0);
  const cp = p.competentProfessionalDetail || {};
  const wps = Array.isArray(p.workPackages) ? p.workPackages : [];

  // High — block export.
  if (!str(p.internalCode)) add('meta', 'high', 'Internal code is required.');
  if (!str(p.advanceSought)) add('advance', 'high', 'Advance sought is empty.');
  if (!str(p.technologicalUncertainty)) add('uncertainty', 'high', 'Technological uncertainty is empty.');
  if (!str(cp.name) && !str(p.competentProfessional)) add('professional', 'high', 'No competent professional named.');
  if (!wps.some(w => str(w.title))) add('workpackages', 'high', 'At least one work package with a title is required.');
  if (fSum !== 100) add('funding', 'high', `Funding percentages sum to ${fSum}%, must be 100%.`);
  if (f.notifiedStateAid && Number(f.grantPct || 0) > 0) {
    add('funding', 'high', 'Notified state aid with grant funding — SME relief may be blocked; check eligibility.');
  }

  // Medium — advisory.
  if (!str(p.accountingPeriods)) add('meta', 'med', 'Accounting period not set.');
  if (!str(p.category)) add('meta', 'med', 'Category not set.');
  if (!str(p.baseline)) add('baseline', 'med', 'Baseline / prior art is empty.');
  if (!str(p.whyNotDeducible)) add('baseline', 'med', '“Why not readily deducible” is empty.');
  if (!str((p.boundary || {}).apportionmentBasis)) add('boundary', 'med', 'Apportionment basis not described.');

  return { issues, hasHigh: issues.some(i => i.severity === 'high'), completeness: completenessOf(p) };
}

/**
 * Whether the claim can be exported. Requires no high-severity issues AND an AI
 * readiness assessment of at least 6/10 (read from project.lastAssessment).
 * @returns { ok, reasons[] }
 */
export function canExportClaim(p = {}) {
  const reasons = [];
  if (validateRndProject(p).hasHigh) reasons.push('Resolve the high-severity validation issues.');
  const score = p.lastAssessment?.overallScore;
  if (!(score >= 6)) {
    reasons.push(score == null ? 'Run the AI readiness assessment first.' : `Readiness ${score}/10 — needs 6/10 to export.`);
  }
  return { ok: reasons.length === 0, reasons };
}
