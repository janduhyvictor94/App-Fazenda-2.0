import React, { useMemo } from 'react';
import { Wallet, TrendingUp, Scale, Map, ArrowUpRight, ArrowDownRight } from 'lucide-react';
import {
  ResponsiveContainer,
  ComposedChart,
  Area,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip
} from 'recharts';
import { usePeriodo } from '../context/PeriodoContext.jsx';
import KpiCard from '../components/KpiCard.jsx';
import HistoryAccordion from '../components/HistoryAccordion.jsx';
import {
  areaTotalFazenda,
  custosDoAno,
  colheitasDoAno,
  custosDaSafra,
  colheitasDaSafra,
  totaisFinanceiros,
  receitaColheitas,
  parseNumber
} from '../lib/data.js';
import { formatBRL, formatCompactBRL, MESES_PT } from '../lib/format.js';

function CustomTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-lg bg-surface-raised border border-line px-3 py-2 text-xs shadow-glow">
      <div className="text-ink-faint mb-1">{label}</div>
      {payload.map((p) => (
        <div key={p.dataKey} className="flex items-center gap-2 text-ink font-medium">
          <span className="w-2 h-2 rounded-full" style={{ background: p.color }} />
          {p.name}: <span className="tabular">{formatBRL(p.value)}</span>
        </div>
      ))}
    </div>
  );
}

export default function DashboardPage({ dados }) {
  const { modo, ano, safraSelecionada, anoAtual } = usePeriodo();
  const { talhoes, safras, colheitas, custos } = dados;

  const areaTotal = useMemo(() => areaTotalFazenda(talhoes), [talhoes]);

  const escopo = useMemo(() => {
    if (modo === 'safra' && safraSelecionada) {
      const custosEscopo = custosDaSafra({ custos, safra: safraSelecionada, talhoes });
      const colheitasEscopo = colheitasDaSafra({ colheitas, safra: safraSelecionada });
      return { custosEscopo, colheitasEscopo, label: safraSelecionada.nome };
    }
    return {
      custosEscopo: custosDoAno({ custos, ano }),
      colheitasEscopo: colheitasDoAno({ colheitas, ano }),
      label: `Ano ${ano}`
    };
  }, [modo, ano, safraSelecionada, custos, colheitas, talhoes]);

  const { despesasPagas, despesasPendentes, receitasExtras } = totaisFinanceiros(escopo.custosEscopo);
  const receitaTotal = receitaColheitas(escopo.colheitasEscopo) + receitasExtras;
  const resultado = receitaTotal - despesasPagas;

  const serieMensal = useMemo(() => {
    const base = Array.from({ length: 12 }, (_, i) => ({
      mes: MESES_PT[i],
      key: String(i + 1).padStart(2, '0'),
      Receita: 0,
      Despesa: 0
    }));
    escopo.colheitasEscopo.forEach((c) => {
      if (!c.data) return;
      const idx = Number(c.data.slice(5, 7)) - 1;
      if (idx >= 0 && idx < 12) base[idx].Receita += parseNumber(c.valor_total);
    });
    escopo.custosEscopo
      .filter((c) => c.tipo_lancamento === 'despesa' && c.status_pagamento === 'pago')
      .forEach((c) => {
        if (!c.data) return;
        const idx = Number(c.data.slice(5, 7)) - 1;
        if (idx >= 0 && idx < 12) base[idx].Despesa += parseNumber(c.valor);
      });
    return modo === 'ano' && Number(ano) < anoAtual ? base : base.filter((_, i) => i <= new Date().getMonth() || ano !== anoAtual);
  }, [escopo, modo, ano, anoAtual]);

  const historicoAnos = useMemo(() => {
    const anos = new Set();
    custos.forEach((c) => c.data && anos.add(c.data.slice(0, 4)));
    colheitas.forEach((c) => c.data && anos.add(c.data.slice(0, 4)));
    return Array.from(anos)
      .map(Number)
      .filter((a) => a !== Number(ano) || modo !== 'ano')
      .sort((a, b) => b - a)
      .slice(0, 6);
  }, [custos, colheitas, ano, modo]);

  return (
    <div className="space-y-6">
      <div>
        <p className="text-sm text-ink-faint">
          Mostrando <span className="text-brand font-semibold">{escopo.label}</span> — o histórico completo
          continua disponível, é só trocar o período no topo.
        </p>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <KpiCard label="Receita" value={formatCompactBRL(receitaTotal)} icon={TrendingUp} tone="brand" hint="colheitas + extras" />
        <KpiCard label="Despesas pagas" value={formatCompactBRL(despesasPagas)} icon={Wallet} tone="rose" hint={despesasPendentes > 0 ? `${formatCompactBRL(despesasPendentes)} pendente` : 'tudo em dia'} />
        <KpiCard
          label="Resultado"
          value={formatCompactBRL(resultado)}
          icon={Scale}
          tone={resultado >= 0 ? 'brand' : 'rose'}
          hint={resultado >= 0 ? 'positivo no período' : 'negativo no período'}
        />
        <KpiCard label="Área total" value={`${areaTotal.toLocaleString('pt-BR')} ha`} icon={Map} tone="tech" hint={`${talhoes.length} talhões`} />
      </div>

      <div className="rounded-xl2 bg-surface border border-line p-4 sm:p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-display font-semibold text-sm text-ink">Receita x Despesa por mês</h3>
          <div className="flex items-center gap-3 text-xs text-ink-faint">
            <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-brand" />Receita</span>
            <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-rose" />Despesa</span>
          </div>
        </div>
        <div className="h-64 -ml-2">
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={serieMensal} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
              <defs>
                <linearGradient id="receitaFill" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#3EE089" stopOpacity={0.35} />
                  <stop offset="100%" stopColor="#3EE089" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid vertical={false} stroke="rgba(234,242,236,0.06)" />
              <XAxis dataKey="mes" tick={{ fill: '#93A8A0', fontSize: 11 }} axisLine={false} tickLine={false} />
              <YAxis
                tick={{ fill: '#93A8A0', fontSize: 11 }}
                axisLine={false}
                tickLine={false}
                tickFormatter={(v) => formatCompactBRL(v)}
                width={56}
              />
              <Tooltip content={<CustomTooltip />} />
              <Area type="monotone" dataKey="Receita" stroke="#3EE089" strokeWidth={2} fill="url(#receitaFill)" />
              <Bar dataKey="Despesa" fill="#F2607F" radius={[4, 4, 0, 0]} barSize={10} />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      </div>

      {modo === 'ano' && historicoAnos.length > 0 && (
        <div className="space-y-2.5">
          <div className="flex items-center gap-2">
            <h3 className="font-display font-semibold text-sm text-ink">Histórico de anos anteriores</h3>
            <span className="text-[10px] uppercase tracking-wide text-ink-faint bg-line-soft px-2 py-0.5 rounded-full">
              recolhido por padrão
            </span>
          </div>
          {historicoAnos.map((a) => {
            const c = custosDoAno({ custos, ano: a });
            const h = colheitasDoAno({ colheitas, ano: a });
            const { despesasPagas: dp } = totaisFinanceiros(c);
            const receita = receitaColheitas(h);
            return (
              <HistoryAccordion
                key={a}
                title={`Ano ${a}`}
                subtitle={`${h.length} colheitas · ${c.length} lançamentos`}
                right={
                  <span className={receita - dp >= 0 ? 'text-brand flex items-center gap-1' : 'text-rose flex items-center gap-1'}>
                    {receita - dp >= 0 ? <ArrowUpRight className="w-3.5 h-3.5" /> : <ArrowDownRight className="w-3.5 h-3.5" />}
                    {formatCompactBRL(receita - dp)}
                  </span>
                }
              >
                <div className="grid grid-cols-3 gap-4 text-sm">
                  <div>
                    <div className="text-ink-faint text-xs mb-0.5">Receita</div>
                    <div className="font-semibold text-brand tabular">{formatBRL(receita)}</div>
                  </div>
                  <div>
                    <div className="text-ink-faint text-xs mb-0.5">Despesas pagas</div>
                    <div className="font-semibold text-rose tabular">{formatBRL(dp)}</div>
                  </div>
                  <div>
                    <div className="text-ink-faint text-xs mb-0.5">Resultado</div>
                    <div className="font-semibold tabular">{formatBRL(receita - dp)}</div>
                  </div>
                </div>
              </HistoryAccordion>
            );
          })}
        </div>
      )}
    </div>
  );
}
