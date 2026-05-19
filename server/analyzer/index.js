const provider = process.env.AI_PROVIDER || 'gemini';
module.exports = require(`./${provider}`);
