"use client";

import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";

type CopyButtonProps = {
  text: string;
  label?: string;
  className?: string;
};

const RESET_MS = 1200;

export function CopyButton({ text, label = "Copy", className }: CopyButtonProps) {
  const [status, setStatus] = useState<"idle" | "copied" | "failed">("idle");
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, []);

  const handleCopy = async () => {
    if (status !== "idle") return;
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }
    try {
      await navigator.clipboard.writeText(text);
      setStatus("copied");
    } catch {
      setStatus("failed");
    }
    timeoutRef.current = setTimeout(() => {
      setStatus("idle");
    }, RESET_MS);
  };

  const buttonLabel =
    status === "idle" ? label : status === "copied" ? "Copied" : "Failed";

  return (
    <Button
      type="button"
      variant="ghost"
      size="sm"
      onClick={handleCopy}
      disabled={status !== "idle"}
      className={className}
    >
      {buttonLabel}
    </Button>
  );
}
