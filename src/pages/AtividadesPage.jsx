import React, { useEffect, useMemo, useState } from 'react';
import {
  ClipboardCheck,
  Clock,
  CheckCircle2,
  User,
  Plus,
  Edit,
  Trash2,
  Copy,
  FileText,
  X,
  ListPlus,
  ClipboardList,
  Loader2,
  AlertTriangle,
  Send
} from 'lucide-react';
import { format, parseISO } from 'date-fns';
import { usePeriodo } from '../context/PeriodoContext.jsx';
import HistoryAccordion from '../components/HistoryAccordion.jsx';
import KpiCard from '../components/KpiCard.jsx';
import Modal from '../components/Modal.jsx';
import { filtrarPorAno, filtrarPorSafra, parseNumber } from '../lib/data.js';
import { formatBRL } from '../lib/format.js';
import { supabase } from '../lib/supabaseClient.js';

const TIPOS_PADRAO = [
  { value: 'inducao', label: 'Indução' },
  { value: 'poda', label: 'Poda' },
  { value: 'adubacao', label: 'Adubação' },
  { value: 'pulverizacao', label: 'Pulverização' },
  { value: 'maturacao', label: 'Maturação' },
  { value: 'irrigacao', label: 'Irrigação' },
  { value: 'capina', label: 'Capina' },
  { value: 'outro', label: 'Outro' }
];

const METODOS_APLICACAO = [
  { value: 'foliar', label: 'Foliar' },
  { value: 'adubacao', label: 'Adubação' },
  { value: 'solo', label: 'Solo' },
  { value: 'fertirrigacao', label: 'Fertirrigação' },
  { value: 'outro', label: 'Outro…' }
];

const inputCls = 'w-full rounded-lg bg-base border border-line px-3 py-2 text-sm text-ink';
const labelCls = 'text-[11px] uppercase tracking-wide text-ink-faint font-semibold block mb-1';

function formVazio(hoje) {
  return {
    talhao_id: '',
    tipo: '',
    tipo_personalizado: '',
    data_programada: hoje,
    data_realizada: '',
    status: 'programada',
    terceirizada: false,
    valor_terceirizado: '',
    insumos_utilizados: [],
    custo_total: 0,
    responsavel: '',
    observacoes: ''
  };
}

function LinhaAtividade({ a, talhaoNome, onConcluir, onEditar, onDuplicar, onExcluir, onVerTexto, getTipoLabel }) {
  const concluida = a.status === 'concluida' || a.status === 'concluída';
  return (
    <div className="flex items-center justify-between gap-3 py-2.5 border-b border-line-soft last:border-0 text-sm">
      <div className="flex items-center gap-2.5 min-w-0">
        {concluida ? (
          <CheckCircle2 className="w-3.5 h-3.5 text-brand shrink-0" />
        ) : (
          <Clock className="w-3.5 h-3.5 text-amber shrink-0" />
        )}
        <div className="min-w-0">
          <div className="text-ink truncate">
            {a.tipo === 'outro' ? a.tipo_personalizado : getTipoLabel(a.tipo)} <span className="text-ink-faint">· {talhaoNome}</span>
          </div>
          <div className="text-xs text-ink-faint flex items-center gap-2 flex-wrap">
            <span>{a.data_realizada || a.data_programada || 'sem data'}</span>
            {a.responsavel && (
              <span className="flex items-center gap-1">
                <User className="w-3 h-3" /> {a.responsavel}
              </span>
            )}
            {a.terceirizada && <span className="text-tech">terceirizado</span>}
            {a.custo_total > 0 && <span className="tabular text-ink-muted">{formatBRL(a.custo_total)}</span>}
          </div>
        </div>
      </div>
      <div className="flex items-center gap-0.5 shrink-0">
        {!concluida && (
          <button onClick={() => onConcluir(a)} title="Concluir" className="p-1.5 text-ink-faint hover:text-brand transition-colors">
            <CheckCircle2 className="w-3.5 h-3.5" />
          </button>
        )}
        <button onClick={() => onVerTexto(a)} title="Ver texto" className="p-1.5 text-ink-faint hover:text-ink transition-colors">
          <FileText className="w-3.5 h-3.5" />
        </button>
        <button onClick={() => onEditar(a)} title="Editar" className="p-1.5 text-ink-faint hover:text-ink transition-colors">
          <Edit className="w-3.5 h-3.5" />
        </button>
        <button onClick={() => onDuplicar(a)} title="Duplicar" className="p-1.5 text-ink-faint hover:text-tech transition-colors">
          <Copy className="w-3.5 h-3.5" />
        </button>
        <button onClick={() => onExcluir(a.id)} title="Excluir" className="p-1.5 text-ink-faint hover:text-rose transition-colors">
          <Trash2 className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
}

export default function AtividadesPage({ dados, recarregar }) {
  const { modo, ano, safraSelecionada } = usePeriodo();
  const { talhoes, atividades, insumos } = dados;
  const hoje = new Date().toISOString().slice(0, 10);
  const getTalhaoNome = (id) => talhoes.find((t) => String(t.id) === String(id))?.nome || 'Geral';

  const [tiposCustomizados, setTiposCustomizados] = useState([]);
  useEffect(() => {
    supabase
      .from('tipos_atividade')
      .select('*')
      .then(({ data, error }) => {
        if (!error) setTiposCustomizados(data || []);
      });
  }, []);

  const getTipoLabel = (tipo) => {
    const padrao = TIPOS_PADRAO.find((t) => t.value === tipo);
    if (padrao) return padrao.label;
    const custom = tiposCustomizados.find((t) => t.nome === tipo);
    return custom ? custom.nome : tipo;
  };
  const todosTipos = useMemo(
    () => [...TIPOS_PADRAO.filter((t) => t.value !== 'outro'), ...tiposCustomizados.map((t) => ({ value: t.nome, label: t.nome })), { value: 'outro', label: 'Outro' }],
    [tiposCustomizados]
  );

  // --- estado do cadastro ---
  const [open, setOpen] = useState(false);
  const [editando, setEditando] = useState(null);
  const [form, setForm] = useState(formVazio(hoje));
  const [fila, setFila] = useState([]);
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState(null);
  const [insumoTemp, setInsumoTemp] = useState({ insumo_id: '', quantidade: '', metodo_aplicacao: 'foliar' });
  const [novoMetodo, setNovoMetodo] = useState('');
  const [mostrarNovoMetodo, setMostrarNovoMetodo] = useState(false);

  const [openTipoModal, setOpenTipoModal] = useState(false);
  const [novoTipo, setNovoTipo] = useState('');
  const [salvandoTipo, setSalvandoTipo] = useState(false);

  const [concluirModal, setConcluirModal] = useState(null); // atividade sendo concluída
  const [dataConclusao, setDataConclusao] = useState(hoje);

  const [textoModal, setTextoModal] = useState(null); // texto pra copiar (WhatsApp)

  function resetForm() {
    setForm(formVazio(hoje));
    setEditando(null);
    setFila([]);
    setInsumoTemp({ insumo_id: '', quantidade: '', metodo_aplicacao: 'foliar' });
    setNovoMetodo('');
    setMostrarNovoMetodo(false);
    setErro(null);
    setOpen(false);
  }

  function abrirNova() {
    resetForm();
    setOpen(true);
  }
  function abrirEdicao(a) {
    setEditando(a);
    setForm({
      talhao_id: String(a.talhao_id || ''),
      tipo: a.tipo || '',
      tipo_personalizado: a.tipo_personalizado || '',
      data_programada: a.data_programada || hoje,
      data_realizada: a.data_realizada || '',
      status: a.status || 'programada',
      terceirizada: !!a.terceirizada,
      valor_terceirizado: a.valor_terceirizado ?? '',
      insumos_utilizados: a.insumos_utilizados || [],
      custo_total: a.custo_total || 0,
      responsavel: a.responsavel || '',
      observacoes: a.observacoes || ''
    });
    setFila([]);
    setErro(null);
    setOpen(true);
  }
  function abrirDuplicacao(a) {
    setEditando(null);
    setForm({
      talhao_id: String(a.talhao_id || ''),
      tipo: a.tipo || '',
      tipo_personalizado: a.tipo_personalizado || '',
      data_programada: hoje,
      data_realizada: '',
      status: 'programada',
      terceirizada: !!a.terceirizada,
      valor_terceirizado: a.valor_terceirizado ?? '',
      insumos_utilizados: a.insumos_utilizados || [],
      custo_total: a.custo_total || 0,
      responsavel: a.responsavel || '',
      observacoes: a.observacoes || ''
    });
    setFila([]);
    setErro(null);
    setOpen(true);
  }

  // Preço por unidade de uso (kg/L/un) = preço da embalagem ÷ tamanho da
  // embalagem. Se a embalagem não foi informada, trata a quantidade como
  // embalagens inteiras (tamanho 1) — MESMA regra de produção, não mudar.
  function addInsumo() {
    if (!insumoTemp.insumo_id || !insumoTemp.quantidade) return;
    const insumoSelecionado = insumos.find((i) => i.id === insumoTemp.insumo_id);
    if (!insumoSelecionado) return;
    const quantidade = parseNumber(insumoTemp.quantidade);
    const precoPorUnidade = parseNumber(insumoSelecionado.preco_unitario) / (parseNumber(insumoSelecionado.tamanho_embalagem) || 1);
    const valorTotal = quantidade * precoPorUnidade;
    const metodoFinal = (insumoTemp.metodo_aplicacao === 'outro' ? novoMetodo : insumoTemp.metodo_aplicacao) || 'foliar';
    const novosInsumos = [
      ...form.insumos_utilizados,
      {
        insumo_id: insumoSelecionado.id,
        nome: insumoSelecionado.nome,
        quantidade,
        unidade: insumoSelecionado.unidade,
        valor_unitario: precoPorUnidade,
        valor_total: valorTotal,
        metodo_aplicacao: metodoFinal
      }
    ];
    setForm((f) => ({
      ...f,
      insumos_utilizados: novosInsumos,
      custo_total: novosInsumos.reduce((acc, i) => acc + (i.valor_total || 0), 0) + (f.terceirizada ? parseNumber(f.valor_terceirizado) : 0)
    }));
    setInsumoTemp({ insumo_id: '', quantidade: '', metodo_aplicacao: 'foliar' });
    setNovoMetodo('');
    setMostrarNovoMetodo(false);
  }
  function removerInsumo(idx) {
    setForm((f) => {
      const novosInsumos = f.insumos_utilizados.filter((_, i) => i !== idx);
      return {
        ...f,
        insumos_utilizados: novosInsumos,
        custo_total: novosInsumos.reduce((acc, i) => acc + (i.valor_total || 0), 0) + (f.terceirizada ? parseNumber(f.valor_terceirizado) : 0)
      };
    });
  }

  function calcularCustoTotal(item = form) {
    return item.insumos_utilizados.reduce((acc, i) => acc + (i.valor_total || 0), 0) + (item.terceirizada ? parseNumber(item.valor_terceirizado) : 0);
  }

  function adicionarNaFila() {
    if (!form.talhao_id || !form.tipo || !form.data_programada) {
      setErro('Preencha talhão, tipo e data para adicionar.');
      return;
    }
    setErro(null);
    const custoCalc = calcularCustoTotal();
    const item = {
      ...form,
      safra_id: modo === 'safra' && safraSelecionada ? safraSelecionada.id : null,
      valor_terceirizado: form.valor_terceirizado ? parseNumber(form.valor_terceirizado) : null,
      custo_total: custoCalc,
      data_realizada: form.status === 'concluida' ? form.data_programada : null,
      talhao_nome: getTalhaoNome(form.talhao_id),
      tempId: Date.now()
    };
    setFila((f) => [...f, item]);
    setForm((f) => ({ ...f, observacoes: '', insumos_utilizados: [], custo_total: 0, terceirizada: false, valor_terceirizado: '' }));
  }
  function removerDaFila(tempId) {
    setFila((f) => f.filter((i) => i.tempId !== tempId));
  }

  async function salvarFila() {
    if (fila.length === 0) return;
    setSalvando(true);
    setErro(null);
    try {
      const payload = fila.map(({ tempId, talhao_nome, ...rest }) => rest);
      const { error } = await supabase.from('atividades').insert(payload);
      if (error) throw error;
      resetForm();
      await recarregar();
    } catch (err) {
      setErro(err.message || 'Não foi possível salvar a programação.');
    } finally {
      setSalvando(false);
    }
  }

  async function salvarEdicao(e) {
    e.preventDefault();
    setSalvando(true);
    setErro(null);
    try {
      const payload = {
        talhao_id: form.talhao_id,
        tipo: form.tipo,
        tipo_personalizado: form.tipo_personalizado,
        data_programada: form.data_programada,
        status: form.status,
        terceirizada: form.terceirizada,
        valor_terceirizado: form.valor_terceirizado ? parseNumber(form.valor_terceirizado) : null,
        insumos_utilizados: form.insumos_utilizados,
        custo_total: calcularCustoTotal(),
        responsavel: form.responsavel,
        observacoes: form.observacoes,
        data_realizada: form.status === 'concluida' ? form.data_realizada || form.data_programada : null
      };
      const { error } = await supabase.from('atividades').update(payload).eq('id', editando.id);
      if (error) throw error;
      resetForm();
      await recarregar();
    } catch (err) {
      setErro(err.message || 'Não foi possível salvar a atividade.');
    } finally {
      setSalvando(false);
    }
  }

  async function excluirAtividade(id) {
    if (!confirm('Excluir esta atividade? Essa ação não pode ser desfeita.')) return;
    try {
      const { error } = await supabase.from('atividades').delete().eq('id', id);
      if (error) throw error;
      await recarregar();
    } catch (err) {
      alert(`Não foi possível excluir a atividade.\n\nMotivo: ${err.message || 'Erro desconhecido'}`);
    }
  }

  function abrirConcluir(a) {
    setConcluirModal(a);
    setDataConclusao(hoje);
  }
  async function confirmarConclusao() {
    if (!concluirModal || !dataConclusao) return;
    setSalvando(true);
    try {
      const { error } = await supabase
        .from('atividades')
        .update({ status: 'concluida', data_realizada: dataConclusao })
        .eq('id', concluirModal.id);
      if (error) throw error;
      setConcluirModal(null);
      await recarregar();
    } catch (err) {
      alert(`Não foi possível concluir a atividade.\n\nMotivo: ${err.message || 'Erro desconhecido'}`);
    } finally {
      setSalvando(false);
    }
  }

  async function salvarNovoTipo() {
    if (!novoTipo) return;
    setSalvandoTipo(true);
    try {
      const { data, error } = await supabase.from('tipos_atividade').insert({ nome: novoTipo }).select();
      if (error) throw error;
      setTiposCustomizados((t) => [...t, ...(data || [])]);
      setNovoTipo('');
    } catch (err) {
      alert(`Não foi possível criar o tipo.\n\nMotivo: ${err.message || 'Erro desconhecido'}`);
    } finally {
      setSalvandoTipo(false);
    }
  }
  async function excluirTipo(id) {
    try {
      const { error } = await supabase.from('tipos_atividade').delete().eq('id', id);
      if (error) throw error;
      setTiposCustomizados((t) => t.filter((tp) => tp.id !== id));
    } catch (err) {
      alert(`Não foi possível excluir o tipo.\n\nMotivo: ${err.message || 'Erro desconhecido'}`);
    }
  }

  function verTexto(atividade) {
    const talhaoNome = getTalhaoNome(atividade.talhao_id);
    const tipoNome = atividade.tipo === 'outro' ? atividade.tipo_personalizado : getTipoLabel(atividade.tipo);
    const dataRef = atividade.data_programada ? format(parseISO(atividade.data_programada), 'dd/MM/yyyy') : '-';
    let text = `📋 *DETALHES DA ATIVIDADE*\n\n📍 *Talhão:* ${talhaoNome}\n🚜 *Atividade:* ${tipoNome}\n📅 *Data:* ${dataRef}\n`;
    if (atividade.terceirizada) text += `👷 *Serviço:* Terceirizado\n`;
    if (atividade.insumos_utilizados?.length > 0) {
      text += `\n📦 *Insumos:*`;
      atividade.insumos_utilizados.forEach((i) => {
        text += `\n   ▪ ${i.nome}: ${i.quantidade} ${i.unidade}${i.metodo_aplicacao ? ` (${i.metodo_aplicacao})` : ''}`;
      });
      text += `\n`;
    }
    if (atividade.observacoes) text += `\n📝 *Observações:*\n${atividade.observacoes}`;
    setTextoModal(text);
  }
  function copiarTexto() {
    navigator.clipboard.writeText(textoModal);
    alert('Texto copiado! Agora cole no WhatsApp.');
  }

  // --- visualização (leitura) ---
  const comData = useMemo(() => atividades.map((a) => ({ ...a, dataEfetiva: a.data_realizada || a.data_programada })), [atividades]);
  const escopo = useMemo(() => {
    if (modo === 'safra' && safraSelecionada) return filtrarPorSafra(comData, safraSelecionada, 'dataEfetiva');
    return filtrarPorAno(comData, ano, 'dataEfetiva');
  }, [modo, ano, safraSelecionada, comData]);

  const pendentes = escopo.filter((a) => a.status !== 'concluida' && a.status !== 'concluída');
  const concluidas = escopo.filter((a) => a.status === 'concluida' || a.status === 'concluída');
  const terceirizadas = escopo.filter((a) => a.terceirizada);

  const porTalhao = useMemo(() => {
    const grupos = {};
    concluidas.forEach((a) => {
      const key = a.talhao_id || 'geral';
      if (!grupos[key]) grupos[key] = [];
      grupos[key].push(a);
    });
    return Object.entries(grupos);
  }, [concluidas]);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-ink-faint">
          Atividades de <span className="text-brand font-semibold">{modo === 'safra' ? safraSelecionada?.nome : `Ano ${ano}`}</span>.
        </p>
        <button
          onClick={abrirNova}
          className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-brand text-base font-semibold text-sm hover:bg-brand/90 transition-colors"
        >
          <Plus className="w-4 h-4" /> Nova atividade
        </button>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
        <KpiCard label="Pendentes" value={String(pendentes.length)} icon={Clock} tone="amber" />
        <KpiCard label="Concluídas" value={String(concluidas.length)} icon={CheckCircle2} tone="brand" />
        <KpiCard label="Terceirizadas" value={String(terceirizadas.length)} icon={ClipboardCheck} tone="tech" />
      </div>

      {pendentes.length > 0 && (
        <div className="rounded-xl2 bg-surface border border-line p-4 sm:p-5">
          <h3 className="font-display font-semibold text-sm text-ink mb-2">Programadas / pendentes</h3>
          {pendentes.map((a) => (
            <LinhaAtividade
              key={a.id}
              a={a}
              talhaoNome={getTalhaoNome(a.talhao_id)}
              getTipoLabel={getTipoLabel}
              onConcluir={abrirConcluir}
              onEditar={abrirEdicao}
              onDuplicar={abrirDuplicacao}
              onExcluir={excluirAtividade}
              onVerTexto={verTexto}
            />
          ))}
        </div>
      )}

      <div className="space-y-2.5">
        <h3 className="font-display font-semibold text-sm text-ink">Concluídas por talhão</h3>
        {porTalhao.map(([talhaoId, lista]) => (
          <HistoryAccordion key={talhaoId} title={getTalhaoNome(talhaoId)} subtitle={`${lista.length} atividade${lista.length > 1 ? 's' : ''}`}>
            <div>
              {lista.map((a) => (
                <LinhaAtividade
                  key={a.id}
                  a={a}
                  talhaoNome={getTalhaoNome(a.talhao_id)}
                  getTipoLabel={getTipoLabel}
                  onConcluir={abrirConcluir}
                  onEditar={abrirEdicao}
                  onDuplicar={abrirDuplicacao}
                  onExcluir={excluirAtividade}
                  onVerTexto={verTexto}
                />
              ))}
            </div>
          </HistoryAccordion>
        ))}
        {porTalhao.length === 0 && <p className="text-sm text-ink-faint italic">Nenhuma atividade concluída neste período.</p>}
      </div>

      {/* Modal de cadastro */}
      <Modal
        open={open}
        onClose={resetForm}
        title={editando ? 'Editar atividade' : 'Planejamento de atividades'}
        description={editando ? 'Edite os detalhes desta atividade.' : 'Adicione várias atividades à lista e salve tudo de uma vez.'}
        maxWidth="max-w-4xl"
      >
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
          <div className="lg:col-span-2 space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={labelCls}>Talhão</label>
                <select value={form.talhao_id} onChange={(e) => setForm((f) => ({ ...f, talhao_id: e.target.value }))} className={inputCls}>
                  <option value="">Selecione…</option>
                  {talhoes.map((t) => (
                    <option key={t.id} value={String(t.id)}>
                      {t.nome}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className={labelCls + ' mb-0'}>Tipo de atividade</label>
                  <button type="button" onClick={() => setOpenTipoModal(true)} className="text-[11px] text-tech hover:text-tech/80 flex items-center gap-1">
                    <Plus className="w-3 h-3" /> Gerenciar
                  </button>
                </div>
                <select value={form.tipo} onChange={(e) => setForm((f) => ({ ...f, tipo: e.target.value }))} className={inputCls}>
                  <option value="">Selecione…</option>
                  {todosTipos.map((t) => (
                    <option key={t.value} value={t.value}>
                      {t.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {form.tipo === 'outro' && (
              <div>
                <label className={labelCls}>Nome da atividade</label>
                <input
                  value={form.tipo_personalizado}
                  onChange={(e) => setForm((f) => ({ ...f, tipo_personalizado: e.target.value }))}
                  className={inputCls}
                />
              </div>
            )}

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={labelCls}>Data programada</label>
                <input
                  type="date"
                  value={form.data_programada}
                  onChange={(e) => setForm((f) => ({ ...f, data_programada: e.target.value }))}
                  className={inputCls}
                />
              </div>
              <div>
                <label className={labelCls}>Status</label>
                <select value={form.status} onChange={(e) => setForm((f) => ({ ...f, status: e.target.value }))} className={inputCls}>
                  <option value="programada">Programada</option>
                  <option value="em_andamento">Em andamento</option>
                  <option value="concluida">Concluída</option>
                </select>
              </div>
            </div>

            <div>
              <label className={labelCls}>Responsável</label>
              <input value={form.responsavel} onChange={(e) => setForm((f) => ({ ...f, responsavel: e.target.value }))} className={inputCls} />
            </div>

            <div className="p-3 rounded-xl bg-base border border-line-soft space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-ink">Atividade terceirizada</span>
                <button
                  type="button"
                  onClick={() => setForm((f) => ({ ...f, terceirizada: !f.terceirizada }))}
                  className={`w-10 h-6 rounded-full transition-colors relative ${form.terceirizada ? 'bg-brand' : 'bg-line'}`}
                >
                  <span className={`absolute top-0.5 w-5 h-5 rounded-full bg-base transition-transform ${form.terceirizada ? 'translate-x-4' : 'translate-x-0.5'}`} />
                </button>
              </div>
              {form.terceirizada && (
                <div>
                  <label className={labelCls}>Valor do serviço (R$)</label>
                  <input
                    type="number"
                    step="0.01"
                    value={form.valor_terceirizado}
                    onChange={(e) => setForm((f) => ({ ...f, valor_terceirizado: e.target.value }))}
                    placeholder="R$ 0,00"
                    className={inputCls}
                  />
                </div>
              )}
            </div>

            <div className="p-3 rounded-xl bg-base border border-line-soft space-y-2.5">
              <label className="text-xs font-semibold text-ink-muted">Insumos utilizados (opcional)</label>
              <div className="flex flex-wrap gap-2">
                <select
                  value={insumoTemp.insumo_id}
                  onChange={(e) => setInsumoTemp((i) => ({ ...i, insumo_id: e.target.value }))}
                  className="flex-1 min-w-[140px] rounded-lg bg-surface-raised border border-line px-2 py-1.5 text-xs text-ink"
                >
                  <option value="">Insumo…</option>
                  {insumos.map((i) => (
                    <option key={i.id} value={i.id}>
                      {i.nome}
                    </option>
                  ))}
                </select>
                <input
                  type="number"
                  placeholder={insumos.find((i) => i.id === insumoTemp.insumo_id)?.unidade ? `Qtd (${insumos.find((i) => i.id === insumoTemp.insumo_id).unidade})` : 'Qtd'}
                  value={insumoTemp.quantidade}
                  onChange={(e) => setInsumoTemp((i) => ({ ...i, quantidade: e.target.value }))}
                  className="w-24 rounded-lg bg-surface-raised border border-line px-2 py-1.5 text-xs text-ink"
                />
                <select
                  value={insumoTemp.metodo_aplicacao}
                  onChange={(e) => {
                    setInsumoTemp((i) => ({ ...i, metodo_aplicacao: e.target.value }));
                    setMostrarNovoMetodo(e.target.value === 'outro');
                  }}
                  className="w-32 rounded-lg bg-surface-raised border border-line px-2 py-1.5 text-xs text-ink"
                >
                  {METODOS_APLICACAO.map((m) => (
                    <option key={m.value} value={m.value}>
                      {m.label}
                    </option>
                  ))}
                </select>
                {mostrarNovoMetodo && (
                  <input
                    placeholder="Nome"
                    value={novoMetodo}
                    onChange={(e) => setNovoMetodo(e.target.value)}
                    className="w-24 rounded-lg bg-surface-raised border border-line px-2 py-1.5 text-xs text-ink"
                  />
                )}
                <button type="button" onClick={addInsumo} className="p-1.5 rounded-lg bg-brand/10 text-brand hover:bg-brand/20">
                  <Plus className="w-4 h-4" />
                </button>
              </div>
              {insumoTemp.insumo_id &&
                (() => {
                  const ins = insumos.find((i) => i.id === insumoTemp.insumo_id);
                  if (!ins) return null;
                  const precoPorUnidade = parseNumber(ins.preco_unitario) / (parseNumber(ins.tamanho_embalagem) || 1);
                  return (
                    <p className="text-[11px] text-ink-faint -mt-1">
                      Registrado como <b className="text-ink-muted">{ins.unidade}</b> · {formatBRL(precoPorUnidade)} / {ins.unidade}
                      {!ins.tamanho_embalagem && <span className="text-amber font-bold"> (embalagem não informada — cadastre em Insumos pra dar mais precisão)</span>}
                      · digite quanto foi realmente usado em {ins.unidade}.
                    </p>
                  );
                })()}
              {form.insumos_utilizados.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {form.insumos_utilizados.map((ins, idx) => (
                    <span key={idx} className="inline-flex items-center gap-1.5 bg-surface-raised border border-line text-ink-muted text-xs pl-2 pr-1 py-1 rounded-lg">
                      {ins.nome} ({ins.quantidade}) — <span className="font-semibold capitalize">{ins.metodo_aplicacao}</span>
                      <button onClick={() => removerInsumo(idx)} className="text-ink-faint hover:text-rose">
                        <X className="w-3 h-3" />
                      </button>
                    </span>
                  ))}
                </div>
              )}
            </div>

            <div className="flex items-center justify-between p-3 rounded-xl bg-brand/10 border border-brand/20">
              <span className="text-sm font-medium text-ink">Custo total previsto</span>
              <span className="text-lg font-bold text-brand">{formatBRL(calcularCustoTotal())}</span>
            </div>

            <div>
              <label className={labelCls}>Observações</label>
              <textarea
                value={form.observacoes}
                onChange={(e) => setForm((f) => ({ ...f, observacoes: e.target.value }))}
                rows={2}
                placeholder="Detalhes para o encarregado…"
                className={inputCls}
              />
            </div>

            {erro && (
              <div className="flex items-start gap-2 text-sm text-rose">
                <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                <span>{erro}</span>
              </div>
            )}

            {editando ? (
              <div className="flex justify-end gap-2.5 pt-2">
                <button type="button" onClick={resetForm} className="px-4 py-2.5 rounded-xl bg-line-soft text-ink text-sm font-medium hover:bg-line transition-colors">
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={salvarEdicao}
                  disabled={salvando}
                  className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-brand text-base font-semibold text-sm disabled:opacity-40 hover:bg-brand/90 transition-colors"
                >
                  {salvando && <Loader2 className="w-4 h-4 animate-spin" />} {salvando ? 'Salvando…' : 'Salvar alterações'}
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={adicionarNaFila}
                className="w-full inline-flex items-center justify-center gap-2 rounded-xl bg-tech text-base font-bold h-11 hover:bg-tech/90 transition-colors"
              >
                <ListPlus className="w-4 h-4" /> Adicionar à lista
              </button>
            )}
          </div>

          <div className="lg:col-span-1 bg-base rounded-2xl border border-line p-3.5 flex flex-col min-h-[240px]">
            <h4 className="text-sm font-bold text-ink mb-2.5 flex items-center gap-2">
              <ClipboardList className="w-4 h-4" /> Lista de programação ({fila.length})
            </h4>
            {editando ? (
              <div className="flex-1 flex items-center justify-center text-center text-ink-faint text-xs italic">
                Modo de edição individual.
                <br />
                A lista está desabilitada.
              </div>
            ) : (
              <>
                <div className="flex-1 overflow-y-auto space-y-2 max-h-[420px] pr-1">
                  {fila.length === 0 ? (
                    <div className="text-center text-ink-faint text-xs py-8 italic">Preencha o formulário e clique em "Adicionar à lista".</div>
                  ) : (
                    fila.map((item) => (
                      <div key={item.tempId} className="bg-surface-raised p-2.5 rounded-xl border border-line text-xs relative">
                        <button onClick={() => removerDaFila(item.tempId)} className="absolute top-2 right-2 text-ink-faint hover:text-rose">
                          <X className="w-3.5 h-3.5" />
                        </button>
                        <div className="font-bold text-brand">{item.talhao_nome}</div>
                        <div className="font-medium text-ink">{item.tipo === 'outro' ? item.tipo_personalizado : getTipoLabel(item.tipo)}</div>
                        <div className="text-ink-faint mt-0.5">{item.data_programada}</div>
                        {item.terceirizada && <div className="text-tech font-bold mt-1">Terceirizado: {formatBRL(item.valor_terceirizado)}</div>}
                        {item.custo_total > 0 && <div className="text-brand font-bold mt-1">{formatBRL(item.custo_total)}</div>}
                      </div>
                    ))
                  )}
                </div>
                <div className="mt-3 pt-3 border-t border-line">
                  <button
                    onClick={salvarFila}
                    disabled={fila.length === 0 || salvando}
                    className="w-full inline-flex items-center justify-center gap-2 rounded-xl bg-brand text-base font-bold h-10 disabled:opacity-40 hover:bg-brand/90 transition-colors"
                  >
                    {salvando && <Loader2 className="w-4 h-4 animate-spin" />} {salvando ? 'Salvando…' : `Confirmar (${fila.length})`}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      </Modal>

      {/* Gerenciar tipos */}
      <Modal open={openTipoModal} onClose={() => setOpenTipoModal(false)} title="Gerenciar tipos de atividade">
        <div className="space-y-3">
          <div className="flex gap-2">
            <input value={novoTipo} onChange={(e) => setNovoTipo(e.target.value)} placeholder="Novo tipo…" className={inputCls} />
            <button
              onClick={salvarNovoTipo}
              disabled={!novoTipo || salvandoTipo}
              className="px-3 rounded-xl bg-brand text-base font-semibold disabled:opacity-40 hover:bg-brand/90 transition-colors"
            >
              <Plus className="w-4 h-4" />
            </button>
          </div>
          <div className="rounded-xl border border-line divide-y divide-line-soft overflow-hidden">
            {tiposCustomizados.map((tipo) => (
              <div key={tipo.id} className="flex justify-between items-center p-2.5 bg-base">
                <span className="text-sm font-medium text-ink">{tipo.nome}</span>
                <button onClick={() => excluirTipo(tipo.id)} className="p-1 text-ink-faint hover:text-rose">
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            ))}
            {tiposCustomizados.length === 0 && <div className="p-3 text-xs text-ink-faint italic">Nenhum tipo personalizado ainda.</div>}
          </div>
        </div>
      </Modal>

      {/* Concluir atividade */}
      <Modal open={!!concluirModal} onClose={() => setConcluirModal(null)} title="Concluir atividade" description="Escolha a data em que isso realmente aconteceu — é ela que joga o custo no mês certo do Financeiro.">
        {concluirModal && (
          <div className="space-y-4">
            <div className="p-3 rounded-xl bg-base border border-line-soft">
              <p className="text-sm font-semibold text-ink">{concluirModal.tipo === 'outro' ? concluirModal.tipo_personalizado : getTipoLabel(concluirModal.tipo)}</p>
              <p className="text-xs text-ink-faint">
                {getTalhaoNome(concluirModal.talhao_id)} · Custo: {formatBRL(concluirModal.custo_total)}
              </p>
            </div>
            <div>
              <label className={labelCls}>Data real de realização</label>
              <input type="date" value={dataConclusao} onChange={(e) => setDataConclusao(e.target.value)} className={inputCls} />
            </div>
            <button
              onClick={confirmarConclusao}
              disabled={salvando}
              className="w-full inline-flex items-center justify-center gap-2 rounded-xl bg-brand text-base font-bold h-11 disabled:opacity-40 hover:bg-brand/90 transition-colors"
            >
              {salvando && <Loader2 className="w-4 h-4 animate-spin" />} {salvando ? 'Salvando…' : 'Confirmar conclusão'}
            </button>
          </div>
        )}
      </Modal>

      {/* Ver texto (WhatsApp) */}
      <Modal open={!!textoModal} onClose={() => setTextoModal(null)} title="Resumo da atividade" description="Copie para enviar ao encarregado.">
        <div className="space-y-3">
          <div className="bg-base p-3 rounded-xl border border-line-soft max-h-[300px] overflow-y-auto">
            <pre className="whitespace-pre-wrap text-xs font-mono text-ink">{textoModal}</pre>
          </div>
          <button
            onClick={copiarTexto}
            className="w-full inline-flex items-center justify-center gap-2 rounded-xl bg-brand text-base font-bold h-10 hover:bg-brand/90 transition-colors"
          >
            <Send className="w-4 h-4" /> Copiar texto
          </button>
        </div>
      </Modal>
    </div>
  );
}
