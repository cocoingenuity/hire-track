require('dotenv').config();

const DEEPSEEK_API_URL = 'https://api.deepseek.com/chat/completions';
const MODEL = process.env.DEEPSEEK_MODEL || 'deepseek-v4-flash';
const RATE_LIMIT_DELAY_MS = 200;

function buildStrategySection(strategy) {
  const s = strategy || {};
  const visaStatus      = s.visa_status          || 'PGWP';
  const languages       = Array.isArray(s.languages) ? s.languages : ['English'];
  const hasVehicle      = !!s.has_vehicle;
  const hasClearance    = !!s.security_clearance;
  const targetRoles     = s.target_roles         || '';
  const expLevels       = Array.isArray(s.experience_level) ? s.experience_level : [s.experience_level || 'Entry-level'];
  const blacklisted     = s.blacklisted_keywords || '';
  const employmentType  = s.employment_type      || 'any';
  const workModel       = Array.isArray(s.work_model) ? s.work_model : [];

  // PR/citizenship and security clearance are now handled deterministically
  // (see server/analyzer/blockers.js, applied in the analyze() route); they are
  // intentionally NOT given to the LLM, which previously over-/under-applied them.
  const blockers = [];
  if (!languages.includes('French')) {
    blockers.push(
      `${blockers.length + 1}. Job requires French language proficiency (candidate does not speak French)`
    );
  }
  if (!hasVehicle) {
    blockers.push(
      `${blockers.length + 1}. Job requires a G driver's license or personal vehicle (candidate does not have one)`
    );
  }
  if (employmentType === 'permanent') {
    blockers.push(
      `${blockers.length + 1}. Job is a short-term contract, temporary, or independent contractor role (candidate seeks permanent full-time employment only)`
    );
  }

  const candidateContext = [
    s.candidate_note && `- Candidate: ${s.candidate_note}`,
    `- Immigration status: ${visaStatus}`,
    `- Languages: ${languages.join(', ')}`,
    `- Has vehicle / G license: ${hasVehicle ? 'Yes' : 'No'}`,
    `- Security clearance eligible: ${hasClearance ? 'Yes' : 'No'}`,
    targetRoles              && `- Target roles: ${targetRoles}`,
    expLevels.length > 0     && `- Experience level: ${expLevels.join(', ')}`,
    employmentType !== 'any' && `- Employment type preference: ${employmentType === 'permanent' ? 'Permanent / Full-time only' : 'Open to contracts'}`,
    workModel.length > 0     && `- Work model preference: ${workModel.join(', ')}`,
    blacklisted              && `- Deprioritize roles containing: ${blacklisted}`,
  ].filter(Boolean).join('\n');

  const blacklistInstruction = blacklisted
    ? `\nDEPRIORITIZE: If the job title or description contains any of these keywords, score ≤ 35 and set apply_recommendation to false unless the role is otherwise an exceptional match: ${blacklisted}.`
    : '';

  return { candidateContext, blockers, blacklistInstruction };
}

async function analyze(resumeText, jobDescription, strategy = {}) {
  const jobTitle = jobDescription.split('\n')[0].substring(0, 60);

  if (process.env.DRY_RUN === 'true') {
    const score = 60 + Math.floor(Math.random() * 35);
    const tier = score >= 80 ? 'Strong Match' : score >= 60 ? 'Good Match' : 'Stretch';
    console.log(`[deepseek] DRY_RUN → "${jobTitle}" score=${score} tier="${tier}"`);
    return {
      match_score: score,
      match_tier: tier,
      strengths: ['Relevant experience / 相关工作经验'],
      gaps: ['Area to develop / 需要发展的领域'],
      key_requirements: ['Key skill required / 所需关键技能'],
      apply_recommendation: score >= 60,
      one_line_pitch: 'Dry-run placeholder — no DeepSeek call made.',
      noc_code: '22220 – Computer Network Technicians',
      noc_explanation: 'Dry-run placeholder.',
      teer_level: 2,
    };
  }

  const keyPreview = (process.env.DEEPSEEK_API_KEY || '(not set)').substring(0, 10);
  console.log(`[deepseek] analyze() → "${jobTitle}" | key: ${keyPreview}...`);

  const { candidateContext, blockers, blacklistInstruction } = buildStrategySection(strategy);

  const blockersSection = blockers.length > 0
    ? `HARD BLOCKERS — if any of the following apply, the match_score MUST be 35 or below, match_tier MUST be "Skip", and apply_recommendation MUST be false. List the blocker as the first item in gaps:\n${blockers.join('\n')}`
    : '';

  const prompt = `You are a job application assistant evaluating candidate fit.

CANDIDATE CONTEXT:
${candidateContext}

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
${blockersSection ? '\n' + blockersSection : ''}${blacklistInstruction}

Score skill and experience fit ONLY. Do NOT lower the score for immigration status, security clearance, or co-op/internship eligibility — those disqualifiers are evaluated deterministically outside this prompt.

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

  const FETCH_TIMEOUT_MS = 60000;

  function fetchWithTimeout(url, options) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
    return fetch(url, { ...options, signal: controller.signal })
      .finally(() => clearTimeout(timer));
  }

  try {
    const response = await fetchWithTimeout(DEEPSEEK_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.DEEPSEEK_API_KEY}`,
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
      const err = new Error(`[deepseek] HTTP ${response.status}: ${body.substring(0, 200)}`);
      if (response.status === 429) err.rateLimited = true;
      throw err;
    }

    const data = await response.json();
    const text = data.choices?.[0]?.message?.content || '';
    console.log(`[deepseek] raw → ${text.substring(0, 300).replace(/\n/g, ' ')}`);
    const parsed = JSON.parse(text);
    console.log(`[deepseek] SUCCESS → score=${parsed.match_score} tier="${parsed.match_tier}"`);
    return parsed;
  } catch (err) {
    const snippet = err.message.substring(0, 200);
    console.error(`[deepseek] ERROR → ${snippet}`);

    if (err.rateLimited) {
      const waitMs = 10000;
      console.log(`[deepseek] Rate limited — waiting ${waitMs / 1000}s before retry`);
      await new Promise(resolve => setTimeout(resolve, waitMs));
      const response = await fetchWithTimeout(DEEPSEEK_API_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${process.env.DEEPSEEK_API_KEY}`,
        },
        body: JSON.stringify({
          model: MODEL,
          messages: [{ role: 'user', content: prompt }],
          response_format: { type: 'json_object' },
          temperature: 0.7,
        }),
      });
      if (!response.ok) throw new Error(`[deepseek] retry HTTP ${response.status}`);
      const data = await response.json();
      const text = data.choices?.[0]?.message?.content || '';
      return JSON.parse(text);
    }

    throw err;
  }
}

module.exports = { analyze };
