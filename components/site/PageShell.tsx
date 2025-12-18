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
      <div className="pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(circle_at_20%_20%,rgba(255,237,213,0.35),transparent_30%),radial-gradient(circle_at_80%_0%,rgba(219,234,254,0.35),transparent_28%),linear-gradient(180deg,rgba(255,255,255,0.8),rgba(249,250,251,0.9))]" />
      <div className="mx-auto max-w-6xl px-4 pb-12 pt-8 md:pt-12">
        <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
          <div className="space-y-2">
            <h1 className="text-3xl font-bold tracking-tight text-gray-900 md:text-4xl">
              {title}
            </h1>
            {description && (
              <p className="max-w-2xl text-base text-gray-600">{description}</p>
            )}
          </div>
          {actions && <div className="flex items-center gap-3">{actions}</div>}
        </div>
        <div className="mt-8 space-y-8">{children}</div>
      </div>
    </div>
  );
}
