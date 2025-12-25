import * as React from 'react';
import { cn } from '@/lib/utils/cn';
import { Button, type ButtonProps } from '@/components/ui/button';
import { Input, type InputProps } from '@/components/ui/input';

export function GlassCard({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        'rounded-3xl border border-border/40 bg-background/70 shadow-soft backdrop-blur-xl',
        className,
      )}
      {...props}
    />
  );
}

export function GlassPanel({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        'rounded-2xl border border-border/30 bg-card/60 shadow-soft backdrop-blur-lg',
        className,
      )}
      {...props}
    />
  );
}

export function SectionHeader({
  title,
  description,
  actions,
  className,
}: {
  title: string;
  description?: string;
  actions?: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        'flex flex-col gap-3 md:flex-row md:items-center md:justify-between',
        className,
      )}
    >
      <div className="space-y-1.5">
        <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.22em] text-muted-foreground/80">
          <span className="rounded-full border border-border/50 bg-secondary/30 px-2 py-0.5 text-[10px]">
            Admin
          </span>
          <span>Internal</span>
        </div>
        <div className="space-y-1">
          <h1 className="text-3xl font-semibold tracking-tight text-foreground">{title}</h1>
          {description && (
            <p className="max-w-2xl text-sm text-muted-foreground">{description}</p>
          )}
        </div>
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}

export function AdminButton({ className, variant = 'secondary', ...props }: ButtonProps) {
  return <Button variant={variant} className={cn('rounded-full px-4', className)} {...props} />;
}

export const AdminInput = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, ...props }, ref) => (
    <Input
      ref={ref}
      className={cn(
        'h-10 rounded-xl border-border/50 bg-card/60 shadow-soft backdrop-blur focus-visible:ring-ring/40',
        className,
      )}
      {...props}
    />
  ),
);
AdminInput.displayName = 'AdminInput';

export const AdminSelect = React.forwardRef<
  HTMLSelectElement,
  React.SelectHTMLAttributes<HTMLSelectElement>
>(({ className, children, ...props }, ref) => (
  <select
    ref={ref}
    className={cn(
      'h-10 w-full rounded-xl border border-border/50 bg-card/60 px-3 text-sm text-foreground shadow-soft transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40',
      className,
    )}
    {...props}
  >
    {children}
  </select>
));
AdminSelect.displayName = 'AdminSelect';

export function DataTable({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn('overflow-hidden rounded-2xl border border-border/40 bg-background/70 shadow-soft', className)}>
      <table className="min-w-full border-collapse text-sm">{children}</table>
    </div>
  );
}

export function CardBody({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn('p-5', className)} {...props} />;
}

export function CardHeading({
  title,
  description,
  className,
}: {
  title: string;
  description?: string;
  className?: string;
}) {
  return (
    <div className={cn('space-y-1 p-5 pb-3', className)}>
      <div className="text-lg font-semibold text-foreground">{title}</div>
      {description && <div className="text-sm text-muted-foreground">{description}</div>}
    </div>
  );
}
