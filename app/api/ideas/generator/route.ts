// app/api/ideas/generator/route.ts
import { NextResponse } from 'next/server';
import { deepseek } from '@/lib/deepseekClient';

type GenerateRequest = {
  userProfile: string;
  preferences?: string;
  count?: number;
};

export async function POST(req: Request) {
  let body: GenerateRequest;

  try {
    body = await req.json();
  } catch {
    return NextResponse.json(
      { error: 'Invalid JSON body' },
      { status: 400 }
    );
  }

  const { userProfile, preferences, count = 5 } = body;

  if (!userProfile || userProfile.trim().length === 0) {
    return NextResponse.json(
      { error: 'userProfile is required' },
      { status: 400 }
    );
  }

  const prompt = `
You are an expert startup and indie hacker opportunity analyst.
Given the following user profile and preferences, generate ${count} realistic SaaS / product / tool ideas that are feasible for a solo founder or small team.

The user will parse your reply as JSON. 
OUTPUT FORMAT (JSON):

{
  "ideas": [
    {
      "title": "string",
      "one_liner": "short value prop in English",
      "tags": ["B2B", "SaaS", "devtools"],
      "difficulty": 1,
      "market_size": "S|M|L",
      "description": "2-4 sentences describing the solution and core features.",
      "demand_strength": "weak|medium|strong",
      "pain_points": ["..."],
      "target_users": "who this is for",
      "market_stage": "emerging|growing|mature",
      "competition": "short text",
      "monetization": ["..."],
      "key_risks": ["..."],
      "next_steps": "2-3 concrete next steps for validation and execution"
    }
  ]
}

RULES:
- Always output a single JSON object exactly in the above format.
- Use concise, clear English.
- Make sure the JSON is valid and parseable.

User profile:
${userProfile}

Preferences:
${preferences || 'N/A'}
`;

  try {
    const completion = await deepseek.chat.completions.create({
      model: 'deepseek-chat',
      messages: [
        {
          role: 'system',
          content:
            'You are a precise JSON generator that outputs only JSON objects.',
        },
        { role: 'user', content: prompt },
      ],
      // DeepSeek JSON 输出模式
      response_format: {
        type: 'json_object',
      },
      temperature: 0.9,
      max_tokens: 2000,
    });

    const content = completion.choices[0]?.message?.content ?? '{}';

    let parsed: any;
    try {
      parsed = JSON.parse(content);
    } catch (err) {
      console.error('Failed to parse DeepSeek JSON:', err, content);
      return NextResponse.json(
        { error: 'Failed to parse AI response as JSON' },
        { status: 500 }
      );
    }

    if (!parsed || !Array.isArray(parsed.ideas)) {
      return NextResponse.json(
        { error: 'AI response missing "ideas" array' },
        { status: 500 }
      );
    }

    return NextResponse.json({ ideas: parsed.ideas });
  } catch (err: any) {
    console.error('Error calling DeepSeek:', err);
    return NextResponse.json(
      { error: 'Failed to generate ideas' },
      { status: 500 }
    );
  }
}
