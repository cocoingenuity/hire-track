require('dotenv').config();
const { GoogleGenerativeAI } = require('@google/generative-ai');

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
const modelName = process.env.GEMINI_MODEL || 'gemini-2.0-flash';
const model = genAI.getGenerativeModel({ model: modelName });

const RATE_LIMIT_DELAY_MS = 4000; // 15 RPM free-tier cap → 1 req / 4 s minimum

async function analyze(resumeText, jobDescription) {
  const jobTitle = jobDescription.split('\n')[0].substring(0, 60);

  if (process.env.DRY_RUN === 'true') {
    const score = 60 + Math.floor(Math.random() * 35);
    const tier = score >= 80 ? 'Strong Match' : score >= 60 ? 'Good Match' : 'Stretch';
    console.log(`[gemini] DRY_RUN → "${jobTitle}" score=${score} tier="${tier}"`);
    return {
      match_score: score,
      match_tier: tier,
      strengths: ['Relevant experience / 相关工作经验'],
      gaps: ['Area to develop / 需要发展的领域'],
      key_requirements: ['Key skill required / 所需关键技能'],
      apply_recommendation: score >= 60,
      one_line_pitch: 'Dry-run placeholder — no Gemini call made.',
      noc_code: '22220 – Computer Network Technicians',
      noc_explanation: 'Dry-run placeholder.',
    };
  }

  const keyPreview = (process.env.GEMINI_API_KEY || '(not set)').substring(0, 10);
  console.log(`[gemini] analyze() → "${jobTitle}" | key: ${keyPreview}...`);
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
  "noc_explanation": "<one sentence explaining why this NOC code applies to this job>"
}

Each item in strengths, gaps, and key_requirements must be a single string formatted as "English description / 简体中文翻译" — the slash separates the two languages.
noc_code must use the Canadian NOC 2021 classification (5-digit codes). Example: "22220 – Computer Network Technicians".
Scoring: Strong Match = 80-100, Good Match = 60-79, Stretch = 40-59, Skip = 0-39`;

  await new Promise(resolve => setTimeout(resolve, RATE_LIMIT_DELAY_MS));

  try {
    const result = await model.generateContent(prompt);
    const text = result.response.text();
    console.log(`[gemini] raw → ${text.substring(0, 300).replace(/\n/g, ' ')}`);
    const jsonStr = text.replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '').trim();
    const parsed = JSON.parse(jsonStr);
    console.log(`[gemini] SUCCESS → score=${parsed.match_score} tier="${parsed.match_tier}"`);
    return parsed;
  } catch (err) {
    const snippet = err.message.substring(0, 200);
    console.error(`[gemini] ERROR → ${snippet}`);

    const isDailyQuota = err.message.includes('PerDayPerProject');
    const retryMatch = err.message.match(/"retryDelay":"(\d+(?:\.\d+)?)s"/);

    if (isDailyQuota) {
      // Daily quota won't recover in minutes — surface immediately so the caller can abort
      const e = new Error(`DAILY_QUOTA_EXCEEDED: ${snippet}`);
      e.dailyQuotaExceeded = true;
      throw e;
    }

    if (retryMatch && err.message.includes('429')) {
      const waitMs = Math.ceil(parseFloat(retryMatch[1]) * 1000) + 2000;
      console.log(`[gemini] Rate limited — waiting ${Math.ceil(waitMs / 1000)}s before retry`);
      await new Promise(resolve => setTimeout(resolve, waitMs));
      try {
        const result = await model.generateContent(prompt);
        const text = result.response.text();
        const jsonStr = text.replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '').trim();
        return JSON.parse(jsonStr);
      } catch (retryErr) {
        if (retryErr.message.includes('PerDayPerProject')) {
          const e = new Error(`DAILY_QUOTA_EXCEEDED: ${retryErr.message.substring(0, 200)}`);
          e.dailyQuotaExceeded = true;
          throw e;
        }
        throw retryErr;
      }
    }
    throw err;
  }
}

module.exports = { analyze };
