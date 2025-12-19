import Link from 'next/link';
import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import { supabaseServiceClient as supabase } from '@/lib/supabaseServiceClient';
import { ShareButtons } from '@/components/site/ShareButtons';

type Idea = {
  id: string;
  slug: string;
  title: string;
  one_liner: string | null;
  description: string | null;
  tags: string[] | null;
  score: number | null;
  status: string | null;
  status_reason: string | null;
  source_type: string | null;
  created_at: string;
  seo_title?: string | null;
  seo_description?: string | null;
};

function truncate(text: string, len = 150) {
  if (text.length <= len) return text;
  return `${text.slice(0, len - 3)}...`;
}

function siteUrl() {
  if (process.env.NEXT_PUBLIC_SITE_URL) return process.env.NEXT_PUBLIC_SITE_URL;
  if (process.env.VERCEL_URL) return `https://${process.env.VERCEL_URL}`;
  return 'http://localhost:3000';
}

async function fetchIdea(slug: string): Promise<Idea | null> {
  const { data, error } = await supabase
    .from('ideas')
    .select(
      'id, slug, title, one_liner, description, tags, score, status, status_reason, source_type, created_at, seo_title, seo_description',
    )
    .eq('slug', slug)
    .eq('published', true)
    .maybeSingle();
  if (error || !data) return null;
  return data as Idea;
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const idea = await fetchIdea(slug);
  const base = siteUrl();
  if (!idea) {
    return {
      title: 'Idea not found',
      description: 'This idea could not be found.',
    };
  }
  const title = idea.seo_title ?? idea.title;
  const description =
    idea.seo_description ??
    idea.one_liner ??
    (idea.description ? truncate(idea.description, 150) : undefined) ??
    'Startup idea opportunity.';
  const url = `${base}/idea/${slug}`;

  return {
    title,
    description,
    alternates: { canonical: url },
    openGraph: {
      title,
      description,
      url,
      siteName: 'IdeaSignal',
      type: 'article',
      images: [`${url.replace(`/idea/${slug}`, '')}/api/og/idea?slug=${slug}`],
    },
    twitter: {
      card: 'summary_large_image',
      title,
      description,
      images: [`${url.replace(`/idea/${slug}`, '')}/api/og/idea?slug=${slug}`],
    },
  };
}

export default async function IdeaSharePage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const idea = await fetchIdea(slug);
  if (!idea) return notFound();

  return (
    <div className="mx-auto max-w-4xl px-4 py-10 space-y-6">
      <div className="rounded-2xl border border-gray-200 bg-white/80 p-6 shadow-sm backdrop-blur">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-xs uppercase tracking-[0.14em] text-indigo-600">
              Opportunity Report
            </p>
            <h1 className="mt-1 text-3xl font-bold tracking-tight text-gray-900">
              {idea.title}
            </h1>
            {idea.one_liner && (
              <p className="mt-2 text-gray-700">{idea.one_liner}</p>
            )}
            <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-gray-600">
              {idea.status && (
                <span className="rounded-full bg-indigo-50 px-2 py-0.5 text-indigo-700 border border-indigo-100">
                  {idea.status}
                </span>
              )}
              {idea.score != null && (
                <span className="rounded-full bg-amber-50 px-2 py-0.5 text-amber-700 border border-amber-100">
                  Score: {idea.score.toFixed(1)} / 5
                </span>
              )}
              {idea.tags?.map((tag) => (
                <span
                  key={tag}
                  className="rounded-full border px-2 py-0.5"
                >
                  {tag}
                </span>
              ))}
            </div>
          </div>
          <ShareButtons title={idea.title} />
        </div>
      </div>

      <div className="rounded-2xl border border-gray-200 bg-white/80 p-6 shadow-sm backdrop-blur space-y-4">
        {idea.description ? (
          <p className="text-gray-800 leading-relaxed whitespace-pre-line">
            {idea.description}
          </p>
        ) : (
          <p className="text-sm text-gray-500">No description available.</p>
        )}
      </div>

      <div className="flex flex-wrap gap-2 text-sm text-gray-600">
        <Link
          href="/ideas/database"
          className="rounded-md border px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-50"
        >
          Back to ideas
        </Link>
        <Link
          href={`/ideas/database?q=${encodeURIComponent(idea.title)}`}
          className="rounded-md border px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-50"
        >
          Search similar ideas
        </Link>
      </div>
    </div>
  );
}
