// Deletes all ideas whose source_type is "reddit" to clear old mixed-language rows.
import path from 'node:path';
import dotenv from 'dotenv';

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

function ensureEnv(keys: string[]) {
  const missing = keys.filter((key) => !process.env[key]);
  if (missing.length > 0) {
    throw new Error(
      `Missing environment variables: ${missing.join(
        ', ',
      )}. Populate them in .env.local before running.`,
    );
  }
}

async function main() {
  ensureEnv(['NEXT_PUBLIC_SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY']);

  const { supabaseServiceClient } = await import('../lib/supabaseServiceClient');

  console.log('Deleting ideas with source_type = "reddit"...');
  const { data, error } = await supabaseServiceClient
    .from('ideas')
    .delete()
    .eq('source_type', 'reddit')
    .select('id, title');

  if (error) {
    throw error;
  }

  const count = data?.length ?? 0;
  console.log(`Deleted ${count} idea(s).`);
  if (data && data.length > 0) {
    const titles = data.map((row) => row.title);
    console.log('Deleted titles (first 10):', titles.slice(0, 10));
    if (titles.length > 10) {
      console.log(`...and ${titles.length - 10} more.`);
    }
  }
}

main().catch((err) => {
  console.error('Failed to delete reddit ideas:', err);
  process.exit(1);
});
