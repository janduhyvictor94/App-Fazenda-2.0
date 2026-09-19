import React, { useMemo } from 'react';
import { Clock, CheckCircle2, Layers } from 'lucide-react';
import { usePeriodo } from '../context/PeriodoContext.jsx';
import HistoryAccordion from '../components/HistoryAccordion.jsx';
import KpiCard from '../components/KpiCard.jsx';
import { Wallet, TrendingDown, AlertCircle } from 'lucide-react';
import {
  custosDoAno,
  custosDaSafra,
  totaisFinanceiros,
  categoriaLabels,
  parseNumber
} from '../lib/data.js';
import { formatBRL, MESES_PT } from '../lib/format.js';

function LinhaLancamento({ c }) {
  const cat = categoriaLabels[c.categoria] || categoriaLabels.outro;
  return (
    <div className="flex items-center justify-between gap-3 py-2.5 border-b border-line-soft last:border-0">
      <div className="flex items-center gap-2.5 min-w-0">
        <span className={`text-[10px] uppercase tracking-wide px-1.5 py-0.5 rounded-md font-semibold ${cat.color}`}>
          {cat.label}
        </span>
        <span className="text-sm text-ink truncate">{c.descricao || 'Lançamento'}</span>
        {c.isRateio && (
          <span className="hidden sm:flex items-center gap-1 text-[10px] text-tech shrink-0">
            <Layers className="w-3 h-3" /> rateio
          </span>
        )}
      </div>
      <div className="flex items-center gap-2 shrink-0">
        {c.status_pagamento === 'pago' ? (
          <CheckCircle2 className="w-3.5 h-3.5 text-brand" />
        ) : (
          <Clock className="w-3.5 h-3.5 text-amber" />
        )}
        <span className={`text-sm font-semibold tabular ${c.tipo_lancamento === 'receita' ? 'text-brand' : 'text-ink'}`}>
          {c.tipo_lancamento === 'despesa' ? '- ' : '+ '}
          {formatBRL(parseNumber(c.valor))}
        </span>
      </div>
    </div>
  );
}

export default function FinanceiroPage({ dados }) {
  const { modo, ano, safraSelecionada } = usePeriodo();
  const { talhoes, custos } = dados;
  const mesAtual = new Date().getMonth();

  const custosEscopo = useMemo(() => {
    if (modo === 'safra' && safraSelecionada) {
      return custosDaSafra({ custos, safra: safraSelecionada, talhoes });
    }
    return custosDoAno({ custos, ano });
  }, [modo, ano, safraSelecionada, custos, talhoes]);

  const { despesasPagas, despesasPendentes, receitasExtras } = totaisFinanceiros(custosEscopo);

  const porMes = useMemo(() => {
    const grupos = {};
    custosEscopo.forEach((c) => {
      if (!c.data) return;
      const key = c.data.slice(0, 7);
      if (!grupos[key]) grupos[key] = [];
      grupos[key].push(c);
    });
    return Object.entries(grupos).sort((a, b) => b[0].localeCompare(a[0]));
  }, [custosEscopo]);

  return (
    <div className="space-y-6">
      <p className="text-sm text-ink-faint">
        Lançamentos de <span className="text-brand font-semibold">{modo === 'safra' ? safraSelecionada?.nome : `${ano}`}</span>.
        Custos gerais da fazenda aparecem já rateados por área — igual ao cálculo atual, só com o selo{' '}
        <span className="text-tech inline-flex items-center gap-0.5"><Layers className="w-3 h-3" />rateio</span> pra ficar claro.
      </p>

      <div className="grid grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
        <KpiCard label="Pago no período" value={formatBRL(despesasPagas)} icon={Wallet} tone="rose" />
        <KpiCard label="Pendente" value={formatBRL(despesasPendentes)} icon={AlertCircle} tone="amber" hint={despesasPendentes > 0 ? 'aguardando pagamento' : undefined} />
        <KpiCard label="Receitas extras" value={formatBRL(receitasExtras)} icon={TrendingDown} tone="brand" hint="fora da colheita" />
      </div>

      <div className="space-y-2.5">
        {porMes.map(([mesKey, lista], idx) => {
          const [anoLista, mesNum] = mesKey.split('-');
          const nomeMes = `${MESES_PT[Number(mesNum) - 1]} de ${anoLista}`;
          const total = lista.reduce((acc, c) => acc + (c.tipo_lancamento === 'despesa' ? parseNumber(c.valor) : 0), 0);
          const isRecente = idx === 0;
          return (
            <HistoryAccordion
              key={mesKey}
              title={nomeMes}
              subtitle={`${lista.length} lançamento${lista.length > 1 ? 's' : ''}`}
              right={formatBRL(total)}
              defaultOpen={isRecente}
            >
              <div>
                {[...lista]
                  .sort((a, b) => (b.data || '').localeCompare(a.data || ''))
                  .map((c) => (
                    <LinhaLancamento key={c.id} c={c} />
                  ))}
              </div>
            </HistoryAccordion>
          );
        })}

        {porMes.length === 0 && (
          <p className="text-sm text-ink-faint italic">Nenhum lançamento neste período.</p>
        )}
      </div>
    </div>
  );
}
