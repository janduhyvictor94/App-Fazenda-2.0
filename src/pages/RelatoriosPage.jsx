import React, { useMemo } from 'react';
import { BarChart3 } from 'lucide-react';
import { ResponsiveContainer, ComposedChart, Line, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend } from 'recharts';
import { custosDoAno, colheitasDoAno, totaisFinanceiros, receitaColheitas } from '../lib/data.js';
import { formatBRL, formatCompactBRL } from '../lib/format.js';

export default function RelatoriosPage({ dados }) {
  const { custos, colheitas } = dados;

  const anos = useMemo(() => {
    const set = new Set();
    custos.forEach((c) => c.data && set.add(Number(c.data.slice(0, 4))));
    colheitas.forEach((c) => c.data && set.add(Number(c.data.slice(0, 4))));
    return Array.from(set).sort((a, b) => a - b);
  }, [custos, colheitas]);

  const linhas = useMemo(
    () =>
      anos.map((ano) => {
        const c = custosDoAno({ custos, ano });
        const h = colheitasDoAno({ colheitas, ano });
        const { despesasPagas } = totaisFinanceiros(c);
        const receita = receitaColheitas(h);
        return { ano, receita, despesa: despesasPagas, resultado: receita - despesasPagas };
      }),
    [anos, custos, colheitas]
  );

  return (
    <div className="space-y-6">
      <p className="text-sm text-ink-faint">
        Comparativo ano a ano — a visão que fica "fora do caminho" no dia a dia, mas continua acessível aqui pra
        quando você precisar olhar a tendência geral do negócio.
      </p>

      <div className="rounded-xl2 bg-surface border border-line p-4 sm:p-6">
        <div className="flex items-center gap-2 mb-4">
          <BarChart3 className="w-4 h-4 text-brand" />
          <h3 className="font-display font-semibold text-sm text-ink">Receita, despesa e resultado por ano</h3>
        </div>
        <div className="h-64 -ml-2">
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={linhas} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
              <CartesianGrid vertical={false} stroke="rgba(234,242,236,0.06)" />
              <XAxis dataKey="ano" tick={{ fill: '#93A8A0', fontSize: 11 }} axisLine={false} tickLine={false} />
              <YAxis
                tick={{ fill: '#93A8A0', fontSize: 11 }}
                axisLine={false}
                tickLine={false}
                tickFormatter={formatCompactBRL}
                width={56}
              />
              <Tooltip
                contentStyle={{ background: '#161F1A', border: '1px solid rgba(234,242,236,0.08)', borderRadius: 8, fontSize: 12 }}
                labelStyle={{ color: '#93A8A0' }}
                formatter={(v) => formatBRL(v)}
              />
              <Legend wrapperStyle={{ fontSize: 12 }} />
              <Bar dataKey="receita" name="Receita" fill="#3EE089" radius={[4, 4, 0, 0]} barSize={22} />
              <Bar dataKey="despesa" name="Despesa" fill="#F2607F" radius={[4, 4, 0, 0]} barSize={22} />
              <Line type="monotone" dataKey="resultado" name="Resultado" stroke="#33C9E8" strokeWidth={2.5} dot={{ r: 3 }} />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="rounded-xl2 bg-surface border border-line overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-line text-left text-ink-faint text-xs uppercase tracking-wide">
              <th className="px-4 py-3 font-semibold">Ano</th>
              <th className="px-4 py-3 font-semibold text-right">Receita</th>
              <th className="px-4 py-3 font-semibold text-right">Despesa</th>
              <th className="px-4 py-3 font-semibold text-right">Resultado</th>
            </tr>
          </thead>
          <tbody>
            {[...linhas].reverse().map((l) => (
              <tr key={l.ano} className="border-b border-line-soft last:border-0">
                <td className="px-4 py-3 font-semibold text-ink">{l.ano}</td>
                <td className="px-4 py-3 text-right tabular text-brand">{formatBRL(l.receita)}</td>
                <td className="px-4 py-3 text-right tabular text-rose">{formatBRL(l.despesa)}</td>
                <td className={`px-4 py-3 text-right tabular font-semibold ${l.resultado >= 0 ? 'text-ink' : 'text-rose'}`}>
                  {formatBRL(l.resultado)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {linhas.length === 0 && <p className="text-sm text-ink-faint italic p-4">Sem dados suficientes ainda.</p>}
      </div>
    </div>
  );
}
