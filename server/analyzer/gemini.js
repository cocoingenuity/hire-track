require('dotenv').config();
const { GoogleGenerativeAI } = require('@google/generative-ai');

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash' });

// 5 s between calls keeps us safely under the 15 RPM free-tier limit
const RATE_LIMIT_DELAY_MS = 5000;

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

  try {
    const result = await model.generateContent(prompt);
    const text = result.response.text();
    const jsonStr = text.replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '').trim();
    return JSON.parse(jsonStr);
  } catch (err) {
    // On 429, respect the Retry-After delay the API includes in the error message
    const retryMatch = err.message.match(/"retryDelay":"(\d+(?:\.\d+)?)s"/);
    if (retryMatch && err.message.includes('429')) {
      const waitMs = Math.ceil(parseFloat(retryMatch[1]) * 1000) + 2000;
      console.log(`[analyzer] Rate limited — waiting ${Math.ceil(waitMs / 1000)}s before retry`);
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
