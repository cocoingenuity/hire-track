require('dotenv').config();
const { GoogleGenerativeAI } = require('@google/generative-ai');

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash' });

const RATE_LIMIT_DELAY_MS = 500;

async function analyze(resumeText, jobDescription) {
  const prompt = `You are a job application assistant evaluating candidate fit.

RESUME:
${resumeText}

JOB DESCRIPTION:
${jobDescription}

Analyze how well this candidate matches this job. Return ONLY valid JSON with this exact structure — no markdown, no explanation, no code fences:
{
  "match_score": <integer 0-100>,
  "match_tier": "<Strong Match|Good Match|Stretch|Skip>",
  "strengths": ["<strength1>", "<strength2>"],
  "gaps": ["<gap1>", "<gap2>"],
  "key_requirements": ["<req1>", "<req2>", "<req3>"],
  "apply_recommendation": <true|false>,
  "one_line_pitch": "<personalized cover letter opener>"
}

Scoring: Strong Match = 80-100, Good Match = 60-79, Stretch = 40-59, Skip = 0-39`;

  await new Promise(resolve => setTimeout(resolve, RATE_LIMIT_DELAY_MS));

  const result = await model.generateContent(prompt);
  const text = result.response.text();

  // Strip markdown code fences if model wraps response
  const jsonStr = text.replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '').trim();

  return JSON.parse(jsonStr);
}

module.exports = { analyze };
