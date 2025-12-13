'use client';

type SparkPoint = { date: string; value: number };

type TrendSparklineProps = {
  values?: number[];
  points?: SparkPoint[];
  className?: string;
};

function cn(...classes: Array<string | undefined | null | false>) {
  return classes.filter(Boolean).join(' ');
}

export default function TrendSparkline({
  values,
  points,
  className,
}: TrendSparklineProps) {
  const valueData =
    Array.isArray(values) && values.length > 0
      ? values.map((v) => ({ value: v }))
      : null;

  const pointData =
    !valueData && Array.isArray(points) && points.length > 0
      ? points.map((p) => ({ value: p.value }))
      : null;

  const data = valueData ?? pointData ?? [];

  if (data.length === 0) {
    return (
      <div
        className={cn(
          'h-24 w-full rounded-xl bg-gradient-to-r from-blue-50 via-gray-50 to-blue-50',
          className,
        )}
      />
    );
  }

  const valuesOnly = data.map((p) => p.value);
  const min = Math.min(...valuesOnly);
  const max = Math.max(...valuesOnly);
  const range = max - min || 1;
  const normalized = data.map((p) => (p.value - min) / range);

  const width = 200;
  const height = 96;
  const step = data.length > 1 ? width / (data.length - 1) : width;

  const coords = normalized.map((v, idx) => ({
    x: idx * step,
    y: height - v * height,
  }));

  const pathD = coords
    .map((pt, idx) => `${idx === 0 ? 'M' : 'L'} ${pt.x},${pt.y}`)
    .join(' ');

  const areaD =
    coords.length > 1
      ? `${pathD} L ${coords[coords.length - 1].x},${height} L 0,${height} Z`
      : `M0,${height} L0,${height} Z`;

  return (
    <div
      className={cn(
        'h-24 w-full rounded-xl bg-white/60 backdrop-blur-sm p-2',
        className,
      )}
    >
      <svg width="100%" height="100%" viewBox={`0 0 ${width} ${height}`}>
        <defs>
          <linearGradient id="sparklineFill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#bfdbfe" stopOpacity="0.5" />
            <stop offset="100%" stopColor="#bfdbfe" stopOpacity="0" />
          </linearGradient>
        </defs>
        <path d={areaD} fill="url(#sparklineFill)" />
        <path
          d={pathD}
          fill="none"
          stroke="#2563eb"
          strokeWidth="2"
          strokeLinejoin="round"
          strokeLinecap="round"
        />
      </svg>
    </div>
  );
}
