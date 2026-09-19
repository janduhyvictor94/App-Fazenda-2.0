import React, { useMemo, useState } from 'react';
import {
  BrainCircuit,
  TrendingUp,
  TrendingDown,
  AlertTriangle,
  AlertOctagon,
  Trophy,
  Layers,
  CalendarRange
} from 'lucide-react';
import { ResponsiveContainer, ComposedChart, Bar, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend } from 'recharts';
import { usePeriodo } from '../context/PeriodoContext.jsx';
import KpiCard from '../components/KpiCard.jsx';
import { indicadoresPorTalhao, gerarAlertasGerenciais } from '../lib/data.js';
import { formatBRL, formatCompactBRL, formatKg } from '../lib/format.js';

const NIVEL_STYLE = {
  critico: { icon: AlertOctagon, cls: 'text-rose bg-rose/10 border-rose/25' },
  atencao: { icon: AlertTriangle, cls: 'text-amber bg-amber/10 border-amber/25' }
};

export default function InteligenciaPage({ dados }) {
  // Esta tela compara talhões entre si dentro de um ANO — cada talhão pode
  // ter uma safra em época diferente, então "safra" não se aplica aqui.
  // Por isso ela tem seu próprio seletor de ano, independente do filtro
  // global (que continua funcionando normalmente nas outras telas).
  const { anoAtual, anosDisponiveis } = usePeriodo();
  const [ano, setAno] = useState(anoAtual);
  const { talhoes, custos, colheitas, consultorias } = dados;

  const indicadores = useMemo(
    () => indicadoresPorTalhao({ talhoes, custos, colheitas, ano }),
    [talhoes, custos, colheitas, ano]
  );

  const alertas = useMemo(
    () => gerarAlertasGerenciais({ indicadores, custos, consultorias }),
    [indicadores, custos, consultorias]
  );

  const comArea = indicadores.filter((i) => i.areaHa > 0);
  const custoPorHaMedio = comArea.length ? comArea.reduce((a, i) => a + i.custoPorHa, 0) / comArea.length : 0;
  const receitaPorHaMedia = comArea.length
    ? comArea.reduce((a, i) => a + (i.areaHa > 0 ? i.receita / i.areaHa : 0), 0) / comArea.length
    : 0;

  const maisProdutivo = [...indicadores].filter((i) => i.kgColhidos > 0).sort((a, b) => b.kgPorHa - a.kgPorHa)[0];
  const maiorMargem = [...indicadores].sort((a, b) => b.margem - a.margem)[0];

  const ranking = [...indicadores].sort((a, b) => b.margem - a.margem);

  // As três séries ficam na mesma escala (R$/ha) de propósito — misturar
  // margem TOTAL com custo/receita POR HECTARE deixava as barras minúsculas
  // ao lado da linha.
  const dadosGrafico = ranking.map((i) => ({
    nome: i.talhao.nome.replace(/^Talhão\s*/i, 'T. '),
    'Custo/ha': Number(i.custoPorHa.toFixed(2)),
    'Receita/ha': Number((i.areaHa > 0 ? i.receita / i.areaHa : 0).toFixed(2)),
    'Margem/ha': Number(i.margemPorHa.toFixed(2))
  }));

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-ink-faint max-w-lg">
          Comparativo entre talhões no ano selecionado — independente do filtro de safra usado nas outras telas.
        </p>
        <label className="flex items-center gap-2 pl-3 pr-2.5 py-2 rounded-xl bg-surface-raised border border-line text-sm font-medium text-ink">
          <CalendarRange className="w-3.5 h-3.5 text-brand" />
          <select
            value={ano}
            onChange={(e) => setAno(Number(e.target.value))}
            className="bg-transparent outline-none tabular"
          >
            {anosDisponiveis.map((a) => (
              <option key={a} value={a} className="bg-surface-raised">
                Ano {a}
              </option>
            ))}
          </select>
        </label>
      </div>

      <div className="rounded-xl2 bg-tech/10 border border-tech/25 p-4 flex items-start gap-3">
        <BrainCircuit className="w-4 h-4 text-tech shrink-0 mt-0.5" />
        <p className="text-sm text-ink-muted">
          Cruzamento automático dos seus próprios dados — nenhum número aqui é inventado ou vem de outra fonte.
          Custo geral rateado por área, igual sempre; os alertas são regras simples (comparação com a média da
          fazenda, prazos de pagamento/consultoria), não previsão nem IA generativa.
        </p>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <KpiCard label="Custo/ha médio" value={formatCompactBRL(custoPorHaMedio)} icon={Layers} tone="rose" hint={`Ano ${ano}`} />
        <KpiCard label="Receita/ha médio" value={formatCompactBRL(receitaPorHaMedia)} icon={TrendingUp} tone="brand" hint={`Ano ${ano}`} />
        <KpiCard
          label="Mais produtivo"
          value={maisProdutivo ? formatKg(maisProdutivo.kgPorHa) + '/ha' : '—'}
          icon={Trophy}
          tone="tech"
          hint={maisProdutivo?.talhao.nome}
        />
        <KpiCard
          label="Maior margem"
          value={maiorMargem ? formatCompactBRL(maiorMargem.margem) : '—'}
          icon={maiorMargem && maiorMargem.margem >= 0 ? TrendingUp : TrendingDown}
          tone={maiorMargem && maiorMargem.margem >= 0 ? 'brand' : 'rose'}
          hint={maiorMargem?.talhao.nome}
        />
      </div>

      {alertas.length > 0 && (
        <div className="space-y-2.5">
          <h3 className="font-display font-semibold text-sm text-ink">Alertas e recomendações</h3>
          {alertas.map((a, idx) => {
            const estilo = NIVEL_STYLE[a.nivel] || NIVEL_STYLE.atencao;
            const Icon = estilo.icon;
            return (
              <div key={idx} className={`rounded-xl2 border p-3.5 flex items-start gap-3 ${estilo.cls}`}>
                <Icon className="w-4 h-4 shrink-0 mt-0.5" />
                <p className="text-sm text-ink">
                  {a.texto}
                  {a.valor ? <span className="font-semibold"> ({formatBRL(a.valor)})</span> : null}
                </p>
              </div>
            );
          })}
        </div>
      )}
      {alertas.length === 0 && (
        <div className="rounded-xl2 bg-brand/10 border border-brand/25 p-4 text-sm text-ink">
          Nenhum alerta no momento — os talhões estão dentro da média da fazenda em {ano}.
        </div>
      )}

      <div className="rounded-xl2 bg-surface border border-line p-4 sm:p-6">
        <h3 className="font-display font-semibold text-sm text-ink mb-4">Custo x Receita por hectare, por talhão</h3>
        <div className="h-72 -ml-2">
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={dadosGrafico} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
              <CartesianGrid vertical={false} stroke="rgba(234,242,236,0.06)" />
              <XAxis dataKey="nome" tick={{ fill: '#93A8A0', fontSize: 11 }} axisLine={false} tickLine={false} />
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
              <Bar dataKey="Receita/ha" fill="#3EE089" radius={[4, 4, 0, 0]} barSize={18} />
              <Bar dataKey="Custo/ha" fill="#F2607F" radius={[4, 4, 0, 0]} barSize={18} />
              <Line type="monotone" dataKey="Margem/ha" stroke="#33C9E8" strokeWidth={2.5} dot={{ r: 3 }} />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="rounded-xl2 bg-surface border border-line overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-line text-left text-ink-faint text-xs uppercase tracking-wide">
              <th className="px-4 py-3 font-semibold">Talhão</th>
              <th className="px-4 py-3 font-semibold text-right">Área</th>
              <th className="px-4 py-3 font-semibold text-right">Custo/ha</th>
              <th className="px-4 py-3 font-semibold text-right">Kg/ha</th>
              <th className="px-4 py-3 font-semibold text-right">Receita</th>
              <th className="px-4 py-3 font-semibold text-right">Margem</th>
            </tr>
          </thead>
          <tbody>
            {ranking.map((i) => (
              <tr key={i.talhao.id} className="border-b border-line-soft last:border-0">
                <td className="px-4 py-3 font-semibold text-ink">{i.talhao.nome}</td>
                <td className="px-4 py-3 text-right tabular text-ink-muted">{i.areaHa.toLocaleString('pt-BR')} ha</td>
                <td className="px-4 py-3 text-right tabular text-rose">{formatBRL(i.custoPorHa)}</td>
                <td className="px-4 py-3 text-right tabular text-ink-muted">{i.kgPorHa > 0 ? formatKg(i.kgPorHa) : '—'}</td>
                <td className="px-4 py-3 text-right tabular text-brand">{formatBRL(i.receita)}</td>
                <td className={`px-4 py-3 text-right tabular font-semibold ${i.margem >= 0 ? 'text-ink' : 'text-rose'}`}>
                  {formatBRL(i.margem)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {ranking.length === 0 && <p className="text-sm text-ink-faint italic p-4">Sem talhões cadastrados ainda.</p>}
      </div>
    </div>
  );
}
