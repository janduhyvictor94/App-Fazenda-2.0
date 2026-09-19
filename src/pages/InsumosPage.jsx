import React, { useMemo } from 'react';
import { Package, AlertTriangle } from 'lucide-react';
import KpiCard from '../components/KpiCard.jsx';
import { formatBRL } from '../lib/format.js';

export default function InsumosPage({ dados }) {
  const { insumos } = dados;

  const baixoEstoque = useMemo(
    () => insumos.filter((i) => Number(i.estoque_atual) <= Number(i.estoque_minimo || 0)),
    [insumos]
  );

  return (
    <div className="space-y-6">
      <p className="text-sm text-ink-faint">
        Catálogo de insumos — não muda com o período selecionado, é o estoque de agora.
      </p>

      <div className="grid grid-cols-2 gap-3 sm:gap-4 max-w-md">
        <KpiCard label="Itens cadastrados" value={String(insumos.length)} icon={Package} tone="brand" />
        <KpiCard
          label="Estoque baixo"
          value={String(baixoEstoque.length)}
          icon={AlertTriangle}
          tone={baixoEstoque.length > 0 ? 'amber' : 'neutral'}
        />
      </div>

      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {insumos.map((i) => {
          const precoPorUnidade =
            i.tamanho_embalagem && Number(i.tamanho_embalagem) > 0
              ? Number(i.preco_unitario) / Number(i.tamanho_embalagem)
              : null;
          const baixo = Number(i.estoque_atual) <= Number(i.estoque_minimo || 0);
          return (
            <div key={i.id} className="rounded-xl2 bg-surface border border-line p-4 space-y-3">
              <div className="flex items-start justify-between gap-2">
                <h3 className="font-display font-semibold text-ink truncate">{i.nome}</h3>
                {baixo && (
                  <span className="text-[10px] uppercase tracking-wide px-2 py-0.5 rounded-full border border-amber/25 bg-amber/15 text-amber font-semibold shrink-0">
                    repor
                  </span>
                )}
              </div>
              {i.categoria && <div className="text-xs text-ink-faint capitalize">{i.categoria}</div>}
              <div className="flex items-center justify-between text-sm">
                <span className="text-ink-faint">Estoque</span>
                <span className="font-semibold tabular text-ink">
                  {i.estoque_atual} {i.unidade}
                </span>
              </div>
              {precoPorUnidade != null && (
                <div className="flex items-center justify-between text-sm">
                  <span className="text-ink-faint">Preço/{i.unidade}</span>
                  <span className="font-semibold tabular text-tech">{formatBRL(precoPorUnidade)}</span>
                </div>
              )}
              {i.fornecedor && <div className="text-xs text-ink-faint border-t border-line pt-2">Fornecedor: {i.fornecedor}</div>}
            </div>
          );
        })}
      </div>

      {insumos.length === 0 && <p className="text-sm text-ink-faint italic">Nenhum insumo cadastrado ainda.</p>}
    </div>
  );
}
