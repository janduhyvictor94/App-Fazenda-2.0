import React, { useMemo, useState } from 'react';
import { Clock, CheckCircle2, Layers, Plus, Edit, Trash2, Loader2, AlertTriangle, CheckCheck } from 'lucide-react';
import { usePeriodo } from '../context/PeriodoContext.jsx';
import HistoryAccordion from '../components/HistoryAccordion.jsx';
import KpiCard from '../components/KpiCard.jsx';
import Modal from '../components/Modal.jsx';
import { Wallet, TrendingDown, AlertCircle } from 'lucide-react';
import { supabase } from '../lib/supabaseClient.js';
import {
  custosDoAno,
  custosDaSafra,
  totaisFinanceiros,
  categoriaLabels,
  parseNumber
} from '../lib/data.js';
import { formatBRL, MESES_PT } from '../lib/format.js';

// Mesmos campos e valores padrão do formulário de produção
// (App-Fazenda-2.0/src/pages/Financeiro.jsx) — só a tecnologia mudou.
function formVazio() {
  return {
    descricao: '',
    categoria: 'outro',
    talhao_id: '',
    valor: '',
    data: new Date().toISOString().slice(0, 10),
    status_pagamento: 'pago',
    tipo_lancamento: 'despesa',
    observacoes: ''
  };
}

function LinhaLancamento({ c, onEditar, onExcluir, onMarcarPago }) {
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
          <CheckCircle2 className="w-3.5 h-3.5 text-brand shrink-0" />
        ) : (
          <button
            onClick={() => onMarcarPago(c)}
            title="Marcar como pago"
            className="text-amber hover:text-brand transition-colors shrink-0"
          >
            <Clock className="w-3.5 h-3.5" />
          </button>
        )}
        <span className={`text-sm font-semibold tabular ${c.tipo_lancamento === 'receita' ? 'text-brand' : 'text-ink'}`}>
          {c.tipo_lancamento === 'despesa' ? '- ' : '+ '}
          {formatBRL(parseNumber(c.valor))}
        </span>
        <div className="flex items-center gap-0.5 shrink-0">
          <button onClick={() => onEditar(c)} className="p-1 text-ink-faint hover:text-ink transition-colors">
            <Edit className="w-3.5 h-3.5" />
          </button>
          <button onClick={() => onExcluir(c)} className="p-1 text-ink-faint hover:text-rose transition-colors">
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </div>
  );
}

export default function FinanceiroPage({ dados, recarregar }) {
  const { modo, ano, safraSelecionada } = usePeriodo();
  const { talhoes, custos } = dados;

  const [open, setOpen] = useState(false);
  const [editando, setEditando] = useState(null);
  const [form, setForm] = useState(formVazio());
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState(null);

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

  function abrirNovo() {
    setEditando(null);
    setForm(formVazio());
    setErro(null);
    setOpen(true);
  }

  // Um lançamento "rateio" (custo geral distribuído por área numa visão de
  // safra) tem o mesmo id do lançamento real, só que com o valor já
  // proporcionalizado — busca o registro original em `custos` pra abrir a
  // edição sempre com o valor de verdade gravado no banco.
  function abrirEdicao(c) {
    const original = custos.find((x) => x.id === c.id) || c;
    setEditando(original);
    setForm({
      descricao: original.descricao || '',
      categoria: original.categoria || 'outro',
      talhao_id: original.talhao_id || '',
      valor: original.valor?.toString() || '',
      data: original.data || new Date().toISOString().slice(0, 10),
      status_pagamento: original.status_pagamento || 'pago',
      tipo_lancamento: original.tipo_lancamento || 'despesa',
      observacoes: original.observacoes || ''
    });
    setErro(null);
    setOpen(true);
  }

  async function salvar(e) {
    e.preventDefault();
    if (!form.descricao.trim()) {
      setErro('Informe uma descrição.');
      return;
    }
    if (!form.valor || Number(form.valor) <= 0) {
      setErro('Informe um valor maior que zero.');
      return;
    }
    if (!form.data) {
      setErro('Informe a data do lançamento.');
      return;
    }
    setSalvando(true);
    setErro(null);
    try {
      const payload = {
        descricao: form.descricao,
        categoria: form.categoria,
        talhao_id: form.talhao_id || null,
        valor: Number(form.valor) || 0,
        data: form.data,
        status_pagamento: form.status_pagamento,
        tipo_lancamento: form.tipo_lancamento,
        observacoes: form.observacoes || null
      };
      if (editando) {
        const { error } = await supabase.from('custos').update(payload).eq('id', editando.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('custos').insert([payload]);
        if (error) throw error;
      }
      setOpen(false);
      await recarregar();
    } catch (err) {
      setErro(err.message || 'Não foi possível salvar o lançamento.');
    } finally {
      setSalvando(false);
    }
  }

  async function excluir(c) {
    if (!confirm('Excluir este lançamento? Essa ação não pode ser desfeita.')) return;
    try {
      const { error } = await supabase.from('custos').delete().eq('id', c.id);
      if (error) throw error;
      await recarregar();
    } catch (err) {
      alert(`Não foi possível excluir o lançamento.\n\nMotivo: ${err.message || 'Erro desconhecido'}`);
    }
  }

  // Marca 1 lançamento como pago, sem precisar abrir o formulário de edição.
  async function marcarPago(c) {
    try {
      const { error } = await supabase.from('custos').update({ status_pagamento: 'pago' }).eq('id', c.id);
      if (error) throw error;
      await recarregar();
    } catch (err) {
      alert(`Não foi possível marcar como pago.\n\nMotivo: ${err.message || 'Erro desconhecido'}`);
    }
  }

  // Marca TODOS os lançamentos pendentes de um grupo/mês de uma vez.
  async function marcarGrupoPago(ids) {
    if (!ids.length) return;
    if (!confirm(`Marcar os ${ids.length} lançamento${ids.length > 1 ? 's' : ''} pendentes deste mês como pago${ids.length > 1 ? 's' : ''}?`))
      return;
    try {
      const { error } = await supabase.from('custos').update({ status_pagamento: 'pago' }).in('id', ids);
      if (error) throw error;
      await recarregar();
    } catch (err) {
      alert(`Não foi possível marcar o grupo como pago.\n\nMotivo: ${err.message || 'Erro desconhecido'}`);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <p className="text-sm text-ink-faint max-w-2xl">
          Lançamentos de <span className="text-brand font-semibold">{modo === 'safra' ? safraSelecionada?.nome : `${ano}`}</span>.
          Custos gerais da fazenda aparecem já rateados por área — igual ao cálculo atual, só com o selo{' '}
          <span className="text-tech inline-flex items-center gap-0.5"><Layers className="w-3 h-3" />rateio</span> pra ficar claro.
        </p>

        <button
          onClick={abrirNovo}
          className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-brand text-base font-semibold text-sm hover:bg-brand/90 transition-colors shrink-0"
        >
          <Plus className="w-4 h-4" /> Novo lançamento
        </button>
      </div>

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
          const pendentesDoGrupo = [...new Set(lista.filter((c) => c.status_pagamento !== 'pago').map((c) => c.id))];
          return (
            <HistoryAccordion
              key={mesKey}
              title={nomeMes}
              subtitle={`${lista.length} lançamento${lista.length > 1 ? 's' : ''}`}
              right={formatBRL(total)}
              defaultOpen={isRecente}
            >
              <div>
                {pendentesDoGrupo.length > 0 && (
                  <div className="flex justify-end pb-2.5 mb-2 border-b border-line-soft">
                    <button
                      onClick={() => marcarGrupoPago(pendentesDoGrupo)}
                      className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-brand/10 text-brand text-xs font-semibold hover:bg-brand/20 transition-colors"
                    >
                      <CheckCheck className="w-3.5 h-3.5" />
                      Marcar {pendentesDoGrupo.length} como pago{pendentesDoGrupo.length > 1 ? 's' : ''}
                    </button>
                  </div>
                )}
                {[...lista]
                  .sort((a, b) => (b.data || '').localeCompare(a.data || ''))
                  .map((c) => (
                    <LinhaLancamento key={c.id} c={c} onEditar={abrirEdicao} onExcluir={excluir} onMarcarPago={marcarPago} />
                  ))}
              </div>
            </HistoryAccordion>
          );
        })}

        {porMes.length === 0 && (
          <p className="text-sm text-ink-faint italic">Nenhum lançamento neste período.</p>
        )}
      </div>

      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title={editando ? 'Editar lançamento' : 'Novo lançamento'}
        description="Controle de entradas e saídas do financeiro."
      >
        <form onSubmit={salvar} className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-[11px] uppercase tracking-wide text-ink-faint font-semibold block mb-1">Tipo</label>
              <select
                value={form.tipo_lancamento}
                onChange={(e) => setForm((f) => ({ ...f, tipo_lancamento: e.target.value }))}
                className="w-full rounded-lg bg-base border border-line px-3 py-2 text-sm text-ink"
              >
                <option value="despesa">Despesa (Saída)</option>
                <option value="receita">Receita (Entrada)</option>
              </select>
            </div>
            <div>
              <label className="text-[11px] uppercase tracking-wide text-ink-faint font-semibold block mb-1">Status</label>
              <select
                value={form.status_pagamento}
                onChange={(e) => setForm((f) => ({ ...f, status_pagamento: e.target.value }))}
                className="w-full rounded-lg bg-base border border-line px-3 py-2 text-sm text-ink"
              >
                <option value="pago">Pago / Recebido</option>
                <option value="pendente">Pendente / Agendado</option>
              </select>
            </div>
          </div>

          <div>
            <label className="text-[11px] uppercase tracking-wide text-ink-faint font-semibold block mb-1">Descrição</label>
            <input
              value={form.descricao}
              onChange={(e) => setForm((f) => ({ ...f, descricao: e.target.value }))}
              placeholder="Ex: Adubo, Energia..."
              required
              className="w-full rounded-lg bg-base border border-line px-3 py-2 text-sm text-ink"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-[11px] uppercase tracking-wide text-ink-faint font-semibold block mb-1">Categoria</label>
              <select
                value={form.categoria}
                onChange={(e) => setForm((f) => ({ ...f, categoria: e.target.value }))}
                className="w-full rounded-lg bg-base border border-line px-3 py-2 text-sm text-ink"
              >
                {Object.entries(categoriaLabels).map(([key, { label }]) => (
                  <option key={key} value={key}>
                    {label}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-[11px] uppercase tracking-wide text-ink-faint font-semibold block mb-1">Valor (R$)</label>
              <input
                type="number"
                step="0.01"
                inputMode="decimal"
                value={form.valor}
                onChange={(e) => setForm((f) => ({ ...f, valor: e.target.value }))}
                placeholder="0,00"
                required
                className="w-full rounded-lg bg-base border border-line px-3 py-2 text-sm text-ink"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-[11px] uppercase tracking-wide text-ink-faint font-semibold block mb-1">Data</label>
              <input
                type="date"
                value={form.data}
                onChange={(e) => setForm((f) => ({ ...f, data: e.target.value }))}
                required
                className="w-full rounded-lg bg-base border border-line px-3 py-2 text-sm text-ink"
              />
            </div>
            <div>
              <label className="text-[11px] uppercase tracking-wide text-ink-faint font-semibold block mb-1">Talhão (opcional)</label>
              <select
                value={form.talhao_id}
                onChange={(e) => setForm((f) => ({ ...f, talhao_id: e.target.value }))}
                className="w-full rounded-lg bg-base border border-line px-3 py-2 text-sm text-ink"
              >
                <option value="">Custo Geral / Sede</option>
                {talhoes.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.nome}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className="text-[11px] uppercase tracking-wide text-ink-faint font-semibold block mb-1">Observações</label>
            <input
              value={form.observacoes}
              onChange={(e) => setForm((f) => ({ ...f, observacoes: e.target.value }))}
              placeholder="Detalhes opcionais..."
              className="w-full rounded-lg bg-base border border-line px-3 py-2 text-sm text-ink"
            />
          </div>

          {erro && (
            <div className="flex items-start gap-2 text-sm text-rose">
              <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{erro}</span>
            </div>
          )}

          <div className="flex justify-end gap-2.5 pt-2">
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="px-4 py-2.5 rounded-xl bg-line-soft text-ink text-sm font-medium hover:bg-line transition-colors"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={salvando}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-brand text-base font-semibold text-sm disabled:opacity-40 disabled:cursor-not-allowed hover:bg-brand/90 transition-colors"
            >
              {salvando && <Loader2 className="w-4 h-4 animate-spin" />}
              {salvando ? 'Salvando…' : 'Salvar'}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
