import Link from 'next/link';
import { redirect } from 'next/navigation';
import { AdminShell } from '@/components/admin/AdminShell';
import { requireAdmin } from '@/lib/auth/requireAdmin';

export const dynamic = 'force-dynamic';

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const auth = await requireAdmin();

  if (auth.status === 'unauthenticated') {
    return redirect('/');
  }

  if (auth.status === 'forbidden') {
    return (
      <div className="mx-auto flex min-h-screen max-w-3xl flex-col items-center justify-center gap-4 px-4 text-center">
        <div className="text-2xl font-semibold text-foreground">Access denied (403)</div>
        <div className="text-sm text-muted-foreground">
          You must be an admin to access this area.
          {process.env.NODE_ENV !== 'production' && (
            <div className="mt-3 space-y-1 text-left text-xs text-muted-foreground/80">
              {auth.userId && <div>User ID: {auth.userId}</div>}
              <div>Profile found: {auth.profileFound ? 'yes' : 'no'}</div>
              <div>Role: {auth.role ?? 'null'}</div>
            </div>
          )}
        </div>
        <Link
          href="/"
          className="rounded-full border border-border/60 px-4 py-2 text-sm text-foreground shadow-soft transition hover:bg-white/5"
        >
          Go home
        </Link>
      </div>
    );
  }

  const metadata = (auth.user.user_metadata ?? {}) as Record<string, any>;
  const userEmail = auth.user.email ?? null;
  const userName = typeof metadata.full_name === 'string' ? metadata.full_name : null;
  const avatarUrl =
    typeof metadata.avatar_url === 'string' && metadata.avatar_url.trim()
      ? metadata.avatar_url
      : null;

  return (
    <AdminShell userEmail={userEmail} userName={userName} avatarUrl={avatarUrl}>
      {children}
    </AdminShell>
  );
}
