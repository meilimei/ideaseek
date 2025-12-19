import { MetadataRoute } from 'next';
import { supabaseServiceClient as supabase } from '@/lib/supabaseServiceClient';

function siteUrl() {
  if (process.env.NEXT_PUBLIC_SITE_URL) return process.env.NEXT_PUBLIC_SITE_URL;
  if (process.env.VERCEL_URL) return `https://${process.env.VERCEL_URL}`;
  return 'http://localhost:3000';
}

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base = siteUrl();

  const staticRoutes: MetadataRoute.Sitemap = [
    { url: `${base}/` },
    { url: `${base}/ideas/database` },
    { url: `${base}/trends` },
    { url: `${base}/pricing` },
    { url: `${base}/market-insights` },
  ];

  const ideas: MetadataRoute.Sitemap = [];
  const trends: MetadataRoute.Sitemap = [];

  try {
    const { data } = await supabase
      .from('ideas')
      .select('slug, updated_at')
      .eq('published', true)
      .not('slug', 'is', null);
    if (Array.isArray(data)) {
      for (const row of data) {
        ideas.push({
          url: `${base}/idea/${row.slug}`,
          lastModified: row.updated_at ? new Date(row.updated_at) : undefined,
        });
      }
    }
  } catch {
    // ignore errors
  }

  try {
    const { data } = await supabase
      .from('trends')
      .select('slug, updated_at')
      .not('slug', 'is', null);
    if (Array.isArray(data)) {
      for (const row of data) {
        trends.push({
          url: `${base}/trends/${row.slug}`,
          lastModified: row.updated_at ? new Date(row.updated_at) : undefined,
        });
      }
    }
  } catch {
    // ignore errors
  }

  return [...staticRoutes, ...ideas, ...trends];
}
