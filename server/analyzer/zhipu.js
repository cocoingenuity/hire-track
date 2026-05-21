require('dotenv').config();

const ZHIPU_API_URL = 'https://open.bigmodel.cn/api/paas/v4/chat/completions';
const MODEL = process.env.ZHIPU_MODEL || 'glm-4-flash';
const RATE_LIMIT_DELAY_MS = 500; // glm-4-flash is free with generous limits

async function analyze(resumeText, jobDescription) {
  const jobTitle = jobDescription.split('\n')[0].substring(0, 60);

  if (process.env.DRY_RUN === 'true') {
    const score = 60 + Math.floor(Math.random() * 35);
    const tier = score >= 80 ? 'Strong Match' : score >= 60 ? 'Good Match' : 'Stretch';
    console.log(`[zhipu] DRY_RUN → "${jobTitle}" score=${score} tier="${tier}"`);
    return {
      match_score: score,
      match_tier: tier,
      strengths: ['Relevant experience / 相关工作经验'],
      gaps: ['Area to develop / 需要发展的领域'],
      key_requirements: ['Key skill required / 所需关键技能'],
      apply_recommendation: score >= 60,
      one_line_pitch: 'Dry-run placeholder — no Zhipu call made.',
      noc_code: '22220 – Computer Network Technicians',
      noc_explanation: 'Dry-run placeholder.',
      teer_level: 2,
    };
  }

  const keyPreview = (process.env.ZHIPU_API_KEY || '(not set)').substring(0, 10);
  console.log(`[zhipu] analyze() → "${jobTitle}" | key: ${keyPreview}...`);

  const prompt = `You are a job application assistant evaluating candidate fit.

RESUME:
${resumeText}

JOB DESCRIPTION:
${jobDescription}

Analyze how well this candidate matches this job. Return ONLY valid JSON with this exact structure — no markdown, no explanation, no code fences:
{
  "match_score": <integer 0-100>,
  "match_tier": "<Strong Match|Good Match|Stretch|Skip>",
  "strengths": ["Customer-facing IT support experience at Best Buy / 在百思买有面向客户的IT支持经验", "..."],
  "gaps": ["No formal ITIL certification / 没有正式的ITIL认证", "..."],
  "key_requirements": ["Help desk ticketing system experience / 有帮助台工单系统使用经验", "..."],
  "apply_recommendation": <true|false>,
  "one_line_pitch": "<personalized cover letter opener in English only>",
  "noc_code": "<5-digit NOC code> – <NOC job title>",
  "noc_explanation": "<one sentence explaining why this NOC code applies to this job>",
  "teer_level": <integer 0-5>
}

Each item in strengths, gaps, and key_requirements must be a single string formatted as "English description / 简体中文翻译" — the slash separates the two languages.
noc_code must use the Canadian NOC 2021 classification (5-digit codes). Example: "22220 – Computer Network Technicians".
teer_level is the TEER level from NOC 2021 (0–5). It equals the second digit of the 5-digit NOC code — e.g. NOC 22220 → TEER 2.

Scoring rubric — you MUST use the full 0–100 range and produce differentiated scores:
- 90–100 Strong Match: Candidate meets virtually every requirement; directly relevant experience; minimal ramp-up needed
- 80–89 Strong Match: Meets most requirements; only minor or easily bridgeable gaps
- 70–79 Good Match: Meets core requirements but has 2–3 meaningful gaps or lacks preferred experience
- 60–69 Good Match: Relevant background but notable gaps; upskilling required in key areas
- 45–59 Stretch: Related experience but missing several requirements; significant skill gaps
- 25–44 Stretch: Tangentially related; major gaps across multiple core requirements
- 0–24 Skip: Poor fit; fundamental misalignment between candidate and role

IMPORTANT: Do NOT default to 85. Scores must reflect genuine differentiation — a perfect fit should score 90+, a poor fit should score below 45. Carefully count how many stated requirements the candidate meets vs. misses and let that drive the number. Avoid rounding to multiples of 5.`;

  await new Promise(resolve => setTimeout(resolve, RATE_LIMIT_DELAY_MS));

  try {
    const response = await fetch(ZHIPU_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.ZHIPU_API_KEY}`,
      },
      body: JSON.stringify({
        model: MODEL,
        messages: [{ role: 'user', content: prompt }],
        response_format: { type: 'json_object' },
        temperature: 0.7,
      }),
    });

    if (!response.ok) {
      const body = await response.text();
      const err = new Error(`[zhipu] HTTP ${response.status}: ${body.substring(0, 200)}`);
      if (response.status === 429) {
        err.rateLimited = true;
      }
      throw err;
    }

    const data = await response.json();
    const text = data.choices?.[0]?.message?.content || '';
    console.log(`[zhipu] raw → ${text.substring(0, 300).replace(/\n/g, ' ')}`);
    const parsed = JSON.parse(text);
    console.log(`[zhipu] SUCCESS → score=${parsed.match_score} tier="${parsed.match_tier}"`);
    return parsed;
  } catch (err) {
    const snippet = err.message.substring(0, 200);
    console.error(`[zhipu] ERROR → ${snippet}`);

    if (err.rateLimited) {
      const waitMs = 10000;
      console.log(`[zhipu] Rate limited — waiting ${waitMs / 1000}s before retry`);
      await new Promise(resolve => setTimeout(resolve, waitMs));
      const response = await fetch(ZHIPU_API_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${process.env.ZHIPU_API_KEY}`,
        },
        body: JSON.stringify({
          model: MODEL,
          messages: [{ role: 'user', content: prompt }],
          response_format: { type: 'json_object' },
        temperature: 0.7,
        }),
      });
      if (!response.ok) throw new Error(`[zhipu] retry HTTP ${response.status}`);
      const data = await response.json();
      const text = data.choices?.[0]?.message?.content || '';
      return JSON.parse(text);
    }

    throw err;
  }
}

module.exports = { analyze };
