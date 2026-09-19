import React, { useMemo } from 'react';
import { CalendarDays, Clock, CheckCircle2 } from 'lucide-react';
import { usePeriodo } from '../context/PeriodoContext.jsx';
import HistoryAccordion from '../components/HistoryAccordion.jsx';
import { filtrarPorAno, filtrarPorSafra } from '../lib/data.js';
import { MESES_PT } from '../lib/format.js';

export default function CalendarioPage({ dados }) {
  const { modo, ano, safraSelecionada } = usePeriodo();
  const { talhoes, atividades } = dados;
  const getTalhaoNome = (id) => talhoes.find((t) => String(t.id) === String(id))?.nome || 'Geral';
  const hoje = new Date().toISOString().slice(0, 10);

  const escopo = useMemo(() => {
    if (modo === 'safra' && safraSelecionada) return filtrarPorSafra(atividades, safraSelecionada, 'data_programada');
    return filtrarPorAno(atividades, ano, 'data_programada');
  }, [modo, ano, safraSelecionada, atividades]);

  const porMes = useMemo(() => {
    const grupos = {};
    escopo.forEach((a) => {
      if (!a.data_programada) return;
      const key = a.data_programada.slice(0, 7);
      if (!grupos[key]) grupos[key] = [];
      grupos[key].push(a);
    });
    return Object.entries(grupos).sort((a, b) => a[0].localeCompare(b[0]));
  }, [escopo]);

  const mesAtualKey = hoje.slice(0, 7);

  return (
    <div className="space-y-6">
      <p className="text-sm text-ink-faint">
        Agenda de atividades programadas em <span className="text-brand font-semibold">{modo === 'safra' ? safraSelecionada?.nome : `Ano ${ano}`}</span>.
      </p>

      <div className="space-y-2.5">
        {porMes.map(([mesKey, lista]) => {
          const [anoLista, mesNum] = mesKey.split('-');
          const nomeMes = `${MESES_PT[Number(mesNum) - 1]} de ${anoLista}`;
          const isAtualOuFuturo = mesKey >= mesAtualKey;
          return (
            <HistoryAccordion
              key={mesKey}
              title={nomeMes}
              subtitle={`${lista.length} atividade${lista.length > 1 ? 's' : ''}`}
              defaultOpen={isAtualOuFuturo}
            >
              <div>
                {[...lista]
                  .sort((a, b) => (a.data_programada || '').localeCompare(b.data_programada || ''))
                  .map((a) => {
                    const concluida = a.status === 'concluida' || a.status === 'concluída';
                    const atrasada = !concluida && a.data_programada < hoje;
                    return (
                      <div key={a.id} className="flex items-center justify-between gap-3 py-2.5 border-b border-line-soft last:border-0 text-sm">
                        <div className="flex items-center gap-2.5 min-w-0">
                          {concluida ? (
                            <CheckCircle2 className="w-3.5 h-3.5 text-brand shrink-0" />
                          ) : (
                            <Clock className={`w-3.5 h-3.5 shrink-0 ${atrasada ? 'text-rose' : 'text-amber'}`} />
                          )}
                          <div className="min-w-0">
                            <div className="text-ink truncate">
                              {a.tipo === 'outro' ? a.tipo_personalizado : a.tipo}{' '}
                              <span className="text-ink-faint">· {getTalhaoNome(a.talhao_id)}</span>
                            </div>
                          </div>
                        </div>
                        <div className="text-xs text-ink-faint shrink-0 flex items-center gap-1">
                          <CalendarDays className="w-3 h-3" /> {a.data_programada}
                        </div>
                      </div>
                    );
                  })}
              </div>
            </HistoryAccordion>
          );
        })}
        {porMes.length === 0 && <p className="text-sm text-ink-faint italic">Nenhuma atividade programada neste período.</p>}
      </div>
    </div>
  );
}
