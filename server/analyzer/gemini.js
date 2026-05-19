require('dotenv').config();
const { GoogleGenerativeAI } = require('@google/generative-ai');

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
const modelName = process.env.GEMINI_MODEL || 'gemini-2.5-flash';
const model = genAI.getGenerativeModel({ model: modelName });

const RATE_LIMIT_DELAY_MS = 500;

async function analyze(resumeText, jobDescription) {
  const keyPreview = (process.env.GEMINI_API_KEY || '(not set)').substring(0, 10);
  const jobTitle = jobDescription.split('\n')[0].substring(0, 60);
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
    const snippet = err.message.substring(0, 120);
    console.error(`[gemini] ERROR → ${snippet}`);
    // On 429, respect the Retry-After delay the API includes in the error message
    const retryMatch = err.message.match(/"retryDelay":"(\d+(?:\.\d+)?)s"/);
    if (retryMatch && err.message.includes('429')) {
      const waitMs = Math.ceil(parseFloat(retryMatch[1]) * 1000) + 2000;
      console.log(`[gemini] Rate limited — waiting ${Math.ceil(waitMs / 1000)}s before retry`);
      await new Promise(resolve => setTimeout(resolve, waitMs));
      const result = await model.generateContent(prompt);
      const text = result.response.text();
      const jsonStr = text.replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '').trim();
      return JSON.parse(jsonStr);
    }
    throw err;
  }
}

module.exports = { analyze };
