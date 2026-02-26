'use client';

/**
 * HealthScoreBar — colored progress bar showing sellpage health (0-100).
 *
 * Color scale:
 *   80-100  Green   "Excellent"
 *   60-79   Yellow  "Good"
 *   40-59   Orange  "Needs Work"
 *   0-39    Red     "Poor"
 */

interface HealthScoreBarProps {
  score: number;
  size?: 'sm' | 'md';
}

function getHealthColor(score: number): {
  bar: string;
  bg: string;
  text: string;
  badge: string;
  label: string;
} {
  if (score >= 80) {
    return {
      bar: 'bg-green-500',
      bg: 'bg-green-500/10',
      text: 'text-green-400',
      badge: 'bg-green-500/10 text-green-400 border-green-500/20',
      label: 'Excellent',
    };
  }
  if (score >= 60) {
    return {
      bar: 'bg-yellow-500',
      bg: 'bg-yellow-500/10',
      text: 'text-yellow-400',
      badge: 'bg-yellow-500/10 text-yellow-400 border-yellow-500/20',
      label: 'Good',
    };
  }
  if (score >= 40) {
    return {
      bar: 'bg-orange-500',
      bg: 'bg-orange-500/10',
      text: 'text-orange-400',
      badge: 'bg-orange-500/10 text-orange-400 border-orange-500/20',
      label: 'Needs Work',
    };
  }
  return {
    bar: 'bg-red-500',
    bg: 'bg-red-500/10',
    text: 'text-red-400',
    badge: 'bg-red-500/10 text-red-400 border-red-500/20',
    label: 'Poor',
  };
}

export function HealthScoreBar({ score, size = 'sm' }: HealthScoreBarProps) {
  const clamped = Math.max(0, Math.min(100, score));
  const colors = getHealthColor(clamped);
  const height = size === 'md' ? 'h-2' : 'h-1.5';

  return (
    <div className="flex items-center gap-2 min-w-[80px]">
      <div className={`flex-1 ${colors.bg} rounded-full ${height} overflow-hidden`}>
        <div
          className={`${colors.bar} ${height} rounded-full transition-all duration-300`}
          style={{ width: `${clamped}%` }}
        />
      </div>
      <span className={`text-xs font-medium tabular-nums ${colors.text}`}>
        {clamped}
      </span>
    </div>
  );
}

export function HealthScoreBadge({ score }: { score: number }) {
  const clamped = Math.max(0, Math.min(100, score));
  const colors = getHealthColor(clamped);

  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded border text-xs font-medium ${colors.badge}`}>
      {clamped} {colors.label}
    </span>
  );
}

export { getHealthColor };
