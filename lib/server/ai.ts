import OpenAI from 'openai';

const apiKey = process.env.DEEPSEEK_API_KEY || process.env.OPENAI_API_KEY;
if (!apiKey) {
  throw new Error('Missing DEEPSEEK_API_KEY or OPENAI_API_KEY for AI enrichment');
}

export const aiClient = new OpenAI({
  baseURL: process.env.DEEPSEEK_API_KEY ? 'https://api.deepseek.com' : undefined,
  apiKey,
});
