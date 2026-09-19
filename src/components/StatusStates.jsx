import React from 'react';
import { Loader2, AlertTriangle } from 'lucide-react';

export function LoadingScreen() {
  return (
    <div className="min-h-screen bg-base flex flex-col items-center justify-center gap-3 text-ink-muted">
      <Loader2 className="w-6 h-6 animate-spin text-brand" />
      <p className="text-sm">Carregando dados reais da fazenda…</p>
    </div>
  );
}

export function ErrorScreen({ error }) {
  return (
    <div className="min-h-screen bg-base flex flex-col items-center justify-center gap-3 text-center px-6">
      <AlertTriangle className="w-7 h-7 text-rose" />
      <p className="text-sm text-ink max-w-sm">
        Não foi possível carregar os dados do Supabase agora.
      </p>
      <p className="text-xs text-ink-faint max-w-sm font-mono break-all">{String(error?.message || error)}</p>
    </div>
  );
}
