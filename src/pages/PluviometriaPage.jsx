import React, { useMemo, useState } from 'react';
import { CloudRain, Droplets, Plus, Edit, Trash2, Loader2, AlertTriangle } from 'lucide-react';
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip } from 'recharts';
import { usePeriodo } from '../context/PeriodoContext.jsx';
import KpiCard from '../components/KpiCard.jsx';
import HistoryAccordion from '../components/HistoryAccordion.jsx';
import Modal from '../components/Modal.jsx';
import { filtrarPorAno, filtrarPorSafra, parseNumber } from '../lib/data.js';
import { MESES_PT } from '../lib/format.js';
import { supabase } from '../lib/supabaseClient.js';

// Mesmos campos e regras da produção (Pluviometria.jsx): data, quantidade_mm
// (obrigatório), talhao_id (opcional — null/vazio = "Geral / Sede", chuva pra
// fazenda toda) e observacoes (opcional).
function formVazio() {
  return {
    data: new Date().toISOString().slice(0, 10),
    quantidade_mm: '',
    talhao_id: '',
    observacoes: ''
  };
}

export default function PluviometriaPage({ dados, recarregar }) {
  const { modo, ano, safraSelecionada } = usePeriodo();
  const { talhoes, pluviometria } = dados;
  const getTalhaoNome = (id) => talhoes.find((t) => String(t.id) === String(id))?.nome || 'Geral / todos os talhões';

  const [open, setOpen] = useState(false);
  const [editando, setEditando] = useState(null);
  const [form, setForm] = useState(formVazio());
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState(null);

  const escopo = useMemo(() => {
    if (modo === 'safra' && safraSelecionada) return filtrarPorSafra(pluviometria, safraSelecionada);
    return filtrarPorAno(pluviometria, ano);
  }, [modo, ano, safraSelecionada, pluviometria]);

  const acumulado = escopo.reduce((acc, c) => acc + (Number(c.quantidade_mm) || 0), 0);
  const media = escopo.length > 0 ? acumulado / escopo.length : 0;

  const porMes = useMemo(() => {
    const base = Array.from({ length: 12 }, (_, i) => ({ mes: MESES_PT[i], mm: 0 }));
    escopo.forEach((c) => {
      if (!c.data) return;
      const idx = Number(c.data.slice(5, 7)) - 1;
      if (idx >= 0 && idx < 12) base[idx].mm += Number(c.quantidade_mm) || 0;
    });
    return base;
  }, [escopo]);

  function abrirNova() {
    setEditando(null);
    setForm(formVazio());
    setErro(null);
    setOpen(true);
  }

  function abrirEdicao(chuva) {
    setEditando(chuva);
    setForm({
      data: chuva.data || new Date().toISOString().slice(0, 10),
      quantidade_mm: chuva.quantidade_mm?.toString() || '',
      talhao_id: chuva.talhao_id || '',
      observacoes: chuva.observacoes || ''
    });
    setErro(null);
    setOpen(true);
  }

  async function salvar(e) {
    e.preventDefault();
    setSalvando(true);
    setErro(null);
    try {
      const payload = {
        data: form.data || null,
        quantidade_mm: parseNumber(form.quantidade_mm),
        talhao_id: form.talhao_id || null,
        observacoes: form.observacoes || null
      };
      if (editando) {
        const { error } = await supabase.from('pluviometria').update(payload).eq('id', editando.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('pluviometria').insert([payload]);
        if (error) throw error;
      }
      setOpen(false);
      await recarregar();
    } catch (err) {
      setErro(err.message || 'Não foi possível salvar o registro de chuva.');
    } finally {
      setSalvando(false);
    }
  }

  async function excluir(id) {
    if (!confirm('Excluir este registro de chuva? Essa ação não pode ser desfeita.')) return;
    try {
      const { error } = await supabase.from('pluviometria').delete().eq('id', id);
      if (error) throw error;
      await recarregar();
    } catch (err) {
      alert(`Não foi possível excluir o registro de chuva.\n\nMotivo: ${err.message || 'Erro desconhecido'}`);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <p className="text-sm text-ink-faint">
          Chuva registrada em <span className="text-brand font-semibold">{modo === 'safra' ? safraSelecionada?.nome : `Ano ${ano}`}</span>.
        </p>
        <button
          onClick={abrirNova}
          className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-brand text-base font-semibold text-sm hover:bg-brand/90 transition-colors shrink-0"
        >
          <Plus className="w-4 h-4" /> Nova medição
        </button>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:gap-4 max-w-md">
        <KpiCard label="Acumulado" value={`${acumulado.toFixed(1)} mm`} icon={CloudRain} tone="tech" />
        <KpiCard label="Média por registro" value={`${media.toFixed(1)} mm`} icon={Droplets} tone="brand" />
      </div>

      <div className="rounded-xl2 bg-surface border border-line p-4 sm:p-6">
        <h3 className="font-display font-semibold text-sm text-ink mb-4">Volume por mês</h3>
        <div className="h-56 -ml-2">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={porMes} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
              <CartesianGrid vertical={false} stroke="rgba(234,242,236,0.06)" />
              <XAxis dataKey="mes" tick={{ fill: '#93A8A0', fontSize: 11 }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fill: '#93A8A0', fontSize: 11 }} axisLine={false} tickLine={false} width={36} />
              <Tooltip
                contentStyle={{ background: '#161F1A', border: '1px solid rgba(234,242,236,0.08)', borderRadius: 8, fontSize: 12 }}
                labelStyle={{ color: '#93A8A0' }}
                formatter={(v) => [`${v} mm`, 'Chuva']}
              />
              <Bar dataKey="mm" fill="#33C9E8" radius={[4, 4, 0, 0]} barSize={16} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      <HistoryAccordion title="Registros do período" subtitle={`${escopo.length} lançamentos`} defaultOpen>
        <div>
          {[...escopo]
            .sort((a, b) => (b.data || '').localeCompare(a.data || ''))
            .map((c) => (
              <div key={c.id} className="flex items-center justify-between gap-3 py-2 border-b border-line-soft last:border-0 text-sm">
                <span className="text-ink-faint truncate">{c.data} · {getTalhaoNome(c.talhao_id)}</span>
                <div className="flex items-center gap-3 shrink-0">
                  <span className="font-semibold tabular text-tech">{c.quantidade_mm} mm</span>
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
            ))}
          {escopo.length === 0 && <p className="text-sm text-ink-faint italic py-2">Nenhum registro neste período.</p>}
        </div>
      </HistoryAccordion>

      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title={editando ? 'Editar medição' : 'Nova medição'}
        description="Registro de volume de chuva por data, com talhão opcional."
      >
        <form onSubmit={salvar} className="space-y-4">
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
              <label className="text-[11px] uppercase tracking-wide text-ink-faint font-semibold block mb-1">Milímetros (mm)</label>
              <input
                type="number"
                step="0.1"
                inputMode="decimal"
                placeholder="Ex: 15"
                value={form.quantidade_mm}
                onChange={(e) => setForm((f) => ({ ...f, quantidade_mm: e.target.value }))}
                required
                className="w-full rounded-lg bg-base border border-line px-3 py-2 text-sm text-ink"
              />
            </div>
          </div>

          <div>
            <label className="text-[11px] uppercase tracking-wide text-ink-faint font-semibold block mb-1">Local (opcional)</label>
            <select
              value={form.talhao_id}
              onChange={(e) => setForm((f) => ({ ...f, talhao_id: e.target.value }))}
              className="w-full rounded-lg bg-base border border-line px-3 py-2 text-sm text-ink"
            >
              <option value="">Geral / Sede</option>
              {talhoes.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.nome}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="text-[11px] uppercase tracking-wide text-ink-faint font-semibold block mb-1">Observações</label>
            <textarea
              rows={2}
              value={form.observacoes}
              onChange={(e) => setForm((f) => ({ ...f, observacoes: e.target.value }))}
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
