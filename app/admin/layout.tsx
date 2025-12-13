import Link from 'next/link';
import { requireAdmin } from '@/lib/auth/requireAdmin';

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  await requireAdmin();

  const navItems = [
    { href: '/admin/jobs', label: 'Jobs' },
    { href: '/admin/ideas', label: 'Ideas' },
    { href: '/admin/trends', label: 'Trends' },
    { href: '/admin/raw', label: 'Raw Data' },
  ];

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="border-b bg-white">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-4">
          <div className="text-lg font-semibold">Admin</div>
          <nav className="flex items-center gap-3 text-sm text-gray-700">
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
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-4 py-8">{children}</main>
    </div>
  );
}
