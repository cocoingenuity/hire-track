require('dotenv').config();

const DEEPSEEK_API_URL = 'https://api.deepseek.com/chat/completions';
const MODEL = process.env.DEEPSEEK_MODEL || 'deepseek-v4-flash';
const TIMEOUT_MS = 15000;

async function expandQueries(trackName, existingRoles) {
  if (process.env.DRY_RUN === 'true') return null;

  const apiKey = process.env.DEEPSEEK_API_KEY;
  if (!apiKey) return null;

  const context = existingRoles?.trim()
    ? `Track name: "${trackName}". The user has also listed these target roles: ${existingRoles}.`
    : `Track name: "${trackName}".`;

  const prompt = `${context} Generate a comma-separated list of 5 to 8 highly relevant, common alternative job titles or related keywords that would be effective LinkedIn search queries for this type of role in Ottawa, Canada. Return ONLY the comma-separated list, no extra text, no numbering.`;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);

  try {
    const response = await fetch(DEEPSEEK_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: MODEL,
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.4,
        max_tokens: 150,
      }),
      signal: controller.signal,
    });

    clearTimeout(timer);

    if (!response.ok) {
      console.warn(`[expandQueries] API error ${response.status} — falling back`);
      return null;
    }

    const data = await response.json();
    const text = (data.choices?.[0]?.message?.content || '').trim();
    if (!text) return null;

    console.log(`[expandQueries] raw response: ${text.substring(0, 300)}`);

    const queries = text
      .split(/[\n,]+/)
      .map(q => q.replace(/^[\s\d]+[.)]\s*/, '').trim())
      .filter(q => q.length > 1 && q.length < 80);

    if (queries.length === 0) return null;

    console.log(`[expandQueries] "${trackName}" → ${queries.join(' | ')}`);
    return queries;
  } catch (err) {
    clearTimeout(timer);
    console.warn(`[expandQueries] failed (${err.message}) — falling back`);
    return null;
  }
}

module.exports = { expandQueries };
