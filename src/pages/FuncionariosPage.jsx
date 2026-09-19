import React, { useMemo } from 'react';
import { User, Phone, Calendar, UserX } from 'lucide-react';
import HistoryAccordion from '../components/HistoryAccordion.jsx';
import KpiCard from '../components/KpiCard.jsx';
import { Users, Wallet } from 'lucide-react';
import { parseNumber } from '../lib/data.js';
import { formatBRL } from '../lib/format.js';

function FuncionarioCard({ f, desligado }) {
  return (
    <div className={`rounded-xl2 border p-4 flex items-center justify-between gap-3 ${desligado ? 'bg-surface border-line opacity-80' : 'bg-surface border-line'}`}>
      <div className="flex items-center gap-3 min-w-0">
        <div className={`w-9 h-9 rounded-full flex items-center justify-center shrink-0 ${desligado ? 'bg-line-soft text-ink-faint' : 'bg-brand/15 text-brand'}`}>
          <User className="w-4 h-4" />
        </div>
        <div className="min-w-0">
          <div className="text-sm font-semibold text-ink truncate">{f.nome}</div>
          <div className="text-xs text-ink-faint truncate">{f.cargo || 'Sem cargo definido'}</div>
        </div>
      </div>
      <div className="text-right text-xs text-ink-faint shrink-0 space-y-0.5">
        {f.telefone && (
          <div className="flex items-center gap-1 justify-end">
            <Phone className="w-3 h-3" /> {f.telefone}
          </div>
        )}
        {desligado && f.data_desligamento && (
          <div className="flex items-center gap-1 justify-end text-rose">
            <UserX className="w-3 h-3" /> saiu em {f.data_desligamento}
          </div>
        )}
        {!desligado && f.data_admissao && (
          <div className="flex items-center gap-1 justify-end">
            <Calendar className="w-3 h-3" /> desde {f.data_admissao}
          </div>
        )}
      </div>
    </div>
  );
}

export default function FuncionariosPage({ dados }) {
  const { funcionarios } = dados;

  const ativos = useMemo(() => funcionarios.filter((f) => f.status !== 'Desligado' && f.status !== 'desligado'), [funcionarios]);
  const desligados = useMemo(() => funcionarios.filter((f) => f.status === 'Desligado' || f.status === 'desligado'), [funcionarios]);

  const folhaMensal = ativos.reduce((acc, f) => acc + parseNumber(f.salario), 0);

  return (
    <div className="space-y-6">
      <p className="text-sm text-ink-faint">
        Mostrando só quem está ativo hoje — igual ao filtro que já existe no app atual (status). O histórico de
        quem já trabalhou na fazenda fica recolhido, sem sumir de verdade.
      </p>

      <div className="grid grid-cols-2 gap-3 sm:gap-4 max-w-md">
        <KpiCard label="Ativos" value={String(ativos.length)} icon={Users} tone="brand" />
        <KpiCard label="Folha mensal" value={formatBRL(folhaMensal)} icon={Wallet} tone="tech" hint="salários ativos" />
      </div>

      <div className="space-y-2.5">
        {ativos.map((f) => (
          <FuncionarioCard key={f.id} f={f} />
        ))}
        {ativos.length === 0 && <p className="text-sm text-ink-faint italic">Nenhum funcionário ativo no momento.</p>}
      </div>

      {desligados.length > 0 && (
        <HistoryAccordion
          title={`Histórico — ${desligados.length} desligado${desligados.length > 1 ? 's' : ''}`}
          subtitle="Recolhido por padrão · dados de folha e rescisão preservados"
        >
          <div className="space-y-2.5">
            {desligados.map((f) => (
              <FuncionarioCard key={f.id} f={f} desligado />
            ))}
          </div>
        </HistoryAccordion>
      )}
    </div>
  );
}
