import Link from 'next/link';
import { redirect } from 'next/navigation';
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
        <div className="text-2xl font-semibold text-gray-900">Access denied (403)</div>
        <div className="text-sm text-gray-600">
          You must be an admin to access this area.
          {process.env.NODE_ENV !== 'production' && (
            <div className="mt-3 space-y-1 text-left text-xs text-gray-500">
              {auth.userId && <div>User ID: {auth.userId}</div>}
              <div>Profile found: {auth.profileFound ? 'yes' : 'no'}</div>
              <div>Role: {auth.role ?? 'null'}</div>
            </div>
          )}
        </div>
        <Link
          href="/"
          className="rounded-md border px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
        >
          Go home
        </Link>
      </div>
    );
  }

  const navItems = [
    { href: '/admin/jobs', label: 'Jobs' },
    { href: '/admin/ideas', label: 'Ideas' },
    { href: '/admin/trends', label: 'Trends' },
    { href: '/admin/data/reddit-posts', label: 'Reddit Posts' },
    { href: '/admin/data/trends-snapshots', label: 'Trends Snapshots' },
    { href: '/admin/raw', label: 'Raw Data' },
  ];

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="mx-auto flex max-w-6xl gap-6 px-4 py-8">
        <aside className="w-48 flex-shrink-0 space-y-2">
          <div className="text-lg font-semibold text-gray-900">Admin</div>
          <nav className="flex flex-col gap-1 text-sm text-gray-700">
            <Link
              href="/admin"
              className="rounded-md px-3 py-2 hover:bg-gray-100"
            >
              Dashboard
            </Link>
            {navItems.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className="rounded-md px-3 py-2 hover:bg-gray-100"
              >
                {item.label}
              </Link>
            ))}
          </nav>
        </aside>
        <main className="flex-1">{children}</main>
      </div>
    </div>
  );
}
