import { describe, it, expect } from 'vitest';
import { validateRndProject, canExportClaim } from './rdValidation';

// A claim with no high-severity issues (all required fields present, funding = 100%).
const complete = {
  internalCode: 'NXT-RD-2026-001',
  accountingPeriods: 'FY2026',
  category: 'Complex Integration',
  advanceSought: 'an advance',
  technologicalUncertainty: 'an uncertainty',
  baseline: 'a baseline',
  whyNotDeducible: 'because',
  competentProfessionalDetail: { name: 'Jordy', role: 'Senior', years: 8, experienceSummary: '...' },
  workPackages: [{ id: 'w1', title: 'WP1' }],
  boundary: { apportionmentBasis: 'from Headroom slots' },
  funding: { selfPct: 100, grantPct: 0, otherSubsidisedPct: 0, notifiedStateAid: false },
};

describe('validateRndProject', () => {
  it('flags the required fields on an empty project as high-severity', () => {
    const { issues, hasHigh } = validateRndProject({});
    expect(hasHigh).toBe(true);
    const highSections = issues.filter(i => i.severity === 'high').map(i => i.section);
    expect(highSections).toEqual(expect.arrayContaining(['meta', 'advance', 'uncertainty', 'professional', 'workpackages', 'funding']));
  });

  it('passes a complete claim with no high-severity issues', () => {
    const { hasHigh, completeness } = validateRndProject(complete);
    expect(hasHigh).toBe(false);
    expect(completeness).toBe(100);
  });

  it('flags a funding split that does not total 100%', () => {
    const v = validateRndProject({ ...complete, funding: { selfPct: 50, grantPct: 20, otherSubsidisedPct: 0 } });
    expect(v.issues.some(i => i.section === 'funding' && i.severity === 'high' && /70%/.test(i.message))).toBe(true);
  });

  it('flags notified state aid alongside grant funding', () => {
    const v = validateRndProject({ ...complete, funding: { selfPct: 60, grantPct: 40, otherSubsidisedPct: 0, notifiedStateAid: true } });
    expect(v.issues.some(i => /state aid/i.test(i.message))).toBe(true);
  });

  it('accepts the legacy plain competentProfessional field', () => {
    const { issues } = validateRndProject({ ...complete, competentProfessionalDetail: {}, competentProfessional: 'Jordy Whitehouse' });
    expect(issues.some(i => i.section === 'professional')).toBe(false);
  });
});

describe('canExportClaim', () => {
  it('blocks when there are high-severity issues', () => {
    const r = canExportClaim({ ...complete, internalCode: '', lastAssessment: { overallScore: 9 } });
    expect(r.ok).toBe(false);
    expect(r.reasons.some(x => /high-severity/.test(x))).toBe(true);
  });

  it('blocks when no assessment has been run', () => {
    const r = canExportClaim(complete);
    expect(r.ok).toBe(false);
    expect(r.reasons.some(x => /assessment first/.test(x))).toBe(true);
  });

  it('blocks when readiness is below 6/10', () => {
    const r = canExportClaim({ ...complete, lastAssessment: { overallScore: 5 } });
    expect(r.ok).toBe(false);
    expect(r.reasons.some(x => /needs 6\/10/.test(x))).toBe(true);
  });

  it('allows when readiness >= 6 and no high-severity issues', () => {
    const r = canExportClaim({ ...complete, lastAssessment: { overallScore: 6 } });
    expect(r).toEqual({ ok: true, reasons: [] });
  });
});
