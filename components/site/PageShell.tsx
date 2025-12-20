import type { ReactNode } from 'react';

type PageShellProps = {
  title: string;
  description?: string;
  actions?: ReactNode;
  children: ReactNode;
};

export default function PageShell({
  title,
  description,
  actions,
  children,
}: PageShellProps) {
  return (
    <div className="relative">
      <div className="pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(circle_at_12%_20%,rgba(85,175,210,0.12),transparent_26%),radial-gradient(circle_at_82%_12%,rgba(124,58,237,0.12),transparent_28%)]" />
      <div className="mx-auto max-w-6xl px-4 pb-12 pt-10 md:pt-14">
        <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
          <div className="space-y-2">
            <h1 className="text-3xl font-bold tracking-tight text-slate-50 md:text-4xl">
              {title}
            </h1>
            {description && (
              <p className="max-w-2xl text-base text-slate-300">
                {description}
              </p>
            )}
          </div>
          {actions && <div className="flex items-center gap-3">{actions}</div>}
        </div>
        <div className="mt-8 space-y-8">{children}</div>
      </div>
    </div>
  );
}
