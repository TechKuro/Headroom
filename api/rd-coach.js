// POST /api/rd-coach  { section, rndProjectId, content, context? }
//   → per-section AI review of an R&D claim narrative.
// Advisory only; returns a single JSON object (score/issues/suggestedRewrite).
import { readBody } from './_lib/db.js';
import { requireUser } from './_lib/auth.js';
import { callModel, safeJson, deploymentName } from './_lib/aiClient.js';
import { ensureRdAuditSchema, recordRdAiCall } from './_lib/rdAudit.js';

const SYSTEM = `You are a UK R&D Tax Relief advisor (post-April-2024 merged scheme) reviewing one section of a company's R&D claim narrative for HMRC compliance. Be strict, specific and constructive. Judge whether the text demonstrates a genuine technological advance and uncertainty a competent professional could not readily resolve. You are advisory only and must NOT compute any monetary relief. Output raw JSON only — no prose, no markdown, no code fences. The first character must be { and the last must be }.`;

// Generous default; override with RD_COACH_MAX_TOKENS once usage is understood.
const MAX_TOKENS = Number(process.env.RD_COACH_MAX_TOKENS) || 4000;

export default async function handler(req, res) {
  try {
    const user = await requireUser(req);
    if (req.method !== 'POST') {
      res.setHeader('Allow', 'POST');
      return res.status(405).json({ error: 'Method not allowed' });
    }
    await ensureRdAuditSchema();
    const { section, rndProjectId, content, context } = await readBody(req);
    if (!section || !content) return res.status(400).json({ error: 'section and content are required' });

    const userMsg =
`HMRC R&D section review. Section: ${section}. Context: ${JSON.stringify(context || {})}.
Fields: ${JSON.stringify(content)}
Return ONLY this JSON:
{"score":0,"scoreLabel":"","ragStatus":"amber","issues":[{"severity":"high","field":"","issue":"","suggestion":""}],"suggestedRewrite":"","coachingNote":""}`;

    const { text, usage } = await callModel({ system: SYSTEM, user: userMsg, maxTokens: MAX_TOKENS });
    const parsed = safeJson(text);
    if (!parsed) { const e = new Error('Could not parse the AI response.'); e.status = 502; throw e; }

    await recordRdAiCall({
      rndProjectId, kind: 'coach', section, model: deploymentName(),
      score: parsed.score, ragStatus: parsed.ragStatus, usage, calledBy: user.name,
      detail: { issues: parsed.issues },
    });
    return res.status(200).json(parsed);
  } catch (err) {
    const status = err.status || 500;
    return res.status(status).json({ error: err.status ? err.message : 'Server error' });
  }
}
