import React from 'react';
import { clsx } from 'clsx';

const TONES = {
  brand: 'text-brand bg-brand/10 border-brand/25',
  tech: 'text-tech bg-tech/10 border-tech/25',
  amber: 'text-amber bg-amber/10 border-amber/25',
  rose: 'text-rose bg-rose/10 border-rose/25',
  neutral: 'text-ink-muted bg-line-soft border-line'
};

export default function KpiCard({ label, value, icon: Icon, tone = 'neutral', hint, trend }) {
  return (
    <div className="rounded-xl2 bg-surface border border-line p-4 sm:p-5 flex flex-col gap-3 shadow-glow">
      <div className="flex items-center justify-between">
        <span className="text-[11px] uppercase tracking-[0.14em] text-ink-faint font-semibold">{label}</span>
        {Icon && (
          <span className={clsx('w-7 h-7 rounded-lg border flex items-center justify-center', TONES[tone])}>
            <Icon className="w-3.5 h-3.5" strokeWidth={2.25} />
          </span>
        )}
      </div>
      <div className="font-display font-bold text-2xl sm:text-[28px] text-ink tabular leading-none">{value}</div>
      {hint && (
        <div className="flex items-center gap-1.5 text-xs">
          {trend != null && (
            <span className={clsx('font-semibold tabular', trend >= 0 ? 'text-brand' : 'text-rose')}>
              {trend >= 0 ? '+' : ''}
              {trend.toFixed(0)}%
            </span>
          )}
          <span className="text-ink-faint">{hint}</span>
        </div>
      )}
    </div>
  );
}
