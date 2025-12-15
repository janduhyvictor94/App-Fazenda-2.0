import React from 'react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

export default function EmptyState({ 
  icon: Icon, 
  title, 
  description, 
  actionLabel, 
  onAction,
  className 
}) {
  return (
    <div className={cn(
      "flex flex-col items-center justify-center py-16 px-4",
      className
    )}>
      {Icon && (
        <div className="w-16 h-16 bg-stone-100 rounded-2xl flex items-center justify-center mb-4">
          <Icon className="w-8 h-8 text-stone-400" />
        </div>
      )}
      <h3 className="text-lg font-semibold text-stone-900 mb-2">{title}</h3>
      <p className="text-sm text-stone-500 text-center max-w-sm mb-6">{description}</p>
      {actionLabel && onAction && (
        <Button onClick={onAction} className="bg-emerald-600 hover:bg-emerald-700">
          {actionLabel}
        </Button>
      )}
    </div>
  );
}