import React, { useMemo } from 'react';
import { ClipboardCheck, Clock, CheckCircle2, User } from 'lucide-react';
import { usePeriodo } from '../context/PeriodoContext.jsx';
import HistoryAccordion from '../components/HistoryAccordion.jsx';
import KpiCard from '../components/KpiCard.jsx';
import { filtrarPorAno, filtrarPorSafra } from '../lib/data.js';

function LinhaAtividade({ a, talhaoNome }) {
  const concluida = a.status === 'concluida' || a.status === 'concluída';
  return (
    <div className="flex items-center justify-between gap-3 py-2.5 border-b border-line-soft last:border-0 text-sm">
      <div className="flex items-center gap-2.5 min-w-0">
        {concluida ? (
          <CheckCircle2 className="w-3.5 h-3.5 text-brand shrink-0" />
        ) : (
          <Clock className="w-3.5 h-3.5 text-amber shrink-0" />
        )}
        <div className="min-w-0">
          <div className="text-ink truncate">
            {a.tipo === 'outro' ? a.tipo_personalizado : a.tipo} <span className="text-ink-faint">· {talhaoNome}</span>
          </div>
          <div className="text-xs text-ink-faint flex items-center gap-2">
            <span>{a.data_realizada || a.data_programada}</span>
            {a.responsavel && (
              <span className="flex items-center gap-1">
                <User className="w-3 h-3" /> {a.responsavel}
              </span>
            )}
            {a.terceirizada && <span className="text-tech">terceirizado</span>}
          </div>
        </div>
      </div>
    </div>
  );
}

export default function AtividadesPage({ dados }) {
  const { modo, ano, safraSelecionada } = usePeriodo();
  const { talhoes, atividades } = dados;
  const getTalhaoNome = (id) => talhoes.find((t) => String(t.id) === String(id))?.nome || 'Geral';

  const comData = useMemo(
    () => atividades.map((a) => ({ ...a, dataEfetiva: a.data_realizada || a.data_programada })),
    [atividades]
  );

  const escopo = useMemo(() => {
    if (modo === 'safra' && safraSelecionada) {
      return filtrarPorSafra(comData, safraSelecionada, 'dataEfetiva');
    }
    return filtrarPorAno(comData, ano, 'dataEfetiva');
  }, [modo, ano, safraSelecionada, comData]);

  const pendentes = escopo.filter((a) => a.status !== 'concluida' && a.status !== 'concluída');
  const concluidas = escopo.filter((a) => a.status === 'concluida' || a.status === 'concluída');
  const terceirizadas = escopo.filter((a) => a.terceirizada);

  const porTalhao = useMemo(() => {
    const grupos = {};
    concluidas.forEach((a) => {
      const key = a.talhao_id || 'geral';
      if (!grupos[key]) grupos[key] = [];
      grupos[key].push(a);
    });
    return Object.entries(grupos);
  }, [concluidas]);

  return (
    <div className="space-y-6">
      <p className="text-sm text-ink-faint">
        Atividades de <span className="text-brand font-semibold">{modo === 'safra' ? safraSelecionada?.nome : `Ano ${ano}`}</span>.
      </p>

      <div className="grid grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
        <KpiCard label="Pendentes" value={String(pendentes.length)} icon={Clock} tone="amber" />
        <KpiCard label="Concluídas" value={String(concluidas.length)} icon={CheckCircle2} tone="brand" />
        <KpiCard label="Terceirizadas" value={String(terceirizadas.length)} icon={ClipboardCheck} tone="tech" />
      </div>

      {pendentes.length > 0 && (
        <div className="rounded-xl2 bg-surface border border-line p-4 sm:p-5">
          <h3 className="font-display font-semibold text-sm text-ink mb-2">Programadas / pendentes</h3>
          {pendentes.map((a) => (
            <LinhaAtividade key={a.id} a={a} talhaoNome={getTalhaoNome(a.talhao_id)} />
          ))}
        </div>
      )}

      <div className="space-y-2.5">
        <h3 className="font-display font-semibold text-sm text-ink">Concluídas por talhão</h3>
        {porTalhao.map(([talhaoId, lista]) => (
          <HistoryAccordion
            key={talhaoId}
            title={getTalhaoNome(talhaoId)}
            subtitle={`${lista.length} atividade${lista.length > 1 ? 's' : ''}`}
          >
            <div>
              {lista.map((a) => (
                <LinhaAtividade key={a.id} a={a} talhaoNome={getTalhaoNome(a.talhao_id)} />
              ))}
            </div>
          </HistoryAccordion>
        ))}
        {porTalhao.length === 0 && <p className="text-sm text-ink-faint italic">Nenhuma atividade concluída neste período.</p>}
      </div>
    </div>
  );
}
