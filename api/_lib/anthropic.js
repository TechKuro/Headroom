// Server-side Anthropic call for the R&D claim coach/assessment. The API key
// lives only in the server env (ANTHROPIC_API_KEY) — never the browser.
// Model defaults to Sonnet; override with RD_AI_MODEL.

const ANTHROPIC_URL = 'https://api.anthropic.com/v1/messages';
export const DEFAULT_MODEL = 'claude-sonnet-4-6';

function httpError(status, message) {
  const e = new Error(message);
  e.status = status;
  return e;
}

export function modelName() {
  return process.env.RD_AI_MODEL || DEFAULT_MODEL;
}

// Extract a single JSON object from a model reply (tolerates stray prose/fences).
export function safeJson(text) {
  if (!text) return null;
  let t = String(text).trim().replace(/^```json/i, '').replace(/^```/, '').replace(/```$/, '').trim();
  const a = t.indexOf('{');
  const b = t.lastIndexOf('}');
  if (a >= 0 && b > a) t = t.slice(a, b + 1);
  try { return JSON.parse(t); } catch { return null; }
}

// Call the Messages API. Returns { text, usage }. Throws 503 if unconfigured,
// 502 on an upstream error (message is safe to surface — no key included).
export async function callAnthropic({ system, user, maxTokens, model }) {
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) throw httpError(503, 'AI is not configured yet (ANTHROPIC_API_KEY is not set on the server).');

  const res = await fetch(ANTHROPIC_URL, {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-api-key': key, 'anthropic-version': '2023-06-01' },
    body: JSON.stringify({
      model: model || modelName(),
      max_tokens: maxTokens,
      system,
      messages: [{ role: 'user', content: user }],
    }),
  });

  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw httpError(502, `AI upstream error ${res.status}: ${String(body).slice(0, 160)}`);
  }
  const data = await res.json();
  const text = (data.content || []).filter(b => b.type === 'text').map(b => b.text).join('\n');
  return { text, usage: data.usage || {} };
}
