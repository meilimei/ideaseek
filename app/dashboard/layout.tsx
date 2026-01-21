import { redirect } from 'next/navigation';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import DashboardNav from './DashboardNav';

export const dynamic = 'force-dynamic';

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createServerSupabaseClient();
  const { data: userData, error } = await supabase.auth.getUser();

  if (error) {
    console.error('Failed to get user for dashboard:', error.message);
  }

  if (!userData?.user) {
    return redirect('/login');
  }

  return (
    <>
      <DashboardNav />
      {children}
    </>
  );
}
