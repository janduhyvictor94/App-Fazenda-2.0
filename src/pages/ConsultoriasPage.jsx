import React, { useMemo } from 'react';
import { FileText, CalendarClock, MapPin } from 'lucide-react';
import { usePeriodo } from '../context/PeriodoContext.jsx';
import HistoryAccordion from '../components/HistoryAccordion.jsx';
import { filtrarPorAno, filtrarPorSafra } from '../lib/data.js';

export default function ConsultoriasPage({ dados }) {
  const { modo, ano, safraSelecionada } = usePeriodo();
  const { talhoes, consultorias } = dados;
  const getTalhaoNome = (id) => talhoes.find((t) => String(t.id) === String(id))?.nome || id;

  const escopo = useMemo(() => {
    const lista =
      modo === 'safra' && safraSelecionada
        ? filtrarPorSafra(consultorias, safraSelecionada, 'data_visita')
        : filtrarPorAno(consultorias, ano, 'data_visita');
    return [...lista].sort((a, b) => (b.data_visita || '').localeCompare(a.data_visita || ''));
  }, [modo, ano, safraSelecionada, consultorias]);

  const proximaVisita = consultorias
    .filter((c) => c.proxima_visita && c.proxima_visita >= new Date().toISOString().slice(0, 10))
    .sort((a, b) => (a.proxima_visita || '').localeCompare(b.proxima_visita || ''))[0];

  return (
    <div className="space-y-6">
      <p className="text-sm text-ink-faint">
        Visitas técnicas de <span className="text-brand font-semibold">{modo === 'safra' ? safraSelecionada?.nome : `Ano ${ano}`}</span>.
      </p>

      {proximaVisita && (
        <div className="rounded-xl2 bg-tech/10 border border-tech/25 p-4 flex items-center gap-3">
          <CalendarClock className="w-5 h-5 text-tech shrink-0" />
          <div className="text-sm text-ink">
            Próxima visita agendada: <span className="font-semibold">{proximaVisita.proxima_visita}</span>
            {proximaVisita.consultor_nome ? ` · ${proximaVisita.consultor_nome}` : ''}
          </div>
        </div>
      )}

      <div className="space-y-3">
        {escopo.map((c) => (
          <div key={c.id} className="rounded-xl2 bg-surface border border-line p-4 space-y-2.5">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <FileText className="w-4 h-4 text-brand" />
                <h3 className="font-display font-semibold text-ink">{c.consultor_nome || 'Consultoria'}</h3>
              </div>
              <span className="text-xs text-ink-faint">{c.data_visita}</span>
            </div>
            {c.talhoes_visitados && (
              <div className="flex items-center gap-1.5 text-xs text-ink-faint">
                <MapPin className="w-3 h-3" />
                {(Array.isArray(c.talhoes_visitados) ? c.talhoes_visitados : [c.talhoes_visitados])
                  .map(getTalhaoNome)
                  .join(', ')}
              </div>
            )}
            {c.indicacoes && (
              <div className="text-sm text-ink border-t border-line pt-2">
                <span className="text-ink-faint text-xs block mb-0.5">Indicações</span>
                {c.indicacoes}
              </div>
            )}
          </div>
        ))}
        {escopo.length === 0 && <p className="text-sm text-ink-faint italic">Nenhuma consultoria neste período.</p>}
      </div>
    </div>
  );
}
