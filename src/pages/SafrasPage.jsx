import React, { useMemo, useState } from 'react';
import { Sprout, MapPin, Calendar, Plus, Edit, Trash2, Loader2, AlertTriangle } from 'lucide-react';
import HistoryAccordion from '../components/HistoryAccordion.jsx';
import Modal from '../components/Modal.jsx';
import { supabase } from '../lib/supabaseClient.js';
import { custosDaSafra, colheitasDaSafra, totaisFinanceiros, receitaColheitas } from '../lib/data.js';
import { formatBRL } from '../lib/format.js';

function SafraCard({ safra, talhao, allTalhoes, colheitas, custos, destaque, onEditar, onExcluir }) {
  // Importante: o rateio usa a ÁREA TOTAL DA FAZENDA (todos os talhões), não
  // só a área deste talhão — por isso allTalhoes precisa ser a lista completa,
  // exatamente como a Dashboard atual calcula.
  const custosEscopo = custosDaSafra({ custos, safra, talhoes: allTalhoes });
  const custosDiretos = custosEscopo.filter((c) => !c.isRateio);
  const custosRateio = custosEscopo.filter((c) => c.isRateio);
  const { despesasPagas } = totaisFinanceiros(custosEscopo);
  const receita = receitaColheitas(colheitas);

  return (
    <div
      className={`rounded-xl2 border p-5 space-y-4 ${
        destaque ? 'bg-brand/8 border-brand/30' : 'bg-surface border-line'
      }`}
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <Sprout className={`w-4 h-4 ${destaque ? 'text-brand' : 'text-ink-faint'}`} />
            <h3 className="font-display font-semibold text-ink">{safra.nome}</h3>
            {destaque && (
              <span className="text-[10px] uppercase tracking-wide bg-brand/20 text-brand px-2 py-0.5 rounded-full font-semibold">
                ativa
              </span>
            )}
          </div>
          <div className="flex items-center gap-3 text-xs text-ink-faint mt-1.5">
            <span className="flex items-center gap-1"><MapPin className="w-3 h-3" />{talhao?.nome || 'Talhão removido'}</span>
            <span className="flex items-center gap-1">
              <Calendar className="w-3 h-3" />
              {safra.data_inicio || '—'} → {safra.data_fim || 'em andamento'}
            </span>
          </div>
        </div>
        <div className="flex items-center gap-1 shrink-0">
          <button onClick={() => onEditar(safra)} className="p-1.5 text-ink-faint hover:text-ink transition-colors">
            <Edit className="w-4 h-4" />
          </button>
          <button onClick={() => onExcluir(safra.id)} className="p-1.5 text-ink-faint hover:text-rose transition-colors">
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-3 text-sm">
        <div>
          <div className="text-ink-faint text-xs mb-0.5">Receita</div>
          <div className="font-semibold text-brand tabular">{formatBRL(receita)}</div>
        </div>
        <div>
          <div className="text-ink-faint text-xs mb-0.5">Custos (direto + rateio)</div>
          <div className="font-semibold text-rose tabular">{formatBRL(despesasPagas)}</div>
        </div>
        <div>
          <div className="text-ink-faint text-xs mb-0.5">Resultado</div>
          <div className="font-semibold tabular">{formatBRL(receita - despesasPagas)}</div>
        </div>
      </div>

      <div className="flex items-center gap-4 text-xs text-ink-faint border-t border-line pt-3">
        <span>{custosDiretos.length} lançamentos diretos do talhão</span>
        <span className="w-1 h-1 rounded-full bg-ink-faint/40" />
        <span>{custosRateio.length} custos gerais rateados por área</span>
      </div>
    </div>
  );
}

function formVazio() {
  return {
    nome: '',
    talhao_id: '',
    data_inicio: new Date().toISOString().slice(0, 10),
    data_fim: '',
    status: 'ativo'
  };
}

export default function SafrasPage({ dados, recarregar }) {
  const { talhoes, safras, colheitas, custos } = dados;

  const [open, setOpen] = useState(false);
  const [editando, setEditando] = useState(null);
  const [form, setForm] = useState(formVazio());
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState(null);

  const porTalhao = useMemo(() => {
    const map = {};
    safras.forEach((s) => {
      const key = s.talhao_id || 'sem-talhao';
      if (!map[key]) map[key] = [];
      map[key].push(s);
    });
    return map;
  }, [safras]);

  function abrirNova() {
    setEditando(null);
    setForm(formVazio());
    setErro(null);
    setOpen(true);
  }

  function abrirEdicao(safra) {
    setEditando(safra);
    setForm({
      nome: safra.nome || '',
      talhao_id: safra.talhao_id || '',
      data_inicio: safra.data_inicio || '',
      data_fim: safra.data_fim || '',
      status: safra.status || 'ativo'
    });
    setErro(null);
    setOpen(true);
  }

  async function salvar(e) {
    e.preventDefault();
    if (!form.nome.trim()) {
      setErro('Informe a identificação da safra.');
      return;
    }
    if (!form.talhao_id) {
      setErro('Selecione um talhão.');
      return;
    }
    if (!form.data_inicio) {
      setErro('Informe a data de início.');
      return;
    }
    setSalvando(true);
    setErro(null);
    try {
      const payload = {
        nome: form.nome.trim(),
        talhao_id: form.talhao_id,
        data_inicio: form.data_inicio,
        data_fim: form.data_fim || null,
        status: form.status
      };
      if (editando) {
        const { error } = await supabase.from('safras').update(payload).eq('id', editando.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('safras').insert([payload]);
        if (error) throw error;
      }
      setOpen(false);
      await recarregar();
    } catch (err) {
      setErro(err.message || 'Não foi possível salvar a safra.');
    } finally {
      setSalvando(false);
    }
  }

  async function excluir(id) {
    if (!confirm('Excluir esta safra? Essa ação não pode ser desfeita.')) return;
    try {
      const { error } = await supabase.from('safras').delete().eq('id', id);
      if (error) throw error;
      await recarregar();
    } catch (err) {
      alert(`Não foi possível excluir a safra.\n\nMotivo: ${err.message || 'Erro desconhecido'}`);
    }
  }

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <p className="text-sm text-ink-faint max-w-2xl">
          Cada talhão mostra a safra ativa em destaque. O histórico de safras concluídas fica recolhido — os valores
          e o rateio de cada uma continuam exatamente como foram lançados.
        </p>
        <button
          onClick={abrirNova}
          className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-brand text-base font-semibold text-sm hover:bg-brand/90 transition-colors shrink-0"
        >
          <Plus className="w-4 h-4" /> Nova safra
        </button>
      </div>

      {Object.entries(porTalhao).map(([talhaoId, lista]) => {
        const talhao = talhoes.find((t) => String(t.id) === String(talhaoId));
        const ordenadas = [...lista].sort((a, b) => (b.data_inicio || '').localeCompare(a.data_inicio || ''));
        const ativa = ordenadas.find((s) => s.status === 'ativo' || s.status === 'em_andamento');
        const historico = ordenadas.filter((s) => s.id !== ativa?.id);

        return (
          <div key={talhaoId} className="space-y-3">
            <h2 className="font-display font-semibold text-ink flex items-center gap-2">
              <MapPin className="w-4 h-4 text-ink-faint" />
              {talhao?.nome || 'Talhão sem nome'}
              {talhao?.area_hectares && (
                <span className="text-xs text-ink-faint font-normal">· {talhao.area_hectares} ha</span>
              )}
            </h2>

            {ativa && (
              <SafraCard
                safra={ativa}
                talhao={talhao}
                allTalhoes={talhoes}
                colheitas={colheitasDaSafra({ colheitas, safra: ativa })}
                custos={custos}
                destaque
                onEditar={abrirEdicao}
                onExcluir={excluir}
              />
            )}

            {historico.length > 0 && (
              <HistoryAccordion
                title={`Histórico — ${historico.length} safra${historico.length > 1 ? 's' : ''} concluída${historico.length > 1 ? 's' : ''}`}
                subtitle="Recolhido por padrão · nada foi alterado"
              >
                <div className="space-y-3">
                  {historico.map((s) => (
                    <SafraCard
                      key={s.id}
                      safra={s}
                      talhao={talhao}
                      allTalhoes={talhoes}
                      colheitas={colheitasDaSafra({ colheitas, safra: s })}
                      custos={custos}
                      onEditar={abrirEdicao}
                      onExcluir={excluir}
                    />
                  ))}
                </div>
              </HistoryAccordion>
            )}

            {!ativa && historico.length === 0 && (
              <p className="text-sm text-ink-faint italic">Nenhuma safra registrada ainda para este talhão.</p>
            )}
          </div>
        );
      })}

      {safras.length === 0 && (
        <p className="text-sm text-ink-faint italic">Nenhuma safra encontrada no banco de dados.</p>
      )}

      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title={editando ? 'Editar safra' : 'Nova safra'}
        description="Identificação, talhão e período do ciclo produtivo."
      >
        <form onSubmit={salvar} className="space-y-4">
          <div>
            <label className="text-[11px] uppercase tracking-wide text-ink-faint font-semibold block mb-1">Identificação</label>
            <input
              value={form.nome}
              onChange={(e) => setForm((f) => ({ ...f, nome: e.target.value }))}
              placeholder="Ex: Manga Palmer 2025/2026"
              required
              className="w-full rounded-lg bg-base border border-line px-3 py-2 text-sm text-ink"
            />
          </div>
          <div>
            <label className="text-[11px] uppercase tracking-wide text-ink-faint font-semibold block mb-1">Talhão</label>
            <select
              value={form.talhao_id}
              onChange={(e) => setForm((f) => ({ ...f, talhao_id: e.target.value }))}
              required
              className="w-full rounded-lg bg-base border border-line px-3 py-2 text-sm text-ink"
            >
              <option value="">Selecione…</option>
              {talhoes.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.nome}
                </option>
              ))}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-[11px] uppercase tracking-wide text-ink-faint font-semibold block mb-1">Início</label>
              <input
                type="date"
                value={form.data_inicio}
                onChange={(e) => setForm((f) => ({ ...f, data_inicio: e.target.value }))}
                required
                className="w-full rounded-lg bg-base border border-line px-3 py-2 text-sm text-ink"
              />
            </div>
            <div>
              <label className="text-[11px] uppercase tracking-wide text-ink-faint font-semibold block mb-1">Fim (opcional)</label>
              <input
                type="date"
                value={form.data_fim}
                onChange={(e) => setForm((f) => ({ ...f, data_fim: e.target.value }))}
                className="w-full rounded-lg bg-base border border-line px-3 py-2 text-sm text-ink"
              />
            </div>
          </div>
          <div>
            <label className="text-[11px] uppercase tracking-wide text-ink-faint font-semibold block mb-1">Status</label>
            <select
              value={form.status}
              onChange={(e) => setForm((f) => ({ ...f, status: e.target.value }))}
              className="w-full rounded-lg bg-base border border-line px-3 py-2 text-sm text-ink"
            >
              <option value="ativo">Ativo</option>
              <option value="concluido">Concluído</option>
            </select>
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
