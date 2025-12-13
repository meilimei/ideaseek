import { NextResponse } from 'next/server';
import { deepseek } from '@/lib/deepseekClient';

type GeneratePayload = {
  background: string;
  interests?: string;
  skills?: string;
  constraints?: string;
};

export async function POST(request: Request) {
  try {
    let body: GeneratePayload;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json(
        { error: 'Invalid JSON body' },
        { status: 400 },
      );
    }

    const { background, interests, skills, constraints } = body;

    if (!background || background.trim().length === 0) {
      return NextResponse.json(
        { error: 'Background is required' },
        { status: 400 },
      );
    }

    const prompt = `
You are a startup opportunity analyst. Given a founder's background and preferences, propose 5 startup ideas tailored to them.

BACKGROUND:
${background}

INTERESTS:
${interests || 'N/A'}

SKILLS:
${skills || 'N/A'}

CONSTRAINTS:
${constraints || 'N/A'}

Return a single JSON object in this exact shape:
{
  "ideas": [
    {
      "title": "string",
      "one_liner": "string",
      "description": "string",
      "tags": ["SaaS", "B2B", "AI"],
      "difficulty": 1-5,
      "market_size": "S" | "M" | "L",
      "demand_strength": "weak" | "medium" | "strong",
      "pain_points": ["..."],
      "target_users": "...",
      "next_steps": "..."
    }
  ]
}
Use English only. Ensure the JSON is valid and parseable.
`;

    const completion = await deepseek.chat.completions.create({
      model: 'deepseek-chat',
      messages: [
        {
          role: 'system',
          content:
            'You are a precise JSON generator that outputs only valid JSON objects.',
        },
        { role: 'user', content: prompt },
      ],
      response_format: { type: 'json_object' },
      temperature: 0.8,
      max_tokens: 2000,
    });

    const content = completion.choices[0]?.message?.content ?? '{}';

    let parsed: unknown;
    try {
      parsed = JSON.parse(content);
    } catch (err) {
      console.error('Failed to parse AI response:', err, content);
      return NextResponse.json(
        { error: 'Failed to parse AI response' },
        { status: 500 },
      );
    }

    if (
      !parsed ||
      typeof parsed !== 'object' ||
      !Array.isArray((parsed as { ideas?: unknown }).ideas)
    ) {
      console.error('AI response missing ideas array:', parsed);
      return NextResponse.json(
        { error: 'Failed to parse AI response' },
        { status: 500 },
      );
    }

    return NextResponse.json({ ideas: (parsed as { ideas: unknown[] }).ideas });
  } catch (err) {
    console.error('Internal error generating ideas:', err);
    return NextResponse.json(
      { error: 'Internal error' },
      { status: 500 },
    );
  }
}
