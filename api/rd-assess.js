// POST /api/rd-assess  { rndProjectId, project, actualsSummary? }
//   → whole-claim HMRC readiness assessment + AIF narrative draft.
// Advisory only; never computes monetary relief. Returns a single JSON object.
import { readBody } from './_lib/db.js';
import { requireUser } from './_lib/auth.js';
import { callAnthropic, safeJson, modelName } from './_lib/anthropic.js';
import { ensureRdAuditSchema, recordRdAiCall } from './_lib/rdAudit.js';

const SYSTEM = `You are a UK R&D Tax Relief advisor (post-April-2024 merged scheme) assessing a company's whole R&D claim for HMRC readiness. Be strict. Score each section 0-10 and overall 0-10, list concrete gaps with recommendations, and draft a concise Additional Information Form (AIF) narrative. You are advisory only and must NOT compute any monetary relief or £ figures. Output raw JSON only — no prose, no markdown, no code fences. The first character must be { and the last must be }.`;

// Generous default; override with RD_ASSESS_MAX_TOKENS once usage is understood.
const MAX_TOKENS = Number(process.env.RD_ASSESS_MAX_TOKENS) || 8000;

export default async function handler(req, res) {
  try {
    const user = await requireUser(req);
    if (req.method !== 'POST') {
      res.setHeader('Allow', 'POST');
      return res.status(405).json({ error: 'Method not allowed' });
    }
    await ensureRdAuditSchema();
    const { rndProjectId, project, actualsSummary } = await readBody(req);
    if (!project) return res.status(400).json({ error: 'project is required' });

    const userMsg =
`HMRC R&D readiness assessment. Be strict. Keep aifNarrative under 200 words.
Project: ${JSON.stringify(project)}
${actualsSummary ? `Actuals summary (confirmed time): ${JSON.stringify(actualsSummary)}` : ''}
Return ONLY this JSON:
{"overallScore":0,"ragStatus":"amber","sectionScores":{"advance":0,"uncertainty":0,"baseline":0,"workPackages":0,"boundary":0,"funding":0},"gaps":[{"severity":"high","section":"","description":"","recommendation":""}],"aifNarrative":"","hmrcReadinessSummary":""}`;

    const { text, usage } = await callAnthropic({ system: SYSTEM, user: userMsg, maxTokens: MAX_TOKENS });
    const parsed = safeJson(text);
    if (!parsed) { const e = new Error('Could not parse the AI response (it may have been truncated).'); e.status = 502; throw e; }

    await recordRdAiCall({
      rndProjectId, kind: 'assess', model: modelName(),
      score: parsed.overallScore, ragStatus: parsed.ragStatus, usage, calledBy: user.name,
      detail: { gaps: parsed.gaps, sectionScores: parsed.sectionScores },
    });
    return res.status(200).json(parsed);
  } catch (err) {
    const status = err.status || 500;
    return res.status(status).json({ error: err.status ? err.message : 'Server error' });
  }
}
