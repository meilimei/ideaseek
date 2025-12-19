import { ImageResponse } from 'next/og';
import { supabaseServiceClient as supabase } from '@/lib/supabaseServiceClient';

export const runtime = 'edge';

const font = fetch(
  new URL('../../../public/fonts/Inter-Bold.ttf', import.meta.url),
).then((res) => res.arrayBuffer());

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const slug = searchParams.get('slug');
  if (!slug) {
    return new Response('Missing slug', { status: 400 });
  }

  const { data, error } = await supabase
    .from('ideas')
    .select('title, one_liner, tags, status, score')
    .eq('slug', slug)
    .eq('published', true)
    .maybeSingle();

  if (error || !data) {
    return new Response('Not found', { status: 404 });
  }

  const fontData = await font.catch(() => undefined);
  const tags = (data.tags as string[] | null) ?? [];

  return new ImageResponse(
    (
      <div
        style={{
          width: '1200px',
          height: '630px',
          display: 'flex',
          flexDirection: 'column',
          background: 'linear-gradient(135deg, #fff7ed, #eef2ff)',
          color: '#0f172a',
          padding: '48px',
          fontFamily: '"Inter", sans-serif',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ fontSize: 28, fontWeight: 700, color: '#4338ca' }}>IdeaSignal</div>
          <div style={{ display: 'flex', gap: '10px', fontSize: 20 }}>
            {data.status && (
              <span
                style={{
                  padding: '6px 12px',
                  borderRadius: 999,
                  background: '#eef2ff',
                  color: '#4338ca',
                  border: '1px solid #e0e7ff',
                }}
              >
                {data.status}
              </span>
            )}
            {typeof data.score === 'number' && (
              <span
                style={{
                  padding: '6px 12px',
                  borderRadius: 999,
                  background: '#fffbeb',
                  color: '#92400e',
                  border: '1px solid #fef3c7',
                }}
              >
                Score: {data.score.toFixed(1)} / 5
              </span>
            )}
          </div>
        </div>

        <div style={{ marginTop: 40, fontSize: 44, fontWeight: 800, lineHeight: 1.1 }}>
          {data.title}
        </div>
        {data.one_liner && (
          <div style={{ marginTop: 20, fontSize: 26, color: '#475569', maxWidth: '1000px' }}>
            {data.one_liner}
          </div>
        )}

        <div style={{ marginTop: 28, display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
          {tags.slice(0, 4).map((tag) => (
            <span
              key={tag}
              style={{
                padding: '8px 14px',
                borderRadius: 999,
                border: '1px solid #e2e8f0',
                background: '#fff',
                fontSize: 18,
              }}
            >
              {tag}
            </span>
          ))}
        </div>
      </div>
    ),
    {
      width: 1200,
      height: 630,
      fonts: fontData
        ? [
            {
              name: 'Inter',
              data: fontData,
              style: 'normal',
            },
          ]
        : undefined,
    },
  );
}
