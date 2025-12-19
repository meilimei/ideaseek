import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/auth/requireAdmin';
import { supabaseServiceClient as supabase } from '@/lib/supabaseServiceClient';
import { slugify } from '@/lib/utils/slugify';

const allowedFields = [
  'title',
  'one_liner',
  'description',
  'tags',
  'difficulty',
  'market_size',
  'demand_strength',
  'pain_points',
  'target_users',
  'market_stage',
  'competition',
  'monetization',
  'key_risks',
  'next_steps',
  'source_type',
  'source_url',
  'status',
  'pinned',
  'featured',
  'deleted_at',
  'published',
] as const;

export async function GET(
  _req: Request,
  context: { params: Promise<{ id: string }> },
) {
  const auth = await requireAdmin();
  if (auth.status === 'unauthenticated') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  if (auth.status === 'forbidden') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const { id } = await context.params;
  const { data, error } = await supabase
    .from('ideas')
    .select(
      'id, title, one_liner, description, tags, difficulty, market_size, demand_strength, pain_points, target_users, market_stage, competition, monetization, key_risks, next_steps, source_type, source_url, status, pinned, featured, deleted_at, created_at, updated_at',
    )
    .eq('id', id)
    .maybeSingle();

  if (error) {
    console.error('Failed to fetch idea:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  if (!data) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  return NextResponse.json(data);
}

export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const auth = await requireAdmin();
  if (auth.status === 'unauthenticated') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  if (auth.status === 'forbidden') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const { id } = await context.params;
  const body = await request.json().catch(() => ({}));

  const updates: Record<string, unknown> = {};
  for (const field of allowedFields) {
    if (field in body) {
      updates[field] = body[field];
    }
  }

  if (body.deleted === true) {
    updates.deleted_at = new Date().toISOString();
  } else if (body.deleted === false) {
    updates.deleted_at = null;
  }

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: 'No fields to update' }, { status: 400 });
  }

  updates.updated_at = new Date().toISOString();

  // Publish workflow
  if (body.published === true) {
    const { data: idea } = await supabase
      .from('ideas')
      .select('id, title, one_liner, description, slug')
      .eq('id', id)
      .maybeSingle();

    if (!idea?.title) {
      return NextResponse.json({ error: 'Idea not found or missing title' }, { status: 404 });
    }

    let baseSlug = idea.slug || slugify(idea.title);
    let finalSlug = baseSlug;
    // ensure unique
    const { data: existing } = await supabase
      .from('ideas')
      .select('id')
      .eq('slug', finalSlug)
      .neq('id', id)
      .limit(1);
    if (existing && existing.length > 0) {
      const shortId = id.slice(-6);
      finalSlug = `${baseSlug}-${shortId}`;
    }

    const seoTitle = `${idea.title} — IdeaSignal`;
    const seoDescription =
      idea.one_liner ??
      (idea.description ? `${idea.description.slice(0, 150)}${idea.description.length > 150 ? '...' : ''}` : null);

    updates.slug = finalSlug;
    updates.seo_title = seoTitle;
    updates.seo_description = seoDescription;
    updates.published = true;
    updates.published_at = new Date().toISOString();
  } else if (body.published === false) {
    updates.published = false;
  }

  const { data, error } = await supabase
    .from('ideas')
    .update(updates)
    .eq('id', id)
    .select(
      'id, title, one_liner, description, tags, difficulty, market_size, demand_strength, pain_points, target_users, market_stage, competition, monetization, key_risks, next_steps, source_type, source_url, status, pinned, featured, deleted_at, created_at, updated_at',
    )
    .single();

  if (error) {
    console.error('Failed to update idea:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(data);
}

export async function DELETE(
  _req: Request,
  context: { params: Promise<{ id: string }> },
) {
  const auth = await requireAdmin();
  if (auth.status === 'unauthenticated') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  if (auth.status === 'forbidden') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const { id } = await context.params;

  const { data, error } = await supabase
    .from('ideas')
    .update({ deleted_at: new Date().toISOString(), updated_at: new Date().toISOString() })
    .eq('id', id)
    .select('id, deleted_at')
    .single();

  if (error) {
    console.error('Failed to delete idea:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(data);
}
