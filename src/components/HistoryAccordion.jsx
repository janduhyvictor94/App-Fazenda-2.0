import React, { useState } from 'react';
import { ChevronDown } from 'lucide-react';
import { clsx } from 'clsx';

// Linha de histórico recolhida por padrão — mostra o resumo do período e só
// expande o detalhe (lançamento por lançamento) quando o usuário pede.
// É só apresentação: nenhum dado é escondido de verdade, ainda está tudo ali.
export default function HistoryAccordion({ title, subtitle, right, children, defaultOpen = false }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="rounded-xl2 bg-surface border border-line overflow-hidden">
      <button
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center justify-between gap-3 px-4 sm:px-5 py-3.5 text-left hover:bg-line-soft transition-colors"
      >
        <div className="flex items-center gap-3 min-w-0">
          <ChevronDown className={clsx('w-4 h-4 text-ink-faint shrink-0 transition-transform', open && 'rotate-180')} />
          <div className="min-w-0">
            <div className="text-sm font-semibold text-ink truncate">{title}</div>
            {subtitle && <div className="text-xs text-ink-faint truncate">{subtitle}</div>}
          </div>
        </div>
        {right && <div className="shrink-0 text-sm font-semibold tabular text-ink">{right}</div>}
      </button>
      {open && <div className="border-t border-line px-4 sm:px-5 py-4">{children}</div>}
    </div>
  );
}
