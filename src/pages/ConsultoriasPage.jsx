import React, { useMemo, useState } from 'react';
import { FileText, CalendarClock, MapPin, Plus, Edit, Trash2, Loader2, AlertTriangle } from 'lucide-react';
import { usePeriodo } from '../context/PeriodoContext.jsx';
import HistoryAccordion from '../components/HistoryAccordion.jsx';
import Modal from '../components/Modal.jsx';
import { filtrarPorAno, filtrarPorSafra } from '../lib/data.js';
import { supabase } from '../lib/supabaseClient.js';

// Rótulos/cores de prioridade das indicações — mesmas três opções da
// produção (alta/media/baixa), só remapeadas pros tokens de cor da tela nova.
const PRIORIDADE_INFO = {
  alta: { label: 'Alta', className: 'bg-rose/10 text-rose' },
  media: { label: 'Média', className: 'bg-amber/10 text-amber' },
  baixa: { label: 'Baixa', className: 'bg-brand/10 text-brand' }
};

function formVazio() {
  return {
    consultor_nome: '',
    data_visita: new Date().toISOString().slice(0, 10),
    // Mantido por compatibilidade com o registro de produção (a tela de lá
    // também nunca oferece um campo pra editar isso diretamente — só
    // preserva o valor existente ao editar).
    talhoes_visitados: [],
    indicacoes: [],
    observacoes_gerais: '',
    proxima_visita: ''
  };
}

function indicacaoVazia() {
  return { talhao_id: '', talhao_nome: '', recomendacao: '', prioridade: 'media', prazo: '' };
}

export default function ConsultoriasPage({ dados, recarregar }) {
  const { modo, ano, safraSelecionada } = usePeriodo();
  const { talhoes, consultorias } = dados;
  const getTalhaoNome = (id) => talhoes.find((t) => String(t.id) === String(id))?.nome || id;

  const [open, setOpen] = useState(false);
  const [editando, setEditando] = useState(null);
  const [form, setForm] = useState(formVazio());
  const [novaIndicacao, setNovaIndicacao] = useState(indicacaoVazia());
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState(null);

  const escopo = useMemo(() => {
    const lista =
      modo === 'safra' && safraSelecionada
        ? filtrarPorSafra(consultorias, safraSelecionada, 'data_visita')
        : filtrarPorAno(consultorias, ano, 'data_visita');
    return [...lista].sort((a, b) => (b.data_visita || '').localeCompare(a.data_visita || ''));
  }, [modo, ano, safraSelecionada, consultorias]);

  const proximaVisita = consultorias
    .filter((c) => c.proxima_visita && c.proxima_visita >= new Date().toISOString().slice(0, 10))
    .sort((a, b) => (a.proxima_visita || '').localeCompare(b.proxima_visita || ''))[0];

  function abrirNova() {
    setEditando(null);
    setForm(formVazio());
    setNovaIndicacao(indicacaoVazia());
    setErro(null);
    setOpen(true);
  }

  function abrirEdicao(c) {
    setEditando(c);
    setForm({
      consultor_nome: c.consultor_nome || '',
      data_visita: c.data_visita || '',
      talhoes_visitados: c.talhoes_visitados || [],
      indicacoes: c.indicacoes || [],
      observacoes_gerais: c.observacoes_gerais || '',
      proxima_visita: c.proxima_visita || ''
    });
    setNovaIndicacao(indicacaoVazia());
    setErro(null);
    setOpen(true);
  }

  function addIndicacao() {
    if (!novaIndicacao.recomendacao) return;
    const talhao = talhoes.find((t) => t.id === novaIndicacao.talhao_id);
    const indicacao = { ...novaIndicacao, talhao_nome: talhao?.nome || 'Geral' };
    setForm((f) => ({ ...f, indicacoes: [...f.indicacoes, indicacao] }));
    setNovaIndicacao(indicacaoVazia());
  }

  function removeIndicacao(index) {
    setForm((f) => ({ ...f, indicacoes: f.indicacoes.filter((_, i) => i !== index) }));
  }

  async function salvar(e) {
    e.preventDefault();
    setSalvando(true);
    setErro(null);
    try {
      // Strings vazias em campos de data causam erro 400 no Supabase —
      // mesmo tratamento da produção: converte pra null.
      const payload = {
        consultor_nome: form.consultor_nome,
        data_visita: form.data_visita || null,
        proxima_visita: form.proxima_visita || null,
        talhoes_visitados: form.talhoes_visitados || [],
        indicacoes: form.indicacoes || [],
        observacoes_gerais: form.observacoes_gerais
      };
      if (editando) {
        const { error } = await supabase.from('consultorias').update(payload).eq('id', editando.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('consultorias').insert(payload);
        if (error) throw error;
      }
      setOpen(false);
      await recarregar();
    } catch (err) {
      setErro(err.message || 'Não foi possível salvar a consultoria.');
    } finally {
      setSalvando(false);
    }
  }

  async function excluir(id) {
    if (!confirm('Excluir este registro de consultoria? Essa ação não pode ser desfeita.')) return;
    try {
      const { error } = await supabase.from('consultorias').delete().eq('id', id);
      if (error) throw error;
      await recarregar();
    } catch (err) {
      alert(`Não foi possível excluir a consultoria.\n\nMotivo: ${err.message || 'Erro desconhecido'}`);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-ink-faint">
          Visitas técnicas de <span className="text-brand font-semibold">{modo === 'safra' ? safraSelecionada?.nome : `Ano ${ano}`}</span>.
        </p>

        <button
          onClick={abrirNova}
          className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-brand text-base font-semibold text-sm hover:bg-brand/90 transition-colors"
        >
          <Plus className="w-4 h-4" /> Nova consultoria
        </button>
      </div>

      {proximaVisita && (
        <div className="rounded-xl2 bg-tech/10 border border-tech/25 p-4 flex items-center gap-3">
          <CalendarClock className="w-5 h-5 text-tech shrink-0" />
          <div className="text-sm text-ink">
            Próxima visita agendada: <span className="font-semibold">{proximaVisita.proxima_visita}</span>
            {proximaVisita.consultor_nome ? ` · ${proximaVisita.consultor_nome}` : ''}
          </div>
        </div>
      )}

      <div className="space-y-3">
        {escopo.map((c) => (
          <div key={c.id} className="rounded-xl2 bg-surface border border-line p-4 space-y-2.5">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <FileText className="w-4 h-4 text-brand" />
                <h3 className="font-display font-semibold text-ink">{c.consultor_nome || 'Consultoria'}</h3>
              </div>
              <div className="flex items-center gap-3">
                <span className="text-xs text-ink-faint">{c.data_visita}</span>
                <div className="flex items-center gap-1">
                  <button onClick={() => abrirEdicao(c)} className="p-1.5 text-ink-faint hover:text-ink transition-colors">
                    <Edit className="w-4 h-4" />
                  </button>
                  <button onClick={() => excluir(c.id)} className="p-1.5 text-ink-faint hover:text-rose transition-colors">
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>
            {c.talhoes_visitados && c.talhoes_visitados.length > 0 && (
              <div className="flex items-center gap-1.5 text-xs text-ink-faint">
                <MapPin className="w-3 h-3" />
                {(Array.isArray(c.talhoes_visitados) ? c.talhoes_visitados : [c.talhoes_visitados])
                  .map(getTalhaoNome)
                  .join(', ')}
              </div>
            )}
            {c.observacoes_gerais && (
              <div className="text-sm text-ink border-t border-line pt-2">
                <span className="text-ink-faint text-xs block mb-0.5">Observações gerais</span>
                {c.observacoes_gerais}
              </div>
            )}
            {Array.isArray(c.indicacoes) && c.indicacoes.length > 0 && (
              <div className="space-y-2 border-t border-line pt-2">
                <span className="text-ink-faint text-xs block">Indicações e recomendações</span>
                {c.indicacoes.map((ind, idx) => (
                  <div key={idx} className="rounded-lg bg-base/60 border border-line-soft p-2.5 text-sm">
                    <div className="flex items-center justify-between gap-2 mb-1">
                      <span className="font-medium text-ink">{ind.talhao_nome || 'Geral'}</span>
                      {ind.prioridade && (
                        <span className={`text-[10px] uppercase tracking-wide font-semibold px-2 py-0.5 rounded-full ${PRIORIDADE_INFO[ind.prioridade]?.className || 'bg-line-soft text-ink-faint'}`}>
                          {PRIORIDADE_INFO[ind.prioridade]?.label || ind.prioridade}
                        </span>
                      )}
                    </div>
                    <p className="text-ink-muted">{ind.recomendacao}</p>
                    {ind.prazo && <p className="text-xs text-ink-faint mt-1">Prazo: {ind.prazo}</p>}
                  </div>
                ))}
              </div>
            )}
          </div>
        ))}
        {escopo.length === 0 && <p className="text-sm text-ink-faint italic">Nenhuma consultoria neste período.</p>}
      </div>

      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title={editando ? 'Editar consultoria' : 'Nova consultoria'}
        description="Registro de visita técnica e recomendações para os talhões."
      >
        <form onSubmit={salvar} className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-[11px] uppercase tracking-wide text-ink-faint font-semibold block mb-1">Nome do consultor</label>
              <input
                value={form.consultor_nome}
                onChange={(e) => setForm((f) => ({ ...f, consultor_nome: e.target.value }))}
                placeholder="Nome do consultor"
                required
                className="w-full rounded-lg bg-base border border-line px-3 py-2 text-sm text-ink"
              />
            </div>
            <div>
              <label className="text-[11px] uppercase tracking-wide text-ink-faint font-semibold block mb-1">Data da visita</label>
              <input
                type="date"
                value={form.data_visita}
                onChange={(e) => setForm((f) => ({ ...f, data_visita: e.target.value }))}
                required
                className="w-full rounded-lg bg-base border border-line px-3 py-2 text-sm text-ink"
              />
            </div>
          </div>

          <div>
            <label className="text-[11px] uppercase tracking-wide text-ink-faint font-semibold block mb-1">Próxima visita (opcional)</label>
            <input
              type="date"
              value={form.proxima_visita}
              onChange={(e) => setForm((f) => ({ ...f, proxima_visita: e.target.value }))}
              className="w-full rounded-lg bg-base border border-line px-3 py-2 text-sm text-ink"
            />
          </div>

          <div>
            <label className="text-[11px] uppercase tracking-wide text-ink-faint font-semibold block mb-1">Observações gerais</label>
            <textarea
              value={form.observacoes_gerais}
              onChange={(e) => setForm((f) => ({ ...f, observacoes_gerais: e.target.value }))}
              placeholder="Observações gerais da visita…"
              rows={3}
              className="w-full rounded-lg bg-base border border-line px-3 py-2 text-sm text-ink"
            />
          </div>

          <div className="rounded-xl2 bg-base/60 border border-line-soft p-3.5 space-y-3">
            <label className="text-[11px] uppercase tracking-wide text-ink-faint font-semibold block">Indicações e recomendações</label>

            <div className="grid grid-cols-2 gap-2.5">
              <select
                value={novaIndicacao.talhao_id}
                onChange={(e) => setNovaIndicacao((n) => ({ ...n, talhao_id: e.target.value }))}
                className="w-full rounded-lg bg-base border border-line px-3 py-2 text-sm text-ink"
              >
                <option value="">Geral (sem talhão)</option>
                {talhoes.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.nome}
                  </option>
                ))}
              </select>
              <select
                value={novaIndicacao.prioridade}
                onChange={(e) => setNovaIndicacao((n) => ({ ...n, prioridade: e.target.value }))}
                className="w-full rounded-lg bg-base border border-line px-3 py-2 text-sm text-ink"
              >
                <option value="alta">Alta</option>
                <option value="media">Média</option>
                <option value="baixa">Baixa</option>
              </select>
            </div>

            <textarea
              value={novaIndicacao.recomendacao}
              onChange={(e) => setNovaIndicacao((n) => ({ ...n, recomendacao: e.target.value }))}
              placeholder="Descreva a recomendação…"
              rows={2}
              className="w-full rounded-lg bg-base border border-line px-3 py-2 text-sm text-ink"
            />

            <div className="flex gap-2.5">
              <input
                value={novaIndicacao.prazo}
                onChange={(e) => setNovaIndicacao((n) => ({ ...n, prazo: e.target.value }))}
                placeholder="Prazo (ex: 7 dias, até 15/01)"
                className="flex-1 rounded-lg bg-base border border-line px-3 py-2 text-sm text-ink"
              />
              <button
                type="button"
                onClick={addIndicacao}
                disabled={!novaIndicacao.recomendacao}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-line-soft text-ink text-sm font-medium hover:bg-line transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
              >
                <Plus className="w-3.5 h-3.5" /> Adicionar
              </button>
            </div>

            {form.indicacoes.length > 0 && (
              <div className="space-y-2 pt-1">
                {form.indicacoes.map((ind, index) => (
                  <div key={index} className="flex items-start justify-between gap-2 p-2.5 rounded-lg bg-surface-raised border border-line-soft">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-sm font-medium text-ink">{ind.talhao_nome || 'Geral'}</span>
                        <span className={`text-[10px] uppercase tracking-wide font-semibold px-2 py-0.5 rounded-full ${PRIORIDADE_INFO[ind.prioridade]?.className || 'bg-line-soft text-ink-faint'}`}>
                          {PRIORIDADE_INFO[ind.prioridade]?.label || ind.prioridade}
                        </span>
                      </div>
                      <p className="text-sm text-ink-muted">{ind.recomendacao}</p>
                      {ind.prazo && <p className="text-xs text-ink-faint mt-1">Prazo: {ind.prazo}</p>}
                    </div>
                    <button
                      type="button"
                      onClick={() => removeIndicacao(index)}
                      className="p-1.5 text-ink-faint hover:text-rose transition-colors shrink-0"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                ))}
              </div>
            )}
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
              {salvando ? 'Salvando…' : editando ? 'Salvar' : 'Registrar'}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
