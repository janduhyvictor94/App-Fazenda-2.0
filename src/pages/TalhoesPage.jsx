import React, { useMemo, useState } from 'react';
import { MapPin, Sprout, Ruler, Plus, Edit, Trash2, Loader2, AlertTriangle, Settings } from 'lucide-react';
import { areaTotalFazenda, getAreaTalhao } from '../lib/data.js';
import { supabase } from '../lib/supabaseClient.js';
import Modal from '../components/Modal.jsx';

const STATUS_STYLE = {
  ativo: 'bg-brand/15 text-brand border-brand/25',
  produtivo: 'bg-brand/15 text-brand border-brand/25',
  formacao: 'bg-amber/15 text-amber border-amber/25',
  em_preparacao: 'bg-amber/15 text-amber border-amber/25',
  colheita: 'bg-tech/15 text-tech border-tech/25',
  repouso: 'bg-ink-muted/15 text-ink-muted border-line',
  inativo: 'bg-ink-muted/15 text-ink-muted border-line'
};

const STATUS_LABEL = {
  ativo: 'Ativo',
  em_preparacao: 'Em preparação',
  colheita: 'Em colheita',
  repouso: 'Repouso'
};

const inputCls = 'w-full rounded-lg bg-base border border-line px-3 py-2 text-sm text-ink';

function formVazio() {
  return {
    nome: '',
    area_hectares: '',
    cultura: '',
    variedade: '',
    data_plantio: '',
    status: 'ativo',
    observacoes: ''
  };
}

export default function TalhoesPage({ dados, recarregar }) {
  const { talhoes, safras, culturas = [] } = dados;
  const areaTotal = useMemo(() => areaTotalFazenda(talhoes), [talhoes]);

  const [open, setOpen] = useState(false);
  const [editando, setEditando] = useState(null);
  const [form, setForm] = useState(formVazio());
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState(null);

  const [openCulturaDialog, setOpenCulturaDialog] = useState(false);
  const [novaCultura, setNovaCultura] = useState('');
  const [salvandoCultura, setSalvandoCultura] = useState(false);

  const safraAtivaPorTalhao = useMemo(() => {
    const map = {};
    safras.forEach((s) => {
      if (s.status === 'ativo' || s.status === 'em_andamento') map[s.talhao_id] = s;
    });
    return map;
  }, [safras]);

  function abrirNova() {
    setEditando(null);
    setForm(formVazio());
    setErro(null);
    setOpen(true);
  }

  function abrirEdicao(t) {
    setEditando(t);
    setForm({
      nome: t.nome || '',
      area_hectares: t.area_hectares?.toString() || '',
      cultura: t.cultura || '',
      variedade: t.variedade || '',
      data_plantio: t.data_plantio || '',
      status: t.status || 'ativo',
      observacoes: t.observacoes || ''
    });
    setErro(null);
    setOpen(true);
  }

  async function salvar(e) {
    e.preventDefault();
    if (!form.nome.trim()) {
      setErro('Informe o nome do talhão.');
      return;
    }
    setSalvando(true);
    setErro(null);
    try {
      const payload = {
        nome: form.nome,
        area_hectares: form.area_hectares ? parseFloat(form.area_hectares) : null,
        cultura: form.cultura || null,
        variedade: form.variedade || null,
        data_plantio: form.data_plantio || null,
        status: form.status,
        observacoes: form.observacoes || null
      };
      if (editando) {
        const { error } = await supabase.from('talhoes').update(payload).eq('id', editando.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('talhoes').insert(payload);
        if (error) throw error;
      }
      setOpen(false);
      await recarregar();
    } catch (err) {
      setErro(err.message || 'Não foi possível salvar o talhão.');
    } finally {
      setSalvando(false);
    }
  }

  async function excluir(id) {
    if (!confirm('Excluir este talhão? Essa ação não pode ser desfeita.')) return;
    try {
      // O erro 409 ao excluir acontece porque outras tabelas referenciam este talhão
      // (custos, colheitas, atividades, pluviometria, metas, funcionários) via talhao_id,
      // e o banco bloqueia a exclusão para não deixar dados órfãos (chave estrangeira).
      // Solução: desvincular (talhao_id = null) esses registros antes de excluir o talhão.
      // O histórico é mantido — mesma regra da produção.
      const tabelasParaDesvincular = ['custos', 'colheitas', 'atividades', 'pluviometria', 'metas_talhoes', 'funcionarios'];
      for (const tabela of tabelasParaDesvincular) {
        const { error: errUnlink } = await supabase.from(tabela).update({ talhao_id: null }).eq('talhao_id', id);
        if (errUnlink) throw errUnlink;
      }

      // "safras" tem talhao_id NOT NULL (uma safra sempre pertence a um talhão), então não
      // dá para desvincular — como nenhuma outra tabela referencia safra_id, é seguro excluir
      // as safras daquele talhão junto com ele (mesma regra da produção).
      const { error: errSafras } = await supabase.from('safras').delete().eq('talhao_id', id);
      if (errSafras) throw errSafras;

      const { error } = await supabase.from('talhoes').delete().eq('id', id);
      if (error) throw error;

      await recarregar();
    } catch (err) {
      alert(`Não foi possível excluir o talhão.\n\nMotivo: ${err.message || 'Erro desconhecido'}`);
    }
  }

  async function adicionarCultura() {
    if (!novaCultura.trim()) return;
    setSalvandoCultura(true);
    try {
      const { error } = await supabase.from('culturas').insert({ nome: novaCultura.trim().toLowerCase() });
      if (error) throw error;
      setNovaCultura('');
      await recarregar();
    } catch (err) {
      alert(`Não foi possível cadastrar a cultura.\n\nMotivo: ${err.message || 'Erro desconhecido'}`);
    } finally {
      setSalvandoCultura(false);
    }
  }

  async function excluirCultura(id, nome) {
    if (
      !confirm(
        `Excluir a cultura "${nome}"? Talhões já cadastrados com ela não serão afetados, só deixa de aparecer na lista pra novos cadastros.`
      )
    )
      return;
    try {
      const { error } = await supabase.from('culturas').delete().eq('id', id);
      if (error) throw error;
      await recarregar();
    } catch (err) {
      alert(`Não foi possível excluir a cultura.\n\nMotivo: ${err.message || 'Erro desconhecido'}`);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-ink-faint max-w-lg">
          {talhoes.length} talhões cadastrados. A área de cada um é a mesma usada no cálculo de rateio das
          despesas gerais.
        </p>
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-2 text-sm font-semibold text-ink bg-surface border border-line rounded-xl px-3.5 py-2">
            <Ruler className="w-4 h-4 text-tech" />
            {areaTotal.toLocaleString('pt-BR')} ha no total
          </div>
          <button
            onClick={() => setOpenCulturaDialog(true)}
            className="inline-flex items-center gap-2 px-3.5 py-2.5 rounded-xl bg-surface border border-line text-ink-muted hover:text-ink text-sm font-medium transition-colors"
          >
            <Settings className="w-4 h-4" /> Culturas
          </button>
          <button
            onClick={abrirNova}
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-brand text-base font-semibold text-sm hover:bg-brand/90 transition-colors"
          >
            <Plus className="w-4 h-4" /> Novo talhão
          </button>
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
                    {STATUS_LABEL[t.status] || t.status}
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

              <div className="border-t border-line pt-3 flex items-center justify-between gap-2">
                <div className="flex items-center gap-2 text-sm min-w-0">
                  <Sprout className="w-3.5 h-3.5 text-brand shrink-0" />
                  {safraAtiva ? (
                    <span className="text-ink truncate">{safraAtiva.nome}</span>
                  ) : (
                    <span className="text-ink-faint italic">Sem safra ativa</span>
                  )}
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <button onClick={() => abrirEdicao(t)} className="p-1.5 text-ink-faint hover:text-ink transition-colors">
                    <Edit className="w-4 h-4" />
                  </button>
                  <button onClick={() => excluir(t.id)} className="p-1.5 text-ink-faint hover:text-rose transition-colors">
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {talhoes.length === 0 && <p className="text-sm text-ink-faint italic">Nenhum talhão cadastrado ainda.</p>}

      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title={editando ? 'Editar talhão' : 'Novo talhão'}
        description="Dados cadastrais da área produtiva."
      >
        <form onSubmit={salvar} className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-[11px] uppercase tracking-wide text-ink-faint font-semibold block mb-1">Nome/Código</label>
              <input
                value={form.nome}
                onChange={(e) => setForm((f) => ({ ...f, nome: e.target.value }))}
                placeholder="Ex: T-01"
                required
                className={inputCls}
              />
            </div>
            <div>
              <label className="text-[11px] uppercase tracking-wide text-ink-faint font-semibold block mb-1">Área (hectares)</label>
              <input
                type="number"
                step="0.01"
                value={form.area_hectares}
                onChange={(e) => setForm((f) => ({ ...f, area_hectares: e.target.value }))}
                placeholder="Ex: 10.5"
                className={inputCls}
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="text-[11px] uppercase tracking-wide text-ink-faint font-semibold">Cultura</label>
                <button
                  type="button"
                  onClick={() => setOpenCulturaDialog(true)}
                  className="text-[11px] font-semibold text-tech hover:underline"
                >
                  Gerenciar
                </button>
              </div>
              <select
                value={form.cultura}
                onChange={(e) => setForm((f) => ({ ...f, cultura: e.target.value }))}
                className={inputCls}
              >
                <option value="">Selecione…</option>
                {culturas.map((c) => (
                  <option key={c.id} value={c.nome}>
                    {c.nome.charAt(0).toUpperCase() + c.nome.slice(1)}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-[11px] uppercase tracking-wide text-ink-faint font-semibold block mb-1">Variedade</label>
              <input
                value={form.variedade}
                onChange={(e) => setForm((f) => ({ ...f, variedade: e.target.value }))}
                placeholder="Ex: Palmer, Paluma"
                className={inputCls}
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-[11px] uppercase tracking-wide text-ink-faint font-semibold block mb-1">Data de plantio</label>
              <input
                type="date"
                value={form.data_plantio}
                onChange={(e) => setForm((f) => ({ ...f, data_plantio: e.target.value }))}
                className={inputCls}
              />
            </div>
            <div>
              <label className="text-[11px] uppercase tracking-wide text-ink-faint font-semibold block mb-1">Status</label>
              <select
                value={form.status}
                onChange={(e) => setForm((f) => ({ ...f, status: e.target.value }))}
                className={inputCls}
              >
                <option value="ativo">Ativo</option>
                <option value="em_preparacao">Em preparação</option>
                <option value="colheita">Em colheita</option>
                <option value="repouso">Repouso</option>
              </select>
            </div>
          </div>

          <div>
            <label className="text-[11px] uppercase tracking-wide text-ink-faint font-semibold block mb-1">Observações</label>
            <textarea
              value={form.observacoes}
              onChange={(e) => setForm((f) => ({ ...f, observacoes: e.target.value }))}
              placeholder="Observações sobre o talhão..."
              rows={3}
              className={inputCls}
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

      <Modal
        open={openCulturaDialog}
        onClose={() => setOpenCulturaDialog(false)}
        title="Gerenciar culturas"
        description="Cadastre as culturas que a fazenda trabalha (manga, goiaba, uva, mamão, etc.)."
        maxWidth="max-w-md"
      >
        <div className="space-y-4">
          <div className="flex gap-2">
            <input
              value={novaCultura}
              onChange={(e) => setNovaCultura(e.target.value)}
              placeholder="Ex: Uva"
              className={inputCls}
            />
            <button
              onClick={adicionarCultura}
              disabled={!novaCultura.trim() || salvandoCultura}
              className="shrink-0 inline-flex items-center justify-center w-10 rounded-lg bg-brand text-base disabled:opacity-40 disabled:cursor-not-allowed hover:bg-brand/90 transition-colors"
            >
              {salvandoCultura ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
            </button>
          </div>
          <div className="rounded-xl border border-line divide-y divide-line-soft overflow-hidden">
            {culturas.length === 0 ? (
              <div className="p-4 text-center text-sm text-ink-faint italic">Nenhuma cultura cadastrada ainda.</div>
            ) : (
              culturas.map((c) => (
                <div key={c.id} className="flex items-center justify-between px-3.5 py-2.5 bg-surface">
                  <span className="text-sm font-medium text-ink capitalize">{c.nome}</span>
                  <button onClick={() => excluirCultura(c.id, c.nome)} className="p-1.5 text-ink-faint hover:text-rose transition-colors">
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))
            )}
          </div>
        </div>
      </Modal>
    </div>
  );
}
