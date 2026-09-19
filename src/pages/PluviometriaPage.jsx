import React, { useMemo } from 'react';
import { CloudRain, Droplets } from 'lucide-react';
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip } from 'recharts';
import { usePeriodo } from '../context/PeriodoContext.jsx';
import KpiCard from '../components/KpiCard.jsx';
import HistoryAccordion from '../components/HistoryAccordion.jsx';
import { filtrarPorAno, filtrarPorSafra } from '../lib/data.js';
import { MESES_PT } from '../lib/format.js';

export default function PluviometriaPage({ dados }) {
  const { modo, ano, safraSelecionada } = usePeriodo();
  const { talhoes, pluviometria } = dados;
  const getTalhaoNome = (id) => talhoes.find((t) => String(t.id) === String(id))?.nome || 'Geral / todos os talhões';

  const escopo = useMemo(() => {
    if (modo === 'safra' && safraSelecionada) return filtrarPorSafra(pluviometria, safraSelecionada);
    return filtrarPorAno(pluviometria, ano);
  }, [modo, ano, safraSelecionada, pluviometria]);

  const acumulado = escopo.reduce((acc, c) => acc + (Number(c.quantidade_mm) || 0), 0);
  const media = escopo.length > 0 ? acumulado / escopo.length : 0;

  const porMes = useMemo(() => {
    const base = Array.from({ length: 12 }, (_, i) => ({ mes: MESES_PT[i], mm: 0 }));
    escopo.forEach((c) => {
      if (!c.data) return;
      const idx = Number(c.data.slice(5, 7)) - 1;
      if (idx >= 0 && idx < 12) base[idx].mm += Number(c.quantidade_mm) || 0;
    });
    return base;
  }, [escopo]);

  return (
    <div className="space-y-6">
      <p className="text-sm text-ink-faint">
        Chuva registrada em <span className="text-brand font-semibold">{modo === 'safra' ? safraSelecionada?.nome : `Ano ${ano}`}</span>.
      </p>

      <div className="grid grid-cols-2 gap-3 sm:gap-4 max-w-md">
        <KpiCard label="Acumulado" value={`${acumulado.toFixed(1)} mm`} icon={CloudRain} tone="tech" />
        <KpiCard label="Média por registro" value={`${media.toFixed(1)} mm`} icon={Droplets} tone="brand" />
      </div>

      <div className="rounded-xl2 bg-surface border border-line p-4 sm:p-6">
        <h3 className="font-display font-semibold text-sm text-ink mb-4">Volume por mês</h3>
        <div className="h-56 -ml-2">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={porMes} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
              <CartesianGrid vertical={false} stroke="rgba(234,242,236,0.06)" />
              <XAxis dataKey="mes" tick={{ fill: '#93A8A0', fontSize: 11 }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fill: '#93A8A0', fontSize: 11 }} axisLine={false} tickLine={false} width={36} />
              <Tooltip
                contentStyle={{ background: '#161F1A', border: '1px solid rgba(234,242,236,0.08)', borderRadius: 8, fontSize: 12 }}
                labelStyle={{ color: '#93A8A0' }}
                formatter={(v) => [`${v} mm`, 'Chuva']}
              />
              <Bar dataKey="mm" fill="#33C9E8" radius={[4, 4, 0, 0]} barSize={16} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      <HistoryAccordion title="Registros do período" subtitle={`${escopo.length} lançamentos`} defaultOpen>
        <div>
          {[...escopo]
            .sort((a, b) => (b.data || '').localeCompare(a.data || ''))
            .map((c) => (
              <div key={c.id} className="flex items-center justify-between py-2 border-b border-line-soft last:border-0 text-sm">
                <span className="text-ink-faint">{c.data} · {getTalhaoNome(c.talhao_id)}</span>
                <span className="font-semibold tabular text-tech">{c.quantidade_mm} mm</span>
              </div>
            ))}
          {escopo.length === 0 && <p className="text-sm text-ink-faint italic py-2">Nenhum registro neste período.</p>}
        </div>
      </HistoryAccordion>
    </div>
  );
}
