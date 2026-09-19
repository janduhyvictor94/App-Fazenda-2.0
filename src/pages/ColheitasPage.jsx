import React, { useMemo } from 'react';
import { Wheat } from 'lucide-react';
import { usePeriodo } from '../context/PeriodoContext.jsx';
import HistoryAccordion from '../components/HistoryAccordion.jsx';
import KpiCard from '../components/KpiCard.jsx';
import { Scale, Package } from 'lucide-react';
import { colheitasDoAno, colheitasDaSafra, receitaColheitas, parseNumber } from '../lib/data.js';
import { formatBRL, formatKg } from '../lib/format.js';

function LinhaColheita({ c, talhaoNome }) {
  return (
    <div className="flex items-center justify-between gap-3 py-2.5 border-b border-line-soft last:border-0 text-sm">
      <div className="min-w-0">
        <div className="text-ink truncate">
          {talhaoNome} <span className="text-ink-faint">· {c.tipo_colheita || c.cultura || 'colheita'}</span>
        </div>
        <div className="text-xs text-ink-faint">{c.data}</div>
      </div>
      <div className="text-right shrink-0">
        <div className="font-semibold tabular text-brand">{formatBRL(parseNumber(c.valor_total))}</div>
        <div className="text-xs text-ink-faint tabular">{formatKg(c.quantidade_kg)}</div>
      </div>
    </div>
  );
}

export default function ColheitasPage({ dados }) {
  const { modo, ano, safraSelecionada } = usePeriodo();
  const { talhoes, colheitas } = dados;

  const getTalhaoNome = (id) => talhoes.find((t) => String(t.id) === String(id))?.nome || 'Talhão';

  const escopo = useMemo(() => {
    if (modo === 'safra' && safraSelecionada) {
      return { lista: colheitasDaSafra({ colheitas, safra: safraSelecionada }), label: safraSelecionada.nome };
    }
    return { lista: colheitasDoAno({ colheitas, ano }), label: `Ano ${ano}` };
  }, [modo, ano, safraSelecionada, colheitas]);

  const porTalhao = useMemo(() => {
    const grupos = {};
    escopo.lista.forEach((c) => {
      const key = c.talhao_id || 'sem-talhao';
      if (!grupos[key]) grupos[key] = [];
      grupos[key].push(c);
    });
    return Object.entries(grupos).sort((a, b) => b[1].length - a[1].length);
  }, [escopo]);

  const totalKg = escopo.lista.reduce((acc, c) => acc + parseNumber(c.quantidade_kg), 0);
  const totalValor = receitaColheitas(escopo.lista);

  const historicoAnos = useMemo(() => {
    if (modo !== 'ano') return [];
    const anos = new Set();
    colheitas.forEach((c) => c.data && anos.add(Number(c.data.slice(0, 4))));
    return Array.from(anos)
      .filter((a) => a !== Number(ano))
      .sort((a, b) => b - a)
      .slice(0, 6);
  }, [colheitas, ano, modo]);

  return (
    <div className="space-y-6">
      <p className="text-sm text-ink-faint">
        Colheitas de <span className="text-brand font-semibold">{escopo.label}</span>, agrupadas por talhão.
      </p>

      <div className="grid grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
        <KpiCard label="Total colhido" value={formatKg(totalKg)} icon={Package} tone="brand" />
        <KpiCard label="Receita de colheitas" value={formatBRL(totalValor)} icon={Scale} tone="tech" />
        <KpiCard label="Lançamentos" value={String(escopo.lista.length)} icon={Wheat} tone="neutral" />
      </div>

      <div className="space-y-3">
        {porTalhao.map(([talhaoId, lista]) => {
          const nome = getTalhaoNome(talhaoId);
          const subtotal = receitaColheitas(lista);
          return (
            <HistoryAccordion
              key={talhaoId}
              title={nome}
              subtitle={`${lista.length} colheita${lista.length > 1 ? 's' : ''}`}
              right={formatBRL(subtotal)}
              defaultOpen
            >
              <div>
                {[...lista]
                  .sort((a, b) => (b.data || '').localeCompare(a.data || ''))
                  .map((c) => (
                    <LinhaColheita key={c.id} c={c} talhaoNome={nome} />
                  ))}
              </div>
            </HistoryAccordion>
          );
        })}
        {porTalhao.length === 0 && <p className="text-sm text-ink-faint italic">Nenhuma colheita neste período.</p>}
      </div>

      {historicoAnos.length > 0 && (
        <div className="space-y-2.5">
          <div className="flex items-center gap-2">
            <h3 className="font-display font-semibold text-sm text-ink">Histórico de anos anteriores</h3>
            <span className="text-[10px] uppercase tracking-wide text-ink-faint bg-line-soft px-2 py-0.5 rounded-full">
              recolhido por padrão
            </span>
          </div>
          {historicoAnos.map((a) => {
            const lista = colheitasDoAno({ colheitas, ano: a });
            return (
              <HistoryAccordion
                key={a}
                title={`Ano ${a}`}
                subtitle={`${lista.length} colheitas · ${lista.reduce((acc, c) => acc + parseNumber(c.quantidade_kg), 0).toLocaleString('pt-BR')} kg`}
                right={formatBRL(receitaColheitas(lista))}
              >
                <div>
                  {lista.map((c) => (
                    <LinhaColheita key={c.id} c={c} talhaoNome={getTalhaoNome(c.talhao_id)} />
                  ))}
                </div>
              </HistoryAccordion>
            );
          })}
        </div>
      )}
    </div>
  );
}
