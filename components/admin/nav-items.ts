export type AdminNavItem = {
  href: string;
  label: string;
  group: 'core' | 'data';
  icon?: string;
};

export const adminNavItems: AdminNavItem[] = [
  { href: '/admin', label: 'Dashboard', group: 'core', icon: 'grid' },
  { href: '/admin/jobs', label: 'Jobs', group: 'core', icon: 'cpu' },
  { href: '/admin/strategies', label: 'Strategies', group: 'core', icon: 'settings' },
  { href: '/admin/ideas', label: 'Ideas', group: 'core', icon: 'sparkles' },
  { href: '/admin/trends', label: 'Trends', group: 'core', icon: 'chart' },
  { href: '/admin/data/ideas', label: 'Ideas (Data)', group: 'data', icon: 'database' },
  { href: '/admin/data/reddit-posts', label: 'Reddit Posts', group: 'data', icon: 'reddit' },
  { href: '/admin/data/trends-snapshots', label: 'Trends Snapshots', group: 'data', icon: 'activity' },
  { href: '/admin/raw', label: 'Raw Data', group: 'data', icon: 'archive' },
];
