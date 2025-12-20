import * as React from "react";
import { cn } from "@/lib/utils/cn";

type ButtonVariant =
  | "default"
  | "secondary"
  | "destructive"
  | "outline"
  | "ghost"
  | "link"
  | "pill"
  | "ghostPill";

type ButtonSize = "default" | "sm" | "lg" | "icon";

type ButtonOptions = {
  variant?: ButtonVariant;
  size?: ButtonSize;
  className?: string;
};

const baseClasses =
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-[calc(var(--radius)-2px)] border border-border/60 bg-transparent px-4 py-2 text-sm font-semibold text-foreground shadow-soft transition-colors transition-shadow duration-200 hover:bg-white/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40 focus-visible:ring-offset-0 disabled:pointer-events-none disabled:opacity-60";

const variantClasses: Record<ButtonVariant, string> = {
  default:
    "bg-primary text-primary-foreground border-primary/60 hover:bg-primary/90 shadow-glow",
  secondary:
    "bg-secondary/80 text-secondary-foreground border-border/70 hover:bg-secondary",
  destructive:
    "bg-destructive text-destructive-foreground border-destructive/70 hover:bg-destructive/90",
  outline: "bg-transparent text-foreground hover:bg-white/5",
  ghost: "bg-transparent text-foreground border-transparent hover:bg-white/5",
  link: "bg-transparent border-transparent text-primary underline underline-offset-4 shadow-none hover:text-primary/90 px-0",
  pill:
    "rounded-full bg-secondary/60 text-foreground border-border/70 hover:bg-secondary",
  ghostPill:
    "rounded-full border-border/70 bg-transparent text-foreground hover:bg-white/8",
};

const sizeClasses: Record<ButtonSize, string> = {
  default: "h-11 px-4 py-2",
  sm: "h-9 px-3 text-sm",
  lg: "h-12 px-5 text-base",
  icon: "h-11 w-11 p-0",
};

export const buttonVariants = ({
  variant = "default",
  size = "default",
  className,
}: ButtonOptions = {}) => cn(baseClasses, variantClasses[variant], sizeClasses[size], className);

export type ButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> &
  ButtonOptions & { asChild?: boolean };

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = "default", size = "default", asChild = false, children, ...props }, ref) => {
    if (asChild && React.isValidElement(children)) {
      return React.cloneElement(children, {
        className: buttonVariants({ variant, size, className: cn(children.props.className, className) }),
        ref,
        ...props,
      } as React.ReactElement);
    }

    return (
      <button
        className={buttonVariants({ variant, size, className })}
        ref={ref}
        {...props}
      >
        {children}
      </button>
    );
  }
);
Button.displayName = "Button";
