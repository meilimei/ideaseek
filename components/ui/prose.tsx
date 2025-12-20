'use client';

import type { ReactNode } from "react";
import { cn } from "@/lib/utils/cn";

type ProseProps = {
  children: ReactNode;
  className?: string;
};

export default function Prose({ children, className }: ProseProps) {
  return (
    <div
      className={cn(
        "prose prose-invert max-w-none text-foreground/85 leading-relaxed",
        "[&_p]:mt-3 [&_p]:text-foreground/85 [&_p]:leading-relaxed",
        "[&_ul]:mt-3 [&_ul]:list-disc [&_ul]:pl-5",
        "[&_ol]:mt-3 [&_ol]:list-decimal [&_ol]:pl-5",
        "[&_li]:mt-1 [&_li]:text-foreground/80",
        "[&_strong]:text-foreground [&_strong]:font-semibold",
        "[&_a]:text-primary [&_a]:underline-offset-4 hover:[&_a]:underline",
        "[&_blockquote]:mt-3 [&_blockquote]:border-l-2 [&_blockquote]:border-border [&_blockquote]:pl-4 [&_blockquote]:text-foreground/80 [&_blockquote]:italic",
        "[&_h3]:mt-6 [&_h3]:text-lg [&_h3]:font-semibold",
        className
      )}
    >
      {children}
    </div>
  );
}
