import React, { useMemo } from 'react';
import { MapPin, Sprout, Ruler } from 'lucide-react';
import { areaTotalFazenda, getAreaTalhao } from '../lib/data.js';

const STATUS_STYLE = {
  ativo: 'bg-brand/15 text-brand border-brand/25',
  produtivo: 'bg-brand/15 text-brand border-brand/25',
  formacao: 'bg-amber/15 text-amber border-amber/25',
  inativo: 'bg-ink-muted/15 text-ink-muted border-line'
};

export default function TalhoesPage({ dados }) {
  const { talhoes, safras } = dados;
  const areaTotal = useMemo(() => areaTotalFazenda(talhoes), [talhoes]);

  const safraAtivaPorTalhao = useMemo(() => {
    const map = {};
    safras.forEach((s) => {
      if (s.status === 'ativo' || s.status === 'em_andamento') map[s.talhao_id] = s;
    });
    return map;
  }, [safras]);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-ink-faint max-w-lg">
          {talhoes.length} talhões cadastrados. A área de cada um é a mesma usada no cálculo de rateio das
          despesas gerais.
        </p>
        <div className="flex items-center gap-2 text-sm font-semibold text-ink bg-surface border border-line rounded-xl px-3.5 py-2">
          <Ruler className="w-4 h-4 text-tech" />
          {areaTotal.toLocaleString('pt-BR')} ha no total
        </div>
      </div>

      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {talhoes.map((t) => {
          const area = getAreaTalhao(t);
          const proporcao = areaTotal > 0 ? (area / areaTotal) * 100 : 0;
          const safraAtiva = safraAtivaPorTalhao[t.id];
          const statusClass = STATUS_STYLE[t.status] || STATUS_STYLE.inativo;

          return (
            <div key={t.id} className="rounded-xl2 bg-surface border border-line p-5 space-y-4">
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-center gap-2 min-w-0">
                  <MapPin className="w-4 h-4 text-ink-faint shrink-0" />
                  <h3 className="font-display font-semibold text-ink truncate">{t.nome}</h3>
                </div>
                {t.status && (
                  <span className={`text-[10px] uppercase tracking-wide px-2 py-0.5 rounded-full border font-semibold shrink-0 ${statusClass}`}>
                    {t.status}
                  </span>
                )}
              </div>

              {(t.cultura || t.variedade) && (
                <div className="text-sm text-ink-muted capitalize">
                  {t.cultura}
                  {t.variedade ? ` · ${t.variedade}` : ''}
                </div>
              )}

              <div className="flex items-center justify-between text-sm">
                <span className="text-ink-faint">Área</span>
                <span className="font-semibold tabular text-ink">{area.toLocaleString('pt-BR')} ha</span>
              </div>

              <div className="h-1.5 rounded-full bg-line-soft overflow-hidden">
                <div className="h-full bg-brand rounded-full" style={{ width: `${Math.min(proporcao, 100)}%` }} />
              </div>
              <div className="text-[11px] text-ink-faint -mt-2">{proporcao.toFixed(0)}% da área total · peso no rateio</div>

              <div className="border-t border-line pt-3 flex items-center gap-2 text-sm">
                <Sprout className="w-3.5 h-3.5 text-brand shrink-0" />
                {safraAtiva ? (
                  <span className="text-ink truncate">{safraAtiva.nome}</span>
                ) : (
                  <span className="text-ink-faint italic">Sem safra ativa</span>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {talhoes.length === 0 && <p className="text-sm text-ink-faint italic">Nenhum talhão cadastrado ainda.</p>}
    </div>
  );
}
