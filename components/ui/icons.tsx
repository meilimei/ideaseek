import * as React from "react";

export const Eye = React.forwardRef<SVGSVGElement, React.SVGProps<SVGSVGElement>>(function Eye(
  props,
  ref,
) {
  return (
    <svg
      ref={ref}
      aria-hidden="true"
      xmlns="http://www.w3.org/2000/svg"
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      {...props}
    >
      <path d="M1 12s4-7 11-7 11 7 11 7-4 7-11 7-11-7-11-7Z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  );
});

export const EyeOff = React.forwardRef<SVGSVGElement, React.SVGProps<SVGSVGElement>>(function EyeOff(
  props,
  ref,
) {
  return (
    <svg
      ref={ref}
      aria-hidden="true"
      xmlns="http://www.w3.org/2000/svg"
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      {...props}
    >
      <path d="M9.88 9.88a3 3 0 1 0 4.24 4.24" />
      <path d="M10.73 5.08A10.43 10.43 0 0 1 12 5c7 0 11 7 11 7a15.66 15.66 0 0 1-1.67 2.68" />
      <path d="m6.61 6.61-1.77 1.77C2.73 9.72 1 12 1 12s4 7 11 7a10.94 10.94 0 0 0 5.39-1.41" />
      <line x1="1" x2="23" y1="1" y2="23" />
    </svg>
  );
});

export const Loader2 = React.forwardRef<SVGSVGElement, React.SVGProps<SVGSVGElement>>(function Loader2(
  props,
  ref,
) {
  return (
    <svg
      ref={ref}
      aria-hidden="true"
      xmlns="http://www.w3.org/2000/svg"
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      {...props}
    >
      <path d="M12 2v4" />
      <path d="m16.2 7.8 2.9-2.9" />
      <path d="M18 12h4" />
      <path d="m16.2 16.2 2.9 2.9" />
      <path d="M12 18v4" />
      <path d="m4.9 19.1 2.9-2.9" />
      <path d="M2 12h4" />
      <path d="m4.9 4.9 2.9 2.9" />
    </svg>
  );
});

export const Sparkles = React.forwardRef<SVGSVGElement, React.SVGProps<SVGSVGElement>>(function Sparkles(
  props,
  ref,
) {
  return (
    <svg
      ref={ref}
      aria-hidden="true"
      xmlns="http://www.w3.org/2000/svg"
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      {...props}
    >
      <path d="m12 3-2 5-5 2 5 2 2 5 2-5 5-2-5-2-2-5Z" />
      <path d="M5 3v4" />
      <path d="M19 17v4" />
      <path d="M3 5h4" />
      <path d="M17 19h4" />
    </svg>
  );
});

export const TrendingUp = React.forwardRef<SVGSVGElement, React.SVGProps<SVGSVGElement>>(function TrendingUp(
  props,
  ref,
) {
  return (
    <svg
      ref={ref}
      aria-hidden="true"
      xmlns="http://www.w3.org/2000/svg"
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      {...props}
    >
      <polyline points="22 7 13.5 15.5 8.5 10.5 2 17" />
      <polyline points="16 7 22 7 22 13" />
    </svg>
  );
});

export const Radar = React.forwardRef<SVGSVGElement, React.SVGProps<SVGSVGElement>>(function Radar(
  props,
  ref,
) {
  return (
    <svg
      ref={ref}
      aria-hidden="true"
      xmlns="http://www.w3.org/2000/svg"
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      {...props}
    >
      <path d="M12 20a8 8 0 1 0-8-8" />
      <path d="M12 12V8" />
      <path d="m12 12 4 4" />
      <path d="M16 20h6" />
      <path d="M2 4v6" />
    </svg>
  );
});

export const Database = React.forwardRef<SVGSVGElement, React.SVGProps<SVGSVGElement>>(function Database(
  props,
  ref,
) {
  return (
    <svg
      ref={ref}
      aria-hidden="true"
      xmlns="http://www.w3.org/2000/svg"
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      {...props}
    >
      <ellipse cx="12" cy="5" rx="9" ry="3" />
      <path d="M3 5v14c0 1.66 4.03 3 9 3s9-1.34 9-3V5" />
      <path d="M3 12c0 1.66 4.03 3 9 3s9-1.34 9-3" />
    </svg>
  );
});

export const ArrowRight = React.forwardRef<SVGSVGElement, React.SVGProps<SVGSVGElement>>(function ArrowRight(
  props,
  ref,
) {
  return (
    <svg
      ref={ref}
      aria-hidden="true"
      xmlns="http://www.w3.org/2000/svg"
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      {...props}
    >
      <line x1="5" x2="19" y1="12" y2="12" />
      <polyline points="12 5 19 12 12 19" />
    </svg>
  );
});

export const Check = React.forwardRef<SVGSVGElement, React.SVGProps<SVGSVGElement>>(function Check(
  props,
  ref,
) {
  return (
    <svg
      ref={ref}
      aria-hidden="true"
      xmlns="http://www.w3.org/2000/svg"
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      {...props}
    >
      <polyline points="20 6 9 17 4 12" />
    </svg>
  );
});

export const Lock = React.forwardRef<SVGSVGElement, React.SVGProps<SVGSVGElement>>(function Lock(
  props,
  ref,
) {
  return (
    <svg
      ref={ref}
      aria-hidden="true"
      xmlns="http://www.w3.org/2000/svg"
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      {...props}
    >
      <rect width="18" height="11" x="3" y="11" rx="2" ry="2" />
      <path d="M7 11V7a5 5 0 0 1 10 0v4" />
    </svg>
  );
});

export const Zap = React.forwardRef<SVGSVGElement, React.SVGProps<SVGSVGElement>>(function Zap(
  props,
  ref,
) {
  return (
    <svg
      ref={ref}
      aria-hidden="true"
      xmlns="http://www.w3.org/2000/svg"
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      {...props}
    >
      <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
    </svg>
  );
});

export const CreditCard = React.forwardRef<SVGSVGElement, React.SVGProps<SVGSVGElement>>(function CreditCard(
  props,
  ref,
) {
  return (
    <svg
      ref={ref}
      aria-hidden="true"
      xmlns="http://www.w3.org/2000/svg"
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      {...props}
    >
      <rect width="20" height="14" x="2" y="5" rx="2" />
      <line x1="2" x2="22" y1="10" y2="10" />
      <line x1="6" x2="8" y1="15" y2="15" />
      <line x1="10" x2="14" y1="15" y2="15" />
    </svg>
  );
});

export const LogOut = React.forwardRef<SVGSVGElement, React.SVGProps<SVGSVGElement>>(function LogOut(
  props,
  ref,
) {
  return (
    <svg
      ref={ref}
      aria-hidden="true"
      xmlns="http://www.w3.org/2000/svg"
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      {...props}
    >
      <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
      <polyline points="16 17 21 12 16 7" />
      <line x1="21" x2="9" y1="12" y2="12" />
    </svg>
  );
});

export const ChevronDown = React.forwardRef<SVGSVGElement, React.SVGProps<SVGSVGElement>>(function ChevronDown(
  props,
  ref,
) {
  return (
    <svg
      ref={ref}
      aria-hidden="true"
      xmlns="http://www.w3.org/2000/svg"
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      {...props}
    >
      <polyline points="6 9 12 15 18 9" />
    </svg>
  );
});
