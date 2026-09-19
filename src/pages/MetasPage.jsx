import React, { useMemo, useState } from 'react';
import { Plus, Target, Edit, Trash2, Loader2, AlertTriangle, CalendarRange } from 'lucide-react';
import { isWithinInterval } from 'date-fns';
import Modal from '../components/Modal.jsx';
import { salvarMeta, excluirMeta, parseNumber } from '../lib/data.js';
import { formatBRL } from '../lib/format.js';

const STATUS_OK = 'ok';
const STATUS_CUSTO_ALTO = 'acima_meta';
const STATUS_PROD_BAIXA = 'abaixo_meta';

// Meio-dia fixo — mesmo truque de produção pra evitar o fuso jogar a data
// de início/fim do ciclo pro dia anterior.
const addOneDay = (dateStr) => (dateStr ? new Date(dateStr + 'T12:00:00') : null);

function formVazio(anoAtualStr) {
  return {
    ano: anoAtualStr,
    talhao_id: '',
    data_inicio_ciclo: new Date().toISOString().slice(0, 10),
    data_fim_ciclo: '',
    meta_custo_por_ha: '',
    meta_producao_ton_por_ha: ''
  };
}

export default function MetasPage({ dados, recarregar }) {
  const { talhoes, metasTalhoes = [], custos, atividades, colheitas } = dados;
  const anoAtualStr = new Date().getFullYear().toString();

  const [open, setOpen] = useState(false);
  const [editando, setEditando] = useState(null);
  const [anoFiltro, setAnoFiltro] = useState(anoAtualStr);
  const [form, setForm] = useState(formVazio(anoAtualStr));
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState(null);

  const anosDisponiveis = useMemo(() => {
    const anos = [...new Set(metasTalhoes.map((m) => m.ano?.toString()).filter(Boolean))].sort((a, b) => b - a);
    if (!anos.includes(anoAtualStr)) anos.unshift(anoAtualStr);
    return anos;
  }, [metasTalhoes, anoAtualStr]);

  const metasFiltradas = metasTalhoes.filter((m) => m.ano?.toString() === anoFiltro);

  // Real x meta — mesma lógica de produção: soma custos+atividades e
  // colheitas do talhão dentro do intervalo do ciclo da meta, divide pela
  // área do talhão, e compara com os alvos cadastrados.
  const desempenho = useMemo(() => {
    return metasFiltradas
      .map((meta) => {
        const talhao = talhoes.find((t) => t.id === meta.talhao_id);
        if (!talhao || !meta.data_inicio_ciclo || !meta.data_fim_ciclo) return null;

        const area = parseNumber(talhao.area_hectares) || 1;
        const intervalo = { start: addOneDay(meta.data_inicio_ciclo), end: addOneDay(meta.data_fim_ciclo) };

        const custo = [...custos, ...atividades]
          .filter((i) => {
            const dataRef = i.data || i.data_programada;
            return i.talhao_id === meta.talhao_id && dataRef && isWithinInterval(addOneDay(dataRef), intervalo);
          })
          .reduce((a, b) => a + parseNumber(b.valor ?? b.custo_total), 0);

        const prod = colheitas
          .filter((i) => i.talhao_id === meta.talhao_id && i.data && isWithinInterval(addOneDay(i.data), intervalo))
          .reduce((a, b) => a + parseNumber(b.quantidade_kg), 0);

        const cHa = custo / area;
        const pHa = prod / 1000 / area;

        return {
          talhao,
          meta,
          cHa,
          pHa,
          cStat: meta.meta_custo_por_ha > 0 && cHa > meta.meta_custo_por_ha ? STATUS_CUSTO_ALTO : STATUS_OK,
          pStat: meta.meta_producao_ton_por_ha > 0 && pHa < meta.meta_producao_ton_por_ha ? STATUS_PROD_BAIXA : STATUS_OK
        };
      })
      .filter(Boolean);
  }, [metasFiltradas, talhoes, custos, atividades, colheitas]);

  function abrirNova() {
    setEditando(null);
    setForm(formVazio(anoFiltro !== 'undefined' ? anoFiltro : anoAtualStr));
    setErro(null);
    setOpen(true);
  }

  function abrirEdicao(meta) {
    setEditando(meta);
    setForm({
      ano: meta.ano?.toString() || anoAtualStr,
      talhao_id: meta.talhao_id || '',
      data_inicio_ciclo: meta.data_inicio_ciclo || '',
      data_fim_ciclo: meta.data_fim_ciclo || '',
      meta_custo_por_ha: meta.meta_custo_por_ha?.toString() || '',
      meta_producao_ton_por_ha: meta.meta_producao_ton_por_ha?.toString() || ''
    });
    setErro(null);
    setOpen(true);
  }

  async function salvar(e) {
    e.preventDefault();
    if (!form.talhao_id) {
      setErro('Selecione um talhão.');
      return;
    }
    setSalvando(true);
    setErro(null);
    try {
      const payload = {
        ano: parseInt(form.ano, 10),
        talhao_id: form.talhao_id,
        data_inicio_ciclo: form.data_inicio_ciclo || null,
        data_fim_ciclo: form.data_fim_ciclo || null,
        meta_custo_por_ha: Number(form.meta_custo_por_ha) || 0,
        meta_producao_ton_por_ha: Number(form.meta_producao_ton_por_ha) || 0
      };
      await salvarMeta({ id: editando?.id, payload });
      setOpen(false);
      await recarregar();
    } catch (err) {
      setErro(err.message || 'Não foi possível salvar a meta.');
    } finally {
      setSalvando(false);
    }
  }

  async function excluir(id) {
    if (!confirm('Excluir esta meta? Essa ação não pode ser desfeita.')) return;
    try {
      await excluirMeta(id);
      await recarregar();
    } catch (err) {
      alert(`Não foi possível excluir a meta.\n\nMotivo: ${err.message || 'Erro desconhecido'}`);
    }
  }

  return (
    <div className="space-y-6">
      <div className="rounded-xl2 bg-tech/10 border border-tech/25 p-4 flex items-start gap-3">
        <Target className="w-4 h-4 text-tech shrink-0 mt-0.5" />
        <p className="text-sm text-ink-muted">
          Defina uma meta de custo e produção por hectare para cada talhão, num ciclo entre duas datas — a tela
          compara automaticamente com o que já foi lançado em Financeiro, Atividades e Colheitas no mesmo período.
        </p>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <label className="flex items-center gap-2 pl-3 pr-2.5 py-2 rounded-xl bg-surface-raised border border-line text-sm font-medium text-ink">
          <CalendarRange className="w-3.5 h-3.5 text-brand" />
          <select value={anoFiltro} onChange={(e) => setAnoFiltro(e.target.value)} className="bg-transparent outline-none tabular">
            {anosDisponiveis.map((a) => (
              <option key={a} value={a} className="bg-surface-raised">
                Ano {a}
              </option>
            ))}
          </select>
        </label>

        <button
          onClick={abrirNova}
          className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-brand text-base font-semibold text-sm hover:bg-brand/90 transition-colors"
        >
          <Plus className="w-4 h-4" /> Nova meta
        </button>
      </div>

      {desempenho.length === 0 ? (
        <div className="rounded-xl2 border border-dashed border-line p-8 flex flex-col items-center gap-2 text-center">
          <Target className="w-6 h-6 text-ink-faint" />
          <p className="text-sm text-ink-faint">Nenhuma meta cadastrada para {anoFiltro} ainda.</p>
        </div>
      ) : (
        <div className="rounded-xl2 bg-surface border border-line overflow-hidden overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-line text-left text-ink-faint text-xs uppercase tracking-wide">
                <th className="px-4 py-3 font-semibold">Talhão</th>
                <th className="px-4 py-3 font-semibold text-right">Meta custo/ha</th>
                <th className="px-4 py-3 font-semibold text-right">Real custo/ha</th>
                <th className="px-4 py-3 font-semibold text-right">Meta prod.</th>
                <th className="px-4 py-3 font-semibold text-right">Real prod.</th>
                <th className="px-4 py-3 font-semibold w-20"></th>
              </tr>
            </thead>
            <tbody>
              {desempenho.map((d) => {
                const foraDaMeta = d.cStat !== STATUS_OK || d.pStat !== STATUS_OK;
                return (
                  <tr key={d.meta.id} className={`border-b border-line-soft last:border-0 ${foraDaMeta ? 'bg-rose/5' : ''}`}>
                    <td className="px-4 py-3 font-semibold text-ink">{d.talhao.nome}</td>
                    <td className="px-4 py-3 text-right tabular text-ink-muted">{formatBRL(d.meta.meta_custo_por_ha)}</td>
                    <td className={`px-4 py-3 text-right tabular font-semibold ${d.cStat === STATUS_CUSTO_ALTO ? 'text-rose' : 'text-brand'}`}>
                      {formatBRL(d.cHa)}
                    </td>
                    <td className="px-4 py-3 text-right tabular text-ink-muted">{d.meta.meta_producao_ton_por_ha} ton/ha</td>
                    <td className={`px-4 py-3 text-right tabular font-semibold ${d.pStat === STATUS_PROD_BAIXA ? 'text-amber' : 'text-brand'}`}>
                      {d.pHa.toFixed(1)} ton/ha
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-1">
                        <button onClick={() => abrirEdicao(d.meta)} className="p-1.5 text-ink-faint hover:text-ink transition-colors">
                          <Edit className="w-4 h-4" />
                        </button>
                        <button onClick={() => excluir(d.meta.id)} className="p-1.5 text-ink-faint hover:text-rose transition-colors">
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title={editando ? 'Editar meta' : 'Nova meta'}
        description="Custo e produção alvo por hectare, num ciclo entre duas datas."
      >
        <form onSubmit={salvar} className="space-y-4">
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="text-[11px] uppercase tracking-wide text-ink-faint font-semibold block mb-1">Ano</label>
              <input
                value={form.ano}
                onChange={(e) => setForm((f) => ({ ...f, ano: e.target.value }))}
                required
                className="w-full rounded-lg bg-base border border-line px-3 py-2 text-sm text-ink"
              />
            </div>
            <div className="col-span-2">
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
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-[11px] uppercase tracking-wide text-ink-faint font-semibold block mb-1">Início do ciclo</label>
              <input
                type="date"
                value={form.data_inicio_ciclo}
                onChange={(e) => setForm((f) => ({ ...f, data_inicio_ciclo: e.target.value }))}
                required
                className="w-full rounded-lg bg-base border border-line px-3 py-2 text-sm text-ink"
              />
            </div>
            <div>
              <label className="text-[11px] uppercase tracking-wide text-ink-faint font-semibold block mb-1">Fim do ciclo</label>
              <input
                type="date"
                value={form.data_fim_ciclo}
                onChange={(e) => setForm((f) => ({ ...f, data_fim_ciclo: e.target.value }))}
                required
                className="w-full rounded-lg bg-base border border-line px-3 py-2 text-sm text-ink"
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-[11px] uppercase tracking-wide text-ink-faint font-semibold block mb-1">Meta custo/ha (R$)</label>
              <input
                type="number"
                inputMode="decimal"
                value={form.meta_custo_por_ha}
                onChange={(e) => setForm((f) => ({ ...f, meta_custo_por_ha: e.target.value }))}
                className="w-full rounded-lg bg-base border border-line px-3 py-2 text-sm text-ink"
              />
            </div>
            <div>
              <label className="text-[11px] uppercase tracking-wide text-ink-faint font-semibold block mb-1">Meta produção (ton/ha)</label>
              <input
                type="number"
                step="0.1"
                inputMode="decimal"
                value={form.meta_producao_ton_por_ha}
                onChange={(e) => setForm((f) => ({ ...f, meta_producao_ton_por_ha: e.target.value }))}
                className="w-full rounded-lg bg-base border border-line px-3 py-2 text-sm text-ink"
              />
            </div>
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
