// Server-side AI call for the R&D claim coach/assessment, via Azure OpenAI on
// Azure AI Foundry (OpenAI-style /chat/completions). Credentials live only in
// the server env — never the browser. JSON mode guarantees a parseable object.
//
// Env: AZURE_OPENAI_ENDPOINT (e.g. https://<resource>.openai.azure.com),
//      AZURE_OPENAI_DEPLOYMENT (the model deployment name),
//      AZURE_OPENAI_API_KEY, AZURE_OPENAI_API_VERSION (optional).
// Auth is the api-key header today; swapping to an Entra token is a one-spot
// change here (use an Authorization: Bearer token instead).

const DEFAULT_API_VERSION = '2024-10-21';

function httpError(status, message) {
  const e = new Error(message);
  e.status = status;
  return e;
}

// The deployment name doubles as the "model" label we record in the audit.
export function deploymentName() {
  return process.env.AZURE_OPENAI_DEPLOYMENT || '';
}

// Extract a single JSON object from a model reply (defensive — JSON mode should
// already return clean JSON, but this tolerates fences/prose just in case).
export function safeJson(text) {
  if (!text) return null;
  let t = String(text).trim().replace(/^```json/i, '').replace(/^```/, '').replace(/```$/, '').trim();
  const a = t.indexOf('{');
  const b = t.lastIndexOf('}');
  if (a >= 0 && b > a) t = t.slice(a, b + 1);
  try { return JSON.parse(t); } catch { return null; }
}

// Call the chat-completions deployment. Returns { text, usage }. Throws 503 when
// unconfigured, 502 on an upstream error (message is safe — no key included).
export async function callModel({ system, user, maxTokens }) {
  const endpoint = process.env.AZURE_OPENAI_ENDPOINT;
  const deployment = process.env.AZURE_OPENAI_DEPLOYMENT;
  const apiKey = process.env.AZURE_OPENAI_API_KEY;
  const apiVersion = process.env.AZURE_OPENAI_API_VERSION || DEFAULT_API_VERSION;
  if (!endpoint || !deployment || !apiKey) {
    throw httpError(503, 'AI is not configured yet (set AZURE_OPENAI_ENDPOINT, AZURE_OPENAI_DEPLOYMENT and AZURE_OPENAI_API_KEY on the server).');
  }

  const url = `${endpoint.replace(/\/$/, '')}/openai/deployments/${encodeURIComponent(deployment)}/chat/completions?api-version=${apiVersion}`;
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'api-key': apiKey },
    body: JSON.stringify({
      messages: [{ role: 'system', content: system }, { role: 'user', content: user }],
      max_tokens: maxTokens,
      temperature: 0.2,
      response_format: { type: 'json_object' },
    }),
  });

  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw httpError(502, `AI upstream error ${res.status}: ${String(body).slice(0, 160)}`);
  }
  const data = await res.json();
  const text = data.choices?.[0]?.message?.content || '';
  return { text, usage: data.usage || {} };
}
