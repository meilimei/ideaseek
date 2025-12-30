'use server';

import { revalidatePath } from 'next/cache';
import { requireAdmin } from '@/lib/auth/requireAdmin';
import { createAdminJob, getAdminJob } from '@/lib/server/adminJobs';

export async function rerunIdeaEnrich(jobId: string) {
  const auth = await requireAdmin();
  if (auth.status !== 'ok') {
    throw new Error('Unauthorized');
  }

  const job = await getAdminJob(jobId);
  if (!job) {
    throw new Error('Job not found');
  }

  if (job.job_type !== 'idea_enrich') {
    throw new Error('Job is not idea_enrich');
  }

  const payload = (job.payload ?? {}) as Record<string, unknown>;

  await createAdminJob('idea_enrich', {
    payload,
    createdBy: auth.user.id,
    source: 'admin',
  });

  revalidatePath('/admin/jobs');
  revalidatePath(`/admin/jobs/${jobId}`);
}
