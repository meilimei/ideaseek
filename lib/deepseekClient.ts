// lib/deepseekClient.ts
import OpenAI from 'openai';

if (!process.env.DEEPSEEK_API_KEY) {
  throw new Error('Missing DEEPSEEK_API_KEY environment variable');
}

// DeepSeek API is OpenAI-compatible; we just change baseURL and apiKey.
export const deepseek = new OpenAI({
  baseURL: 'https://api.deepseek.com',
  apiKey: process.env.DEEPSEEK_API_KEY,
});
