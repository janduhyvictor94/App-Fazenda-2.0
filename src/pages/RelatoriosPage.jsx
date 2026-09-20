import React, { useMemo, useState } from 'react';
import { BarChart3, Filter, CalendarRange, Printer, Layers } from 'lucide-react';
import { ResponsiveContainer, ComposedChart, Line, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend } from 'recharts';
import KpiCard from '../components/KpiCard.jsx';
import { custosDoAno, colheitasDoAno, totaisFinanceiros, receitaColheitas, demonstrativoPorTalhao } from '../lib/data.js';
import { formatBRL, formatCompactBRL } from '../lib/format.js';

const hoje = new Date();
const anoAtual = hoje.getFullYear();
const inicioAnoAtual = `${anoAtual}-01-01`;
const fimAnoAtual = `${anoAtual}-12-31`;

export default function RelatoriosPage({ dados }) {
  const { custos, colheitas, atividades = [], talhoes = [] } = dados;

  // Demonstrativo de safra por talhão (aba principal deste relatório) — mesma
  // regra de produção (Relatorios.jsx): só custos PAGOS entram, rateio dos
  // custos gerais por área, com filtro de período livre e de talhão.
  const [dataInicio, setDataInicio] = useState(inicioAnoAtual);
  const [dataFim, setDataFim] = useState(fimAnoAtual);
  const [talhaoFiltro, setTalhaoFiltro] = useState('');

  const demonstrativo = useMemo(
    () => demonstrativoPorTalhao({ custos, colheitas, atividades, talhoes, dataInicio, dataFim, talhaoId: talhaoFiltro || null }),
    [custos, colheitas, atividades, talhoes, dataInicio, dataFim, talhaoFiltro]
  );
  const { linhas, totais, custosGeraisPeriodo } = demonstrativo;

  function aplicarPreset(preset) {
    if (preset === 'ano') {
      setDataInicio(inicioAnoAtual);
      setDataFim(fimAnoAtual);
    } else if (preset === 'tudo') {
      setDataInicio('2000-01-01');
      setDataFim('2100-12-31');
    }
  }

  function gerarPdf() {
    window.print();
  }

  // --- Comparativo ano a ano (visão histórica, já existia) ---
  const anos = useMemo(() => {
    const set = new Set();
    custos.forEach((c) => c.data && set.add(Number(c.data.slice(0, 4))));
    colheitas.forEach((c) => c.data && set.add(Number(c.data.slice(0, 4))));
    return Array.from(set).sort((a, b) => a - b);
  }, [custos, colheitas]);

  const linhasAno = useMemo(
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
    <div className="space-y-6 print-area">
      <div className="no-print flex flex-wrap items-start justify-between gap-3">
        <p className="text-sm text-ink-faint max-w-2xl">
          Demonstrativo de safra por talhão — mesmo cálculo de rateio do Financeiro, só que aqui já organizado pra análise e
          impressão/PDF. Filtre por período e, se quiser, por um único talhão.
        </p>
        <button
          onClick={gerarPdf}
          className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-brand text-base font-semibold text-sm hover:bg-brand/90 transition-colors shrink-0"
        >
          <Printer className="w-4 h-4" /> Imprimir / gerar PDF
        </button>
      </div>

      <div className="no-print flex flex-wrap items-center gap-2.5">
        <div className="flex items-center gap-2 bg-surface border border-line rounded-xl px-2.5 py-1.5">
          <CalendarRange className="w-4 h-4 text-ink-faint" />
          <input
            type="date"
            value={dataInicio}
            onChange={(e) => setDataInicio(e.target.value)}
            className="bg-transparent text-xs text-ink font-medium outline-none"
          />
          <span className="text-ink-faint text-xs">até</span>
          <input
            type="date"
            value={dataFim}
            onChange={(e) => setDataFim(e.target.value)}
            className="bg-transparent text-xs text-ink font-medium outline-none"
          />
        </div>
        <button
          onClick={() => aplicarPreset('ano')}
          className="px-3 py-1.5 rounded-lg bg-line-soft text-ink-muted text-xs font-semibold hover:bg-line transition-colors"
        >
          Ano {anoAtual}
        </button>
        <button
          onClick={() => aplicarPreset('tudo')}
          className="px-3 py-1.5 rounded-lg bg-line-soft text-ink-muted text-xs font-semibold hover:bg-line transition-colors"
        >
          Tudo (histórico)
        </button>

        <div className="flex items-center gap-2 bg-surface border border-line rounded-xl px-2.5 py-1.5">
          <Filter className="w-4 h-4 text-ink-faint" />
          <select
            value={talhaoFiltro}
            onChange={(e) => setTalhaoFiltro(e.target.value)}
            className="bg-transparent text-xs text-ink font-medium outline-none"
          >
            <option value="">Todos os talhões</option>
            {talhoes.map((t) => (
              <option key={t.id} value={t.id}>
                Só {t.nome}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="hidden print:block">
        <h1 className="text-xl font-bold text-ink">Fazenda Cassiano&apos;s — Relatório Gerencial</h1>
        <p className="text-sm text-ink-faint">
          Período: {dataInicio} até {dataFim}
          {talhaoFiltro && ` · Talhão: ${talhoes.find((t) => String(t.id) === String(talhaoFiltro))?.nome || ''}`} · Emitido em{' '}
          {new Date().toLocaleDateString('pt-BR')}
        </p>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <KpiCard label="Receita" value={formatBRL(totais.receita)} icon={BarChart3} tone="brand" />
        <KpiCard label="Custo total (pago)" value={formatBRL(totais.custoTotal)} icon={BarChart3} tone="rose" />
        <KpiCard
          label="Lucro / prejuízo"
          value={formatBRL(totais.lucro)}
          icon={BarChart3}
          tone={totais.lucro >= 0 ? 'brand' : 'rose'}
        />
        <KpiCard label="Custos gerais rateados" value={formatBRL(custosGeraisPeriodo)} icon={Layers} tone="tech" hint="divididos por área" />
      </div>

      <div className="rounded-xl2 bg-surface border border-line overflow-hidden">
        <div className="px-4 sm:px-5 py-3.5 border-b border-line-soft">
          <h3 className="font-display font-semibold text-sm text-ink">Demonstrativo de safra por talhão (só pagos)</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-line text-left text-ink-faint text-[11px] uppercase tracking-wide">
                <th className="px-4 py-2.5 font-semibold">Talhão / cultura</th>
                <th className="px-4 py-2.5 font-semibold text-right">Área (ha)</th>
                <th className="px-4 py-2.5 font-semibold text-right">Custo direto</th>
                <th className="px-4 py-2.5 font-semibold text-right text-tech">Rateio geral</th>
                <th className="px-4 py-2.5 font-semibold text-right">Custo total</th>
                <th className="px-4 py-2.5 font-semibold text-right text-brand">Receita</th>
                <th className="px-4 py-2.5 font-semibold text-right">Lucro</th>
                <th className="px-4 py-2.5 font-semibold text-right">Lucro/ha</th>
              </tr>
            </thead>
            <tbody>
              {linhas.map((l) => (
                <tr key={l.id} className="border-b border-line-soft last:border-0">
                  <td className="px-4 py-2.5">
                    <div className="font-semibold text-ink">{l.nome}</div>
                    <div className="text-xs text-ink-faint capitalize">{l.cultura}</div>
                  </td>
                  <td className="px-4 py-2.5 text-right tabular text-ink-muted">{l.area.toFixed(2)}</td>
                  <td className="px-4 py-2.5 text-right tabular text-ink-muted">{formatBRL(l.custoDireto)}</td>
                  <td className="px-4 py-2.5 text-right tabular text-tech">{formatBRL(l.custoIndireto)}</td>
                  <td className="px-4 py-2.5 text-right tabular font-semibold text-rose">{formatBRL(l.custoTotal)}</td>
                  <td className="px-4 py-2.5 text-right tabular font-semibold text-brand">{formatBRL(l.receita)}</td>
                  <td className={`px-4 py-2.5 text-right tabular font-semibold ${l.lucro >= 0 ? 'text-ink' : 'text-rose'}`}>
                    {formatBRL(l.lucro)}
                  </td>
                  <td className={`px-4 py-2.5 text-right tabular ${l.lucroPorHa >= 0 ? 'text-ink-muted' : 'text-rose'}`}>
                    {formatBRL(l.lucroPorHa)}
                  </td>
                </tr>
              ))}
              {linhas.length > 0 && (
                <tr className="bg-base font-semibold">
                  <td className="px-4 py-2.5 text-ink">TOTAL</td>
                  <td className="px-4 py-2.5 text-right tabular text-ink">{totais.area.toFixed(2)}</td>
                  <td className="px-4 py-2.5 text-right tabular text-ink">{formatBRL(totais.custoDireto)}</td>
                  <td className="px-4 py-2.5 text-right tabular text-tech">{formatBRL(totais.custoIndireto)}</td>
                  <td className="px-4 py-2.5 text-right tabular text-rose">{formatBRL(totais.custoTotal)}</td>
                  <td className="px-4 py-2.5 text-right tabular text-brand">{formatBRL(totais.receita)}</td>
                  <td className={`px-4 py-2.5 text-right tabular ${totais.lucro >= 0 ? 'text-ink' : 'text-rose'}`}>
                    {formatBRL(totais.lucro)}
                  </td>
                  <td className="px-4 py-2.5 text-right text-xs text-ink-faint">média global</td>
                </tr>
              )}
            </tbody>
          </table>
          {linhas.length === 0 && <p className="text-sm text-ink-faint italic p-4">Nenhum dado encontrado para o período selecionado.</p>}
        </div>
      </div>

      <div className="no-print rounded-xl2 bg-surface border border-line p-4 sm:p-6">
        <div className="flex items-center gap-2 mb-4">
          <BarChart3 className="w-4 h-4 text-brand" />
          <h3 className="font-display font-semibold text-sm text-ink">Receita, despesa e resultado por ano</h3>
        </div>
        <div className="h-64 -ml-2">
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={linhasAno} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
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

      <div className="no-print rounded-xl2 bg-surface border border-line overflow-hidden">
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
            {[...linhasAno].reverse().map((l) => (
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
        {linhasAno.length === 0 && <p className="text-sm text-ink-faint italic p-4">Sem dados suficientes ainda.</p>}
      </div>
    </div>
  );
}
