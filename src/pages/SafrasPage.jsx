import React, { useMemo } from 'react';
import { Sprout, MapPin, Calendar } from 'lucide-react';
import HistoryAccordion from '../components/HistoryAccordion.jsx';
import { custosDaSafra, colheitasDaSafra, totaisFinanceiros, receitaColheitas } from '../lib/data.js';
import { formatBRL } from '../lib/format.js';

function SafraCard({ safra, talhao, allTalhoes, colheitas, custos, destaque }) {
  // Importante: o rateio usa a ÁREA TOTAL DA FAZENDA (todos os talhões), não
  // só a área deste talhão — por isso allTalhoes precisa ser a lista completa,
  // exatamente como a Dashboard atual calcula.
  const custosEscopo = custosDaSafra({ custos, safra, talhoes: allTalhoes });
  const custosDiretos = custosEscopo.filter((c) => !c.isRateio);
  const custosRateio = custosEscopo.filter((c) => c.isRateio);
  const { despesasPagas } = totaisFinanceiros(custosEscopo);
  const receita = receitaColheitas(colheitas);

  return (
    <div
      className={`rounded-xl2 border p-5 space-y-4 ${
        destaque ? 'bg-brand/8 border-brand/30' : 'bg-surface border-line'
      }`}
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <Sprout className={`w-4 h-4 ${destaque ? 'text-brand' : 'text-ink-faint'}`} />
            <h3 className="font-display font-semibold text-ink">{safra.nome}</h3>
            {destaque && (
              <span className="text-[10px] uppercase tracking-wide bg-brand/20 text-brand px-2 py-0.5 rounded-full font-semibold">
                ativa
              </span>
            )}
          </div>
          <div className="flex items-center gap-3 text-xs text-ink-faint mt-1.5">
            <span className="flex items-center gap-1"><MapPin className="w-3 h-3" />{talhao?.nome || 'Talhão removido'}</span>
            <span className="flex items-center gap-1">
              <Calendar className="w-3 h-3" />
              {safra.data_inicio || '—'} → {safra.data_fim || 'em andamento'}
            </span>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-3 text-sm">
        <div>
          <div className="text-ink-faint text-xs mb-0.5">Receita</div>
          <div className="font-semibold text-brand tabular">{formatBRL(receita)}</div>
        </div>
        <div>
          <div className="text-ink-faint text-xs mb-0.5">Custos (direto + rateio)</div>
          <div className="font-semibold text-rose tabular">{formatBRL(despesasPagas)}</div>
        </div>
        <div>
          <div className="text-ink-faint text-xs mb-0.5">Resultado</div>
          <div className="font-semibold tabular">{formatBRL(receita - despesasPagas)}</div>
        </div>
      </div>

      <div className="flex items-center gap-4 text-xs text-ink-faint border-t border-line pt-3">
        <span>{custosDiretos.length} lançamentos diretos do talhão</span>
        <span className="w-1 h-1 rounded-full bg-ink-faint/40" />
        <span>{custosRateio.length} custos gerais rateados por área</span>
      </div>
    </div>
  );
}

export default function SafrasPage({ dados }) {
  const { talhoes, safras, colheitas, custos } = dados;

  const porTalhao = useMemo(() => {
    const map = {};
    safras.forEach((s) => {
      const key = s.talhao_id || 'sem-talhao';
      if (!map[key]) map[key] = [];
      map[key].push(s);
    });
    return map;
  }, [safras]);

  return (
    <div className="space-y-8">
      <p className="text-sm text-ink-faint">
        Cada talhão mostra a safra ativa em destaque. O histórico de safras concluídas fica recolhido — os valores
        e o rateio de cada uma continuam exatamente como foram lançados.
      </p>

      {Object.entries(porTalhao).map(([talhaoId, lista]) => {
        const talhao = talhoes.find((t) => String(t.id) === String(talhaoId));
        const ordenadas = [...lista].sort((a, b) => (b.data_inicio || '').localeCompare(a.data_inicio || ''));
        const ativa = ordenadas.find((s) => s.status === 'ativo' || s.status === 'em_andamento');
        const historico = ordenadas.filter((s) => s.id !== ativa?.id);

        return (
          <div key={talhaoId} className="space-y-3">
            <h2 className="font-display font-semibold text-ink flex items-center gap-2">
              <MapPin className="w-4 h-4 text-ink-faint" />
              {talhao?.nome || 'Talhão sem nome'}
              {talhao?.area_hectares && (
                <span className="text-xs text-ink-faint font-normal">· {talhao.area_hectares} ha</span>
              )}
            </h2>

            {ativa && (
              <SafraCard
                safra={ativa}
                talhao={talhao}
                allTalhoes={talhoes}
                colheitas={colheitasDaSafra({ colheitas, safra: ativa })}
                custos={custos}
                destaque
              />
            )}

            {historico.length > 0 && (
              <HistoryAccordion
                title={`Histórico — ${historico.length} safra${historico.length > 1 ? 's' : ''} concluída${historico.length > 1 ? 's' : ''}`}
                subtitle="Recolhido por padrão · nada foi alterado"
              >
                <div className="space-y-3">
                  {historico.map((s) => (
                    <SafraCard
                      key={s.id}
                      safra={s}
                      talhao={talhao}
                      allTalhoes={talhoes}
                      colheitas={colheitasDaSafra({ colheitas, safra: s })}
                      custos={custos}
                    />
                  ))}
                </div>
              </HistoryAccordion>
            )}

            {!ativa && historico.length === 0 && (
              <p className="text-sm text-ink-faint italic">Nenhuma safra registrada ainda para este talhão.</p>
            )}
          </div>
        );
      })}

      {safras.length === 0 && (
        <p className="text-sm text-ink-faint italic">Nenhuma safra encontrada no banco de dados.</p>
      )}
    </div>
  );
}
