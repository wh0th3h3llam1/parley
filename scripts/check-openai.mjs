import OpenAI from 'openai';
import { zodTextFormat } from 'openai/helpers/zod';
import { z } from 'zod';

if (!process.env.OPENAI_API_KEY || !process.env.OPENAI_MODEL) throw new Error('OPENAI_API_KEY and OPENAI_MODEL are required.');
const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY, timeout: 15000, maxRetries: 0 });
const response = await client.responses.parse({
  model: process.env.OPENAI_MODEL,
  instructions: 'Rewrite the provided sentence as a concise first-person trip-agent message. Keep all prices exactly. Return only the message field.',
  input: '$500 does not work. My hard cap is $420.',
  text: { format: zodTextFormat(z.object({ message: z.string().min(1).max(240) }).strict(), 'agent_message') }
});
const message = response.output_parsed?.message;
if (!message?.includes('$500') || !message.includes('$420')) throw new Error('Structured output did not preserve the hard-limit prices.');
console.log(JSON.stringify({ result: 'pass', model: process.env.OPENAI_MODEL, structuredOutput: true, preservedPrices: true }));
