import path from 'node:path';
import dotenv from 'dotenv';
import { createClient } from '@supabase/supabase-js';

if (
  !process.env.NEXT_PUBLIC_SUPABASE_URL ||
  !process.env.SUPABASE_SERVICE_ROLE_KEY
) {
  dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });
}

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceRoleKey) {
  throw new Error('Missing Supabase environment variables');
}

export const supabaseServiceClient = createClient(
  supabaseUrl,
  supabaseServiceRoleKey,
);
