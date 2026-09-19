import React from 'react';
import { X } from 'lucide-react';

// Modal simples, no mesmo visual do resto do app — usado por Metas e
// Planejamentos (as duas telas portadas da produção que têm formulários em
// pop-up). Fecha ao clicar fora ou no X; nunca fecha sozinho.
export default function Modal({ open, onClose, title, description, children, maxWidth = 'max-w-lg' }) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 bg-base/70 backdrop-blur-sm flex items-center justify-center p-4" onClick={onClose}>
      <div
        className={`w-full ${maxWidth} rounded-xl2 bg-surface-raised border border-line shadow-glow max-h-[90vh] overflow-y-auto`}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3 px-5 py-4 border-b border-line sticky top-0 bg-surface-raised z-10">
          <div>
            <h3 className="font-display font-semibold text-ink">{title}</h3>
            {description && <p className="text-xs text-ink-faint mt-0.5">{description}</p>}
          </div>
          <button onClick={onClose} className="text-ink-faint hover:text-ink shrink-0">
            <X className="w-4 h-4" />
          </button>
        </div>
        <div className="p-5">{children}</div>
      </div>
    </div>
  );
}
