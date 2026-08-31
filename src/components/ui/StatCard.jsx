import React from 'react';
import { cn } from '@/lib/utils';

// Mapa de cor -> fundo claro correspondente pro ícone (Tailwind precisa das classes
// completas e literais no código pra não serem removidas no build de produção).
const BG_POR_COR = {
  'text-emerald-600': 'bg-emerald-50',
  'text-emerald-500': 'bg-emerald-50',
  'text-red-600': 'bg-red-50',
  'text-red-500': 'bg-red-50',
  'text-blue-600': 'bg-blue-50',
  'text-blue-500': 'bg-blue-50',
  'text-amber-600': 'bg-amber-50',
  'text-amber-500': 'bg-amber-50',
  'text-purple-600': 'bg-purple-50',
  'text-orange-600': 'bg-orange-50',
  'text-cyan-600': 'bg-cyan-50',
  'text-pink-600': 'bg-pink-50',
  'text-stone-600': 'bg-stone-100',
  'text-stone-500': 'bg-stone-100',
};

export default function StatCard({
  title,
  value,
  subtitle,
  icon: Icon,
  trend,
  trendUp,
  className,
  color,
  iconBg,
  iconColor
}) {
  const corIcone = iconColor || color || 'text-emerald-600';
  const corFundo = iconBg || BG_POR_COR[corIcone] || 'bg-emerald-50';

  return (
    <div className={cn(
      "bg-white rounded-2xl p-6 border border-stone-100 shadow-sm hover:shadow-md transition-shadow duration-300",
      className
    )}>
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1 min-w-0">
          <p className="text-[13px] font-medium text-stone-500 mb-2 tracking-wide truncate">{title}</p>
          <p className="text-[26px] leading-tight font-bold text-stone-900 tracking-tight">{value}</p>
          {subtitle && (
            <p className="text-sm text-stone-400 mt-1.5">{subtitle}</p>
          )}
          {trend && (
            <div className={cn(
              "flex items-center gap-1 mt-3 text-sm font-medium",
              trendUp ? "text-emerald-600" : "text-red-500"
            )}>
              <span>{trendUp ? '↑' : '↓'}</span>
              <span>{trend}</span>
            </div>
          )}
        </div>
        {Icon && (
          <div className={cn("p-3 rounded-xl shrink-0", corFundo)}>
            <Icon className={cn("w-5 h-5", corIcone)} />
          </div>
        )}
      </div>
    </div>
  );
}
