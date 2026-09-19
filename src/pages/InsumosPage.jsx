import React, { useMemo, useState } from 'react';
import { Package, AlertTriangle, Plus, Edit, Trash2, Loader2, Info, Search } from 'lucide-react';
import KpiCard from '../components/KpiCard.jsx';
import Modal from '../components/Modal.jsx';
import { supabase } from '../lib/supabaseClient.js';
import { parseNumber } from '../lib/data.js';
import { formatBRL } from '../lib/format.js';

// Mesmas categorias e rótulos da produção (Insumos.jsx) — só o visual muda.
const CATEGORIA_LABELS = {
  fertilizante: 'Fertilizante',
  defensivo: 'Defensivo',
  adubo: 'Adubo',
  semente: 'Semente',
  outro: 'Outro'
};

const UNIDADE_OPTIONS = [
  { value: 'kg', label: 'Quilograma (kg)' },
  { value: 'L', label: 'Litro (L)' },
  { value: 'un', label: 'Unidade (un)' },
  { value: 'sc', label: 'Saca (sc)' }
];

function formVazio() {
  return {
    nome: '',
    categoria: 'outro',
    unidade: 'kg',
    preco_unitario: '',
    tamanho_embalagem: '',
    estoque_atual: '',
    estoque_minimo: '',
    fornecedor: '',
    observacoes: ''
  };
}

export default function InsumosPage({ dados, recarregar }) {
  const { insumos } = dados;

  const [busca, setBusca] = useState('');
  const [open, setOpen] = useState(false);
  const [editando, setEditando] = useState(null);
  const [form, setForm] = useState(formVazio());
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState(null);

  const baixoEstoque = useMemo(
    () => insumos.filter((i) => Number(i.estoque_atual) <= Number(i.estoque_minimo || 0)),
    [insumos]
  );

  // Mesmo alerta da produção: insumos sem "tamanho_embalagem" fazem o app
  // assumir 1 embalagem = 1 unidade ao calcular custo por uso (Assistente IA
  // e Atividades usam esse campo pra ratear o preço da embalagem inteira).
  const insumosSemEmbalagem = useMemo(() => insumos.filter((i) => !i.tamanho_embalagem), [insumos]);

  const insumosFiltrados = useMemo(
    () =>
      insumos.filter(
        (i) =>
          (i.nome || '').toLowerCase().includes(busca.toLowerCase()) ||
          (i.categoria || '').toLowerCase().includes(busca.toLowerCase())
      ),
    [insumos, busca]
  );

  function abrirNovo() {
    setEditando(null);
    setForm(formVazio());
    setErro(null);
    setOpen(true);
  }

  function abrirEdicao(insumo) {
    setEditando(insumo);
    setForm({
      nome: insumo.nome || '',
      categoria: insumo.categoria || 'outro',
      unidade: insumo.unidade || 'kg',
      preco_unitario: insumo.preco_unitario ?? '',
      tamanho_embalagem: insumo.tamanho_embalagem ?? '',
      estoque_atual: insumo.estoque_atual ?? '',
      estoque_minimo: insumo.estoque_minimo ?? '',
      fornecedor: insumo.fornecedor || '',
      observacoes: insumo.observacoes || ''
    });
    setErro(null);
    setOpen(true);
  }

  async function salvar(e) {
    e.preventDefault();
    if (!form.nome.trim()) {
      setErro('Informe o nome do produto.');
      return;
    }
    if (form.estoque_atual === '') {
      setErro('Informe o estoque atual.');
      return;
    }
    setSalvando(true);
    setErro(null);
    try {
      const dadosCompletos = {
        nome: form.nome,
        categoria: form.categoria,
        unidade: form.unidade,
        preco_unitario: parseNumber(form.preco_unitario) || 0,
        tamanho_embalagem: form.tamanho_embalagem ? parseNumber(form.tamanho_embalagem) : null,
        estoque_atual: parseNumber(form.estoque_atual) || 0,
        estoque_minimo: form.estoque_minimo ? parseNumber(form.estoque_minimo) : null,
        fornecedor: form.fornecedor,
        observacoes: form.observacoes
      };
      // Mesma regra da produção: remove campos vazios (string vazia) antes de
      // gravar, pra não sobrescrever um valor já salvo com "" num update.
      const payload = Object.fromEntries(
        Object.entries(dadosCompletos).filter(([, v]) => v !== undefined && v !== '')
      );

      if (editando) {
        const { error } = await supabase.from('insumos').update(payload).eq('id', editando.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('insumos').insert([payload]);
        if (error) throw error;
      }
      setOpen(false);
      await recarregar();
    } catch (err) {
      setErro(err.message || 'Não foi possível salvar o insumo.');
    } finally {
      setSalvando(false);
    }
  }

  async function excluir(id) {
    if (!confirm('Remover este insumo do estoque? Essa ação não pode ser desfeita.')) return;
    try {
      const { error } = await supabase.from('insumos').delete().eq('id', id);
      if (error) throw error;
      await recarregar();
    } catch (err) {
      alert(`Não foi possível excluir o insumo.\n\nMotivo: ${err.message || 'Erro desconhecido'}`);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-ink-faint max-w-md">
          Catálogo de insumos — não muda com o período selecionado, é o estoque de agora.
        </p>

        <div className="flex items-center gap-2">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-ink-faint" />
            <input
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              placeholder="Buscar insumo..."
              className="rounded-lg bg-base border border-line pl-8 pr-3 py-2 text-sm text-ink w-40 sm:w-56"
            />
          </div>
          <button
            onClick={abrirNovo}
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-brand text-base font-semibold text-sm hover:bg-brand/90 transition-colors shrink-0"
          >
            <Plus className="w-4 h-4" /> Novo Insumo
          </button>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:gap-4 max-w-md">
        <KpiCard label="Itens cadastrados" value={String(insumos.length)} icon={Package} tone="brand" />
        <KpiCard
          label="Estoque baixo"
          value={String(baixoEstoque.length)}
          icon={AlertTriangle}
          tone={baixoEstoque.length > 0 ? 'amber' : 'neutral'}
        />
      </div>

      {insumosSemEmbalagem.length > 0 && (
        <div className="rounded-xl2 bg-amber/10 border border-amber/25 p-4 space-y-2">
          <div className="flex items-center gap-2 font-semibold text-amber text-sm">
            <Info className="w-4 h-4 shrink-0" />
            {insumosSemEmbalagem.length} insumo{insumosSemEmbalagem.length > 1 ? 's' : ''} sem "Quantidade por
            Embalagem" informada
          </div>
          <p className="text-xs text-ink-faint">
            Sem isso, o app assume que cada embalagem já é 1 {insumosSemEmbalagem[0]?.unidade || 'unidade'} ao
            calcular custo de uso em atividades e no Assistente IA — o que pode estar errado se você compra em
            sacos/embalagens maiores. Edite cada um abaixo pra corrigir:
          </p>
          <div className="flex flex-wrap gap-2 pt-1">
            {insumosSemEmbalagem.map((i) => (
              <button
                key={i.id}
                onClick={() => abrirEdicao(i)}
                className="text-xs font-semibold bg-surface border border-amber/25 text-amber px-3 py-1.5 rounded-lg hover:bg-amber/10 transition-colors"
              >
                {i.nome}
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {insumosFiltrados.map((i) => {
          const precoPorUnidade =
            i.tamanho_embalagem && Number(i.tamanho_embalagem) > 0
              ? Number(i.preco_unitario) / Number(i.tamanho_embalagem)
              : null;
          const baixo = Number(i.estoque_atual) <= Number(i.estoque_minimo || 0);
          return (
            <div key={i.id} className="rounded-xl2 bg-surface border border-line p-4 space-y-3">
              <div className="flex items-start justify-between gap-2">
                <h3 className="font-display font-semibold text-ink truncate">{i.nome}</h3>
                <div className="flex items-center gap-1 shrink-0">
                  {baixo && (
                    <span className="text-[10px] uppercase tracking-wide px-2 py-0.5 rounded-full border border-amber/25 bg-amber/15 text-amber font-semibold">
                      repor
                    </span>
                  )}
                  <button onClick={() => abrirEdicao(i)} className="p-1 text-ink-faint hover:text-ink transition-colors">
                    <Edit className="w-3.5 h-3.5" />
                  </button>
                  <button onClick={() => excluir(i.id)} className="p-1 text-ink-faint hover:text-rose transition-colors">
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
              {i.categoria && <div className="text-xs text-ink-faint capitalize">{i.categoria}</div>}
              <div className="flex items-center justify-between text-sm">
                <span className="text-ink-faint">Estoque</span>
                <span className="font-semibold tabular text-ink">
                  {i.estoque_atual} {i.unidade}
                </span>
              </div>
              {precoPorUnidade != null ? (
                <div className="flex items-center justify-between text-sm">
                  <span className="text-ink-faint">Preço/{i.unidade}</span>
                  <span className="font-semibold tabular text-tech">{formatBRL(precoPorUnidade)}</span>
                </div>
              ) : (
                <div className="flex items-center justify-between text-sm">
                  <span className="text-ink-faint">Preço/{i.unidade}</span>
                  <span className="text-xs font-bold text-amber">falta embalagem</span>
                </div>
              )}
              {i.fornecedor && <div className="text-xs text-ink-faint border-t border-line pt-2">Fornecedor: {i.fornecedor}</div>}
            </div>
          );
        })}
      </div>

      {insumos.length === 0 && <p className="text-sm text-ink-faint italic">Nenhum insumo cadastrado ainda.</p>}
      {insumos.length > 0 && insumosFiltrados.length === 0 && (
        <p className="text-sm text-ink-faint italic">Nenhum insumo encontrado para "{busca}".</p>
      )}

      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title={editando ? 'Editar Insumo' : 'Cadastrar Novo Insumo'}
        description="Gestão de estoque para planejamento de atividades."
      >
        <form onSubmit={salvar} className="space-y-4">
          <div>
            <label className="text-[11px] uppercase tracking-wide text-ink-faint font-semibold block mb-1">
              Nome do Produto
            </label>
            <input
              value={form.nome}
              onChange={(e) => setForm((f) => ({ ...f, nome: e.target.value }))}
              placeholder="Ex: Glifosato 480"
              required
              className="w-full rounded-lg bg-base border border-line px-3 py-2 text-sm text-ink"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-[11px] uppercase tracking-wide text-ink-faint font-semibold block mb-1">
                Categoria
              </label>
              <select
                value={form.categoria}
                onChange={(e) => setForm((f) => ({ ...f, categoria: e.target.value }))}
                className="w-full rounded-lg bg-base border border-line px-3 py-2 text-sm text-ink"
              >
                {Object.entries(CATEGORIA_LABELS).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-[11px] uppercase tracking-wide text-ink-faint font-semibold block mb-1">
                Unidade de Medida
              </label>
              <select
                value={form.unidade}
                onChange={(e) => setForm((f) => ({ ...f, unidade: e.target.value }))}
                className="w-full rounded-lg bg-base border border-line px-3 py-2 text-sm text-ink"
              >
                {UNIDADE_OPTIONS.map((u) => (
                  <option key={u.value} value={u.value}>
                    {u.label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="text-[11px] uppercase tracking-wide text-ink-faint font-semibold block mb-1">
                Estoque Atual
              </label>
              <input
                type="number"
                step="0.01"
                inputMode="decimal"
                value={form.estoque_atual}
                onChange={(e) => setForm((f) => ({ ...f, estoque_atual: e.target.value }))}
                required
                className="w-full rounded-lg bg-base border border-line px-3 py-2 text-sm text-ink"
              />
            </div>
            <div>
              <label className="text-[11px] uppercase tracking-wide text-ink-faint font-semibold block mb-1">
                Estoque Mínimo
              </label>
              <input
                type="number"
                step="0.01"
                inputMode="decimal"
                value={form.estoque_minimo}
                onChange={(e) => setForm((f) => ({ ...f, estoque_minimo: e.target.value }))}
                className="w-full rounded-lg bg-base border border-line px-3 py-2 text-sm text-ink"
              />
            </div>
            <div>
              <label className="text-[11px] uppercase tracking-wide text-ink-faint font-semibold block mb-1">
                Preço da Embalagem (R$)
              </label>
              <input
                type="number"
                step="0.01"
                inputMode="decimal"
                value={form.preco_unitario}
                onChange={(e) => setForm((f) => ({ ...f, preco_unitario: e.target.value }))}
                placeholder="0,00"
                className="w-full rounded-lg bg-base border border-line px-3 py-2 text-sm text-ink"
              />
            </div>
          </div>

          <div className="space-y-2 p-3 bg-base rounded-xl border border-line">
            <label className="text-[11px] uppercase tracking-wide text-ink-faint font-semibold block">
              Quantidade por Embalagem{' '}
              <span className="normal-case font-normal text-ink-faint">
                (quantos {form.unidade} vêm em cada embalagem comprada)
              </span>
            </label>
            <input
              type="number"
              step="0.01"
              inputMode="decimal"
              value={form.tamanho_embalagem}
              onChange={(e) => setForm((f) => ({ ...f, tamanho_embalagem: e.target.value }))}
              placeholder={`Ex: 50 (para um saco de 50${form.unidade})`}
              className="w-full rounded-lg bg-surface border border-line px-3 py-2 text-sm text-ink"
            />
            {form.preco_unitario && form.tamanho_embalagem && parseNumber(form.tamanho_embalagem) > 0 ? (
              <p className="text-xs font-bold text-tech">
                ≈ {formatBRL(parseNumber(form.preco_unitario) / parseNumber(form.tamanho_embalagem))} por{' '}
                {form.unidade}
              </p>
            ) : (
              <p className="text-[11px] text-ink-faint">
                Deixe em branco se cada embalagem já é 1 {form.unidade} (ex: 1 saco = 1 unidade sem fracionar).
              </p>
            )}
          </div>

          <div>
            <label className="text-[11px] uppercase tracking-wide text-ink-faint font-semibold block mb-1">
              Fornecedor
            </label>
            <input
              value={form.fornecedor}
              onChange={(e) => setForm((f) => ({ ...f, fornecedor: e.target.value }))}
              placeholder="Empresa/Vendedor"
              className="w-full rounded-lg bg-base border border-line px-3 py-2 text-sm text-ink"
            />
          </div>

          <div>
            <label className="text-[11px] uppercase tracking-wide text-ink-faint font-semibold block mb-1">
              Observações
            </label>
            <textarea
              value={form.observacoes}
              onChange={(e) => setForm((f) => ({ ...f, observacoes: e.target.value }))}
              placeholder="Detalhes..."
              rows={2}
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
              {salvando ? 'Salvando…' : editando ? 'Salvar' : 'Cadastrar'}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
