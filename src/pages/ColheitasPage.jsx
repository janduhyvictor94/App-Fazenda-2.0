import React, { useEffect, useMemo, useState } from 'react';
import { Wheat, Plus, Edit, Trash2, X, ListPlus, ClipboardList, Loader2, AlertTriangle, Scale, Package, Box } from 'lucide-react';
import { usePeriodo } from '../context/PeriodoContext.jsx';
import HistoryAccordion from '../components/HistoryAccordion.jsx';
import KpiCard from '../components/KpiCard.jsx';
import Modal from '../components/Modal.jsx';
import { colheitasDoAno, colheitasDaSafra, receitaColheitas, parseNumber } from '../lib/data.js';
import { formatBRL, formatKg } from '../lib/format.js';
import { supabase } from '../lib/supabaseClient.js';

// Tipos padrão por cultura — mesmos valores/rótulos da produção (Colheitas.jsx).
// Tipos extras podem ser cadastrados na tabela `tipos_colheita` (dialog "Novo tipo").
const TIPOS_MANGA = [
  { value: 'exportacao', label: 'Exportação' },
  { value: 'mercado_interno', label: 'Mercado Interno' },
  { value: 'caixas', label: 'Caixas' },
  { value: 'arrastao', label: 'Arrastão' },
  { value: 'polpa', label: 'Polpa' }
];
const TIPOS_GOIABA = [
  { value: 'caixa_verde', label: 'Caixa Verde' },
  { value: 'madura', label: 'Madura' },
  { value: 'polpa', label: 'Polpa' }
];

function formatCaixas(v) {
  return `${(v || 0).toLocaleString('pt-BR')} cx`;
}

function formVazioItem(hoje) {
  return {
    talhao_id: '',
    data: hoje,
    cultura: '',
    tipo_colheita: '',
    quantidade_kg: '',
    quantidade_caixas: '',
    preco_unitario: '',
    unidade_preco: 'kg',
    custo_colheita: '',
    unidade_custo: 'kg',
    observacoes: ''
  };
}
function linhaRapidaVazia() {
  return { tipo_colheita: '', quantidade_kg: '', quantidade_caixas: '', preco_unitario: '', unidade_preco: 'kg' };
}

const inputCls = 'w-full rounded-lg bg-base border border-line px-3 py-2 text-sm text-ink';
const labelCls = 'text-[11px] uppercase tracking-wide text-ink-faint font-semibold block mb-1';

export default function ColheitasPage({ dados, recarregar }) {
  const { modo, ano, safraSelecionada } = usePeriodo();
  const { talhoes, colheitas, custos, culturas } = dados;
  const hoje = new Date().toISOString().slice(0, 10);

  const getTalhaoNome = (id) => talhoes.find((t) => String(t.id) === String(id))?.nome || 'Talhão';

  // Custos de colheita (categoria 'colheita') — só pra mostrar/agrupar o custo do
  // dia junto com a produção; a gravação de verdade é feita junto com o cadastro.
  const custosColheita = useMemo(() => (custos || []).filter((c) => c.categoria === 'colheita'), [custos]);

  // Tipos de colheita customizados (tabela `tipos_colheita`, igual produção) —
  // buscado à parte pra não mexer em fetchFazendaData/App.jsx.
  const [tiposCustomizados, setTiposCustomizados] = useState([]);
  useEffect(() => {
    supabase
      .from('tipos_colheita')
      .select('*')
      .then(({ data, error }) => {
        if (!error) setTiposCustomizados(data || []);
      });
  }, []);

  // --- estado do formulário de cadastro ---
  const [open, setOpen] = useState(false);
  const [editando, setEditando] = useState(null);
  const [modoRapido, setModoRapido] = useState(false);
  const [formItem, setFormItem] = useState(formVazioItem(hoje));
  const [fila, setFila] = useState([]);
  const [lotesCusto, setLotesCusto] = useState([]);
  const [linhasRapidas, setLinhasRapidas] = useState([linhaRapidaVazia()]);
  const [custoRapido, setCustoRapido] = useState({ valor: '', unidade: 'kg' });
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState(null);

  const [openTipoModal, setOpenTipoModal] = useState(false);
  const [novoTipo, setNovoTipo] = useState({ nome: '', cultura: '' });
  const [salvandoTipo, setSalvandoTipo] = useState(false);

  function tipoColheitaLabel(tipo) {
    const padrao = [...TIPOS_MANGA, ...TIPOS_GOIABA].find((t) => t.value === tipo);
    if (padrao) return padrao.label;
    const custom = tiposCustomizados.find((t) => t.nome === tipo);
    return custom ? custom.nome : tipo;
  }

  const tiposDisponiveis = useMemo(() => {
    const padrao = formItem.cultura === 'manga' ? TIPOS_MANGA : formItem.cultura === 'goiaba' ? TIPOS_GOIABA : [];
    const custom = tiposCustomizados
      .filter((t) => t.cultura === formItem.cultura)
      .map((t) => ({ value: t.nome, label: t.nome }));
    return [...padrao, ...custom];
  }, [formItem.cultura, tiposCustomizados]);

  function resetForm() {
    setFormItem(formVazioItem(hoje));
    setEditando(null);
    setFila([]);
    setLotesCusto([]);
    setModoRapido(false);
    setLinhasRapidas([linhaRapidaVazia()]);
    setCustoRapido({ valor: '', unidade: 'kg' });
    setErro(null);
    setOpen(false);
  }

  function abrirNova() {
    resetForm();
    setOpen(true);
  }

  function abrirEdicao(c) {
    setEditando(c);
    setFormItem({
      talhao_id: c.talhao_id || '',
      data: c.data || hoje,
      cultura: c.cultura || '',
      tipo_colheita: c.tipo_colheita || '',
      quantidade_kg: c.quantidade_kg ?? '',
      quantidade_caixas: c.quantidade_caixas ?? '',
      preco_unitario: c.preco_unitario ?? '',
      unidade_preco: c.unidade_preco || 'kg',
      custo_colheita: c.custo_colheita ?? '',
      unidade_custo: c.unidade_custo || 'kg',
      observacoes: c.observacoes || ''
    });
    setFila([]);
    setLotesCusto([]);
    setModoRapido(false);
    setErro(null);
    setOpen(true);
  }

  function calcularValorTotalItem(item) {
    const qtd = item.unidade_preco === 'kg' ? parseNumber(item.quantidade_kg) : parseNumber(item.quantidade_caixas);
    return qtd * parseNumber(item.preco_unitario);
  }
  function calcularCustoTotalItem(item) {
    const qtd = item.unidade_custo === 'kg' ? parseNumber(item.quantidade_kg) : parseNumber(item.quantidade_caixas);
    return qtd * parseNumber(item.custo_colheita);
  }

  function adicionarNaFila() {
    if (!formItem.talhao_id || !formItem.data || !formItem.cultura || !formItem.tipo_colheita) {
      setErro('Preencha talhão, data, cultura e tipo para adicionar.');
      return;
    }
    setErro(null);
    const item = {
      ...formItem,
      quantidade_kg: formItem.quantidade_kg ? parseNumber(formItem.quantidade_kg) : null,
      quantidade_caixas: formItem.quantidade_caixas ? parseNumber(formItem.quantidade_caixas) : null,
      preco_unitario: formItem.preco_unitario ? parseNumber(formItem.preco_unitario) : null,
      custo_colheita: formItem.custo_colheita ? parseNumber(formItem.custo_colheita) : null,
      valor_total: calcularValorTotalItem(formItem),
      custoTotalCalc: calcularCustoTotalItem(formItem),
      tempId: Date.now()
    };
    setFila((f) => [...f, item]);
    setFormItem((f) => ({ ...f, quantidade_kg: '', quantidade_caixas: '', preco_unitario: '', custo_colheita: '', observacoes: '' }));
  }

  function removerDaFila(tempId) {
    const item = fila.find((i) => i.tempId === tempId);
    const nova = fila.filter((i) => i.tempId !== tempId);
    setFila(nova);
    if (item?.loteId && !nova.some((i) => i.loteId === item.loteId)) {
      setLotesCusto((l) => l.filter((lo) => lo.loteId !== item.loteId));
    }
  }

  function addLinhaRapida() {
    setLinhasRapidas((l) => [...l, linhaRapidaVazia()]);
  }
  function removerLinhaRapida(i) {
    setLinhasRapidas((l) => l.filter((_, idx) => idx !== i));
  }
  function atualizarLinhaRapida(i, campo, valor) {
    setLinhasRapidas((l) => l.map((linha, idx) => (idx === i ? { ...linha, [campo]: valor } : linha)));
  }

  function adicionarLoteNaFila() {
    if (!formItem.talhao_id || !formItem.data || !formItem.cultura) {
      setErro('Preencha talhão, data e cultura para adicionar.');
      return;
    }
    const validas = linhasRapidas.filter(
      (l) => l.tipo_colheita && (parseNumber(l.quantidade_kg) > 0 || parseNumber(l.quantidade_caixas) > 0)
    );
    if (validas.length === 0) {
      setErro('Preencha ao menos um tipo com quantidade colhida.');
      return;
    }
    setErro(null);
    const loteId = Date.now();
    const novosItens = validas.map((linha, idx) => {
      const qtd = linha.unidade_preco === 'kg' ? parseNumber(linha.quantidade_kg) : parseNumber(linha.quantidade_caixas);
      const preco = parseNumber(linha.preco_unitario);
      return {
        talhao_id: formItem.talhao_id,
        data: formItem.data,
        cultura: formItem.cultura,
        tipo_colheita: linha.tipo_colheita,
        quantidade_kg: linha.quantidade_kg ? parseNumber(linha.quantidade_kg) : null,
        quantidade_caixas: linha.quantidade_caixas ? parseNumber(linha.quantidade_caixas) : null,
        preco_unitario: preco || null,
        unidade_preco: linha.unidade_preco,
        custo_colheita: null,
        unidade_custo: custoRapido.unidade,
        observacoes: formItem.observacoes || '',
        valor_total: qtd * preco,
        loteId,
        tempId: Date.now() + idx
      };
    });

    // Custo único do lote: preço por caixa/kg (igual pra todos os tipos) × soma
    // das quantidades de todos os tipos — mesma regra da produção.
    const custoUnitValor = parseNumber(custoRapido.valor);
    let custoLoteTotal = 0;
    if (custoUnitValor > 0) {
      const somaQtd = validas.reduce(
        (acc, l) => acc + (custoRapido.unidade === 'kg' ? parseNumber(l.quantidade_kg) : parseNumber(l.quantidade_caixas)),
        0
      );
      custoLoteTotal = somaQtd * custoUnitValor;
    }

    setFila((f) => [...f, ...novosItens]);
    if (custoLoteTotal > 0) {
      const resumoTipos = validas.map((l) => tipoColheitaLabel(l.tipo_colheita)).join(' + ');
      setLotesCusto((l) => [
        ...l,
        { loteId, talhao_id: formItem.talhao_id, data: formItem.data, valor: custoLoteTotal, custoUnit: custoUnitValor, unidade: custoRapido.unidade, resumoTipos }
      ]);
    }
    setLinhasRapidas([linhaRapidaVazia()]);
    setCustoRapido({ valor: '', unidade: 'kg' });
    setFormItem((f) => ({ ...f, observacoes: '' }));
  }

  async function salvarEdicao(e) {
    e.preventDefault();
    setSalvando(true);
    setErro(null);
    try {
      const payload = {
        talhao_id: formItem.talhao_id,
        data: formItem.data,
        cultura: formItem.cultura,
        tipo_colheita: formItem.tipo_colheita,
        quantidade_kg: formItem.quantidade_kg ? parseNumber(formItem.quantidade_kg) : null,
        quantidade_caixas: formItem.quantidade_caixas ? parseNumber(formItem.quantidade_caixas) : null,
        preco_unitario: formItem.preco_unitario ? parseNumber(formItem.preco_unitario) : null,
        unidade_preco: formItem.unidade_preco,
        custo_colheita: formItem.custo_colheita ? parseNumber(formItem.custo_colheita) : null,
        unidade_custo: formItem.unidade_custo,
        observacoes: formItem.observacoes,
        valor_total: calcularValorTotalItem(formItem)
      };
      const { error } = await supabase.from('colheitas').update(payload).eq('id', editando.id);
      if (error) throw error;
      resetForm();
      await recarregar();
    } catch (err) {
      setErro(err.message || 'Não foi possível salvar as alterações.');
    } finally {
      setSalvando(false);
    }
  }

  async function salvarFila() {
    if (fila.length === 0) return;
    setSalvando(true);
    setErro(null);
    try {
      const payloadColheitas = fila.map(({ tempId, custoTotalCalc, loteId, ...rest }) => rest);
      const { error } = await supabase.from('colheitas').insert(payloadColheitas);
      if (error) throw error;

      // Custo de itens avulsos (modo padrão, um por registro).
      const custosIndividuais = fila
        .filter((item) => !item.loteId && item.custoTotalCalc > 0)
        .map((item) => ({
          descricao: `Colheita - ${tipoColheitaLabel(item.tipo_colheita)} - ${getTalhaoNome(item.talhao_id)}`,
          categoria: 'colheita',
          talhao_id: item.talhao_id,
          valor: item.custoTotalCalc,
          data: item.data,
          observacoes: `Custo de colheita: R$ ${item.custo_colheita}/${item.unidade_custo}`
        }));
      // Custo de lote (modo rápido: vários tipos no mesmo dia, um único custo combinado).
      const custosDeLotes = lotesCusto
        .filter((l) => l.valor > 0)
        .map((lote) => ({
          descricao: `Colheita - ${lote.resumoTipos} - ${getTalhaoNome(lote.talhao_id)}`,
          categoria: 'colheita',
          talhao_id: lote.talhao_id,
          valor: lote.valor,
          data: lote.data,
          observacoes: `Custo de colheita (lote, vários tipos): R$ ${lote.custoUnit}/${lote.unidade}`
        }));

      const custosParaInserir = [...custosIndividuais, ...custosDeLotes];
      if (custosParaInserir.length > 0) {
        // Só bloqueia se já existir um custo IDÊNTICO (mesmo talhão, dia, valor) —
        // sinal forte de reenvio acidental. Não bloqueia lançamentos legítimos
        // diferentes no mesmo dia.
        const talhoesEnvolvidos = [...new Set(custosParaInserir.map((c) => c.talhao_id))];
        const { data: existentes } = await supabase
          .from('custos')
          .select('talhao_id, data, valor')
          .eq('categoria', 'colheita')
          .in('talhao_id', talhoesEnvolvidos);
        const ehDuplicataExata = (novo) =>
          (existentes || []).some(
            (e) => e.talhao_id === novo.talhao_id && e.data === novo.data && Math.abs((e.valor || 0) - novo.valor) < 0.01
          );
        const custosNovos = custosParaInserir.filter((c) => !ehDuplicataExata(c));
        const ignorados = custosParaInserir.length - custosNovos.length;
        if (custosNovos.length > 0) {
          const { error: errCustos } = await supabase.from('custos').insert(custosNovos);
          if (errCustos) throw errCustos;
        }
        if (ignorados > 0) {
          alert(
            `As colheitas foram registradas normalmente, mas ${ignorados} custo(s) de colheita não foram lançados porque já existia um custo idêntico (mesmo talhão, dia e valor). Confira no Financeiro se precisar ajustar.`
          );
        }
      }
      resetForm();
      await recarregar();
    } catch (err) {
      setErro(err.message || 'Não foi possível salvar as colheitas.');
    } finally {
      setSalvando(false);
    }
  }

  async function excluirColheita(id) {
    if (!confirm('Excluir esta colheita? Essa ação não pode ser desfeita.')) return;
    try {
      const { error } = await supabase.from('colheitas').delete().eq('id', id);
      if (error) throw error;
      await recarregar();
    } catch (err) {
      alert(`Não foi possível excluir a colheita.\n\nMotivo: ${err.message || 'Erro desconhecido'}`);
    }
  }

  async function salvarNovoTipo() {
    if (!novoTipo.nome || !novoTipo.cultura) return;
    setSalvandoTipo(true);
    try {
      const { data, error } = await supabase.from('tipos_colheita').insert(novoTipo).select();
      if (error) throw error;
      setTiposCustomizados((t) => [...t, ...(data || [])]);
      setNovoTipo({ nome: '', cultura: '' });
      setOpenTipoModal(false);
    } catch (err) {
      alert(`Não foi possível criar o tipo.\n\nMotivo: ${err.message || 'Erro desconhecido'}`);
    } finally {
      setSalvandoTipo(false);
    }
  }

  // --- visualização (leitura) ---
  const escopo = useMemo(() => {
    if (modo === 'safra' && safraSelecionada) {
      return { lista: colheitasDaSafra({ colheitas, safra: safraSelecionada }), label: safraSelecionada.nome };
    }
    return { lista: colheitasDoAno({ colheitas, ano }), label: `Ano ${ano}` };
  }, [modo, ano, safraSelecionada, colheitas]);

  const porTalhao = useMemo(() => {
    const grupos = {};
    escopo.lista.forEach((c) => {
      const key = c.talhao_id || 'sem-talhao';
      if (!grupos[key]) grupos[key] = [];
      grupos[key].push(c);
    });
    return Object.entries(grupos).sort((a, b) => b[1].length - a[1].length);
  }, [escopo]);

  // Agrupa por dia + talhão — se colheu caixa verde, madura e polpa no mesmo
  // dia/área, isso vira UM bloco (com o total do dia: kg, caixas e receita),
  // em vez de uma linha solta por tipo. Mesma ideia da produção.
  function agruparPorDia(lista) {
    const mapa = {};
    lista.forEach((c) => {
      const chave = `${c.data || 'sem-data'}|${c.talhao_id || 'sem-talhao'}`;
      if (!mapa[chave]) {
        mapa[chave] = { chave, data: c.data, talhao_id: c.talhao_id, itens: [], totalKg: 0, totalCaixas: 0, totalReceita: 0 };
      }
      mapa[chave].itens.push(c);
      mapa[chave].totalKg += parseNumber(c.quantidade_kg);
      mapa[chave].totalCaixas += parseNumber(c.quantidade_caixas);
      mapa[chave].totalReceita += parseNumber(c.valor_total);
    });
    return Object.values(mapa)
      .map((g) => ({
        ...g,
        custoDoDia: custosColheita
          .filter((cc) => cc.talhao_id === g.talhao_id && cc.data === g.data)
          .reduce((acc, cc) => acc + parseNumber(cc.valor), 0)
      }))
      .sort((a, b) => (b.data || '').localeCompare(a.data || ''));
  }

  const totalKg = escopo.lista.reduce((acc, c) => acc + parseNumber(c.quantidade_kg), 0);
  const totalCaixas = escopo.lista.reduce((acc, c) => acc + parseNumber(c.quantidade_caixas), 0);
  const totalValor = receitaColheitas(escopo.lista);

  const historicoAnos = useMemo(() => {
    if (modo !== 'ano') return [];
    const anos = new Set();
    colheitas.forEach((c) => c.data && anos.add(Number(c.data.slice(0, 4))));
    return Array.from(anos)
      .filter((a) => a !== Number(ano))
      .sort((a, b) => b - a)
      .slice(0, 6);
  }, [colheitas, ano, modo]);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-ink-faint">
          Colheitas de <span className="text-brand font-semibold">{escopo.label}</span>, agrupadas por talhão e por dia.
        </p>
        <button
          onClick={abrirNova}
          className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-brand text-base font-semibold text-sm hover:bg-brand/90 transition-colors"
        >
          <Plus className="w-4 h-4" /> Registrar colheita
        </button>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <KpiCard label="Total colhido" value={formatKg(totalKg)} icon={Package} tone="brand" />
        <KpiCard label="Total em caixas" value={formatCaixas(totalCaixas)} icon={Box} tone="tech" />
        <KpiCard label="Receita de colheitas" value={formatBRL(totalValor)} icon={Scale} tone="tech" />
        <KpiCard label="Lançamentos" value={String(escopo.lista.length)} icon={Wheat} tone="neutral" />
      </div>

      <div className="space-y-3">
        {porTalhao.map(([talhaoId, lista]) => {
          const nome = getTalhaoNome(talhaoId);
          const subtotal = receitaColheitas(lista);
          const dias = agruparPorDia(lista);
          return (
            <HistoryAccordion
              key={talhaoId}
              title={nome}
              subtitle={`${lista.length} colheita${lista.length > 1 ? 's' : ''}`}
              right={formatBRL(subtotal)}
              defaultOpen
            >
              <div className="space-y-2">
                {dias.map((dia) => (
                  <div key={dia.chave} className="rounded-lg bg-base border border-line-soft p-3">
                    <div className="flex items-center justify-between gap-3">
                      <div className="min-w-0">
                        <div className="text-sm font-semibold text-ink">{dia.data}</div>
                        <div className="text-xs text-ink-faint">
                          {dia.itens.length === 1 ? tipoColheitaLabel(dia.itens[0].tipo_colheita) : `${dia.itens.length} tipos`}
                        </div>
                      </div>
                      <div className="text-right shrink-0">
                        <div className="flex items-center justify-end gap-2 flex-wrap">
                          {dia.totalKg > 0 && <span className="text-xs font-semibold text-ink tabular">{formatKg(dia.totalKg)}</span>}
                          {dia.totalCaixas > 0 && (
                            <span className="text-[11px] font-semibold text-tech bg-tech/10 px-1.5 py-0.5 rounded">
                              {formatCaixas(dia.totalCaixas)}
                            </span>
                          )}
                        </div>
                        <div className="text-sm font-semibold tabular text-brand mt-0.5">{formatBRL(dia.totalReceita)}</div>
                        {dia.custoDoDia > 0 && <div className="text-[11px] text-rose tabular">custo: {formatBRL(dia.custoDoDia)}</div>}
                      </div>
                    </div>
                    <div className="mt-2 pt-2 border-t border-line-soft space-y-1.5">
                      {dia.itens.map((c) => (
                        <div key={c.id} className="flex items-center justify-between gap-2 text-xs">
                          <span className="text-ink-muted">{tipoColheitaLabel(c.tipo_colheita)}</span>
                          <div className="flex items-center gap-2 shrink-0">
                            {c.quantidade_kg > 0 && <span className="text-ink-faint tabular">{formatKg(c.quantidade_kg)}</span>}
                            {c.quantidade_caixas > 0 && <span className="text-ink-faint tabular">{formatCaixas(c.quantidade_caixas)}</span>}
                            <span className="text-ink font-medium tabular">{formatBRL(c.valor_total)}</span>
                            <button onClick={() => abrirEdicao(c)} className="p-1 text-ink-faint hover:text-ink">
                              <Edit className="w-3.5 h-3.5" />
                            </button>
                            <button onClick={() => excluirColheita(c.id)} className="p-1 text-ink-faint hover:text-rose">
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </HistoryAccordion>
          );
        })}
        {porTalhao.length === 0 && <p className="text-sm text-ink-faint italic">Nenhuma colheita neste período.</p>}
      </div>

      {historicoAnos.length > 0 && (
        <div className="space-y-2.5">
          <div className="flex items-center gap-2">
            <h3 className="font-display font-semibold text-sm text-ink">Histórico de anos anteriores</h3>
            <span className="text-[10px] uppercase tracking-wide text-ink-faint bg-line-soft px-2 py-0.5 rounded-full">
              recolhido por padrão
            </span>
          </div>
          {historicoAnos.map((a) => {
            const lista = colheitasDoAno({ colheitas, ano: a });
            return (
              <HistoryAccordion
                key={a}
                title={`Ano ${a}`}
                subtitle={`${lista.length} colheitas · ${formatKg(lista.reduce((acc, c) => acc + parseNumber(c.quantidade_kg), 0))}`}
                right={formatBRL(receitaColheitas(lista))}
              >
                <div className="space-y-2">
                  {agruparPorDia(lista).map((dia) => (
                    <div key={dia.chave} className="flex items-center justify-between gap-3 py-2 border-b border-line-soft last:border-0 text-sm">
                      <div className="min-w-0">
                        <div className="text-ink truncate">
                          {getTalhaoNome(dia.talhao_id)} <span className="text-ink-faint">· {dia.data}</span>
                        </div>
                      </div>
                      <div className="text-right shrink-0">
                        <div className="font-semibold tabular text-brand">{formatBRL(dia.totalReceita)}</div>
                        <div className="text-xs text-ink-faint tabular">
                          {dia.totalKg > 0 ? formatKg(dia.totalKg) : formatCaixas(dia.totalCaixas)}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </HistoryAccordion>
            );
          })}
        </div>
      )}

      {/* Modal de cadastro */}
      <Modal
        open={open}
        onClose={resetForm}
        title={editando ? 'Editar colheita' : 'Registrar colheita'}
        description={editando ? 'Dados de produção colhida.' : 'Adicione uma ou mais colheitas à lista e salve tudo de uma vez.'}
        maxWidth="max-w-3xl"
      >
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
          <div className="lg:col-span-2 space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={labelCls}>Talhão</label>
                <select
                  value={formItem.talhao_id}
                  onChange={(e) => setFormItem((f) => ({ ...f, talhao_id: e.target.value }))}
                  className={inputCls}
                >
                  <option value="">Selecione…</option>
                  {talhoes.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.nome}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className={labelCls}>Data</label>
                <input
                  type="date"
                  value={formItem.data}
                  onChange={(e) => setFormItem((f) => ({ ...f, data: e.target.value }))}
                  className={inputCls}
                />
              </div>
            </div>

            {!editando && (
              <div className="flex items-center gap-1 bg-base p-1 rounded-xl border border-line w-fit">
                <button
                  type="button"
                  onClick={() => setModoRapido(false)}
                  className={`px-3 h-8 rounded-lg text-sm font-bold transition-colors ${!modoRapido ? 'bg-surface-raised text-ink' : 'text-ink-faint hover:text-ink'}`}
                >
                  Padrão
                </button>
                <button
                  type="button"
                  onClick={() => setModoRapido(true)}
                  className={`px-3 h-8 rounded-lg text-sm font-bold transition-colors ${modoRapido ? 'bg-surface-raised text-ink' : 'text-ink-faint hover:text-ink'}`}
                >
                  Rápido (vários tipos)
                </button>
              </div>
            )}
            {modoRapido && !editando && (
              <p className="text-xs text-ink-faint -mt-1">
                Pra dias com mais de um tipo de colheita (ex: caixa verde + madura + polpa) no mesmo talhão. O custo de
                colheita é o mesmo por caixa/kg pra todos, então você informa uma vez só e ele soma tudo.
              </p>
            )}

            {(!modoRapido || editando) && (
              <>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className={labelCls}>Cultura</label>
                    <select
                      value={formItem.cultura}
                      onChange={(e) => setFormItem((f) => ({ ...f, cultura: e.target.value, tipo_colheita: '' }))}
                      className={inputCls}
                    >
                      <option value="">Selecione…</option>
                      {(culturas || []).map((c) => (
                        <option key={c.id} value={c.nome}>
                          {c.nome}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <label className={labelCls + ' mb-0'}>Tipo</label>
                      <button
                        type="button"
                        onClick={() => setOpenTipoModal(true)}
                        disabled={!formItem.cultura}
                        className="text-[11px] text-tech hover:text-tech/80 disabled:opacity-40 flex items-center gap-1"
                      >
                        <Plus className="w-3 h-3" /> Novo
                      </button>
                    </div>
                    <select
                      value={formItem.tipo_colheita}
                      onChange={(e) => setFormItem((f) => ({ ...f, tipo_colheita: e.target.value }))}
                      disabled={!formItem.cultura}
                      className={inputCls}
                    >
                      <option value="">Selecione…</option>
                      {tiposDisponiveis.map((t) => (
                        <option key={t.value} value={t.value}>
                          {t.label}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className={labelCls}>Qtd (kg)</label>
                    <input
                      type="number"
                      step="0.01"
                      value={formItem.quantidade_kg}
                      onChange={(e) => setFormItem((f) => ({ ...f, quantidade_kg: e.target.value }))}
                      placeholder="Ex: 1500"
                      className={inputCls}
                    />
                  </div>
                  <div>
                    <label className={labelCls}>Qtd (caixas)</label>
                    <input
                      type="number"
                      value={formItem.quantidade_caixas}
                      onChange={(e) => setFormItem((f) => ({ ...f, quantidade_caixas: e.target.value }))}
                      placeholder="Ex: 100"
                      className={inputCls}
                    />
                  </div>
                </div>

                <div className="p-3 rounded-xl bg-base border border-line-soft space-y-2.5">
                  <label className="text-xs font-semibold text-ink-muted">Dados financeiros (venda)</label>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className={labelCls}>Preço unit. (R$)</label>
                      <input
                        type="number"
                        step="0.01"
                        value={formItem.preco_unitario}
                        onChange={(e) => setFormItem((f) => ({ ...f, preco_unitario: e.target.value }))}
                        className={inputCls}
                      />
                    </div>
                    <div>
                      <label className={labelCls}>Unidade</label>
                      <select
                        value={formItem.unidade_preco}
                        onChange={(e) => setFormItem((f) => ({ ...f, unidade_preco: e.target.value }))}
                        className={inputCls}
                      >
                        <option value="kg">Por kg</option>
                        <option value="caixa">Por caixa</option>
                      </select>
                    </div>
                  </div>
                  <div className="flex items-center justify-between text-sm pt-1">
                    <span className="text-ink-faint">Receita total:</span>
                    <span className="font-semibold text-brand">{formatBRL(calcularValorTotalItem(formItem))}</span>
                  </div>
                </div>

                <div className="p-3 rounded-xl bg-rose/5 border border-rose/20 space-y-2.5">
                  <label className="text-xs font-semibold text-rose">Custo da colheita (terceirizado)</label>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className={labelCls}>Custo unit. (R$)</label>
                      <input
                        type="number"
                        step="0.01"
                        value={formItem.custo_colheita}
                        onChange={(e) => setFormItem((f) => ({ ...f, custo_colheita: e.target.value }))}
                        className={inputCls}
                      />
                    </div>
                    <div>
                      <label className={labelCls}>Unidade</label>
                      <select
                        value={formItem.unidade_custo}
                        onChange={(e) => setFormItem((f) => ({ ...f, unidade_custo: e.target.value }))}
                        className={inputCls}
                      >
                        <option value="kg">Por kg</option>
                        <option value="caixa">Por caixa</option>
                      </select>
                    </div>
                  </div>
                  <div className="flex items-center justify-between text-sm pt-1">
                    <span className="text-ink-faint">Custo total:</span>
                    <span className="font-semibold text-rose">{formatBRL(calcularCustoTotalItem(formItem))}</span>
                  </div>
                </div>
              </>
            )}

            {modoRapido && !editando && (
              <>
                <div>
                  <label className={labelCls}>Cultura</label>
                  <select
                    value={formItem.cultura}
                    onChange={(e) => setFormItem((f) => ({ ...f, cultura: e.target.value }))}
                    className={inputCls}
                  >
                    <option value="">Selecione…</option>
                    {(culturas || []).map((c) => (
                      <option key={c.id} value={c.nome}>
                        {c.nome}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-semibold text-ink-muted">Tipos colhidos nesse dia</label>
                    <button
                      type="button"
                      onClick={addLinhaRapida}
                      disabled={!formItem.cultura}
                      className="text-[11px] text-tech hover:text-tech/80 disabled:opacity-40 flex items-center gap-1"
                    >
                      <Plus className="w-3 h-3" /> Adicionar tipo
                    </button>
                  </div>
                  {linhasRapidas.map((linha, idx) => (
                    <div key={idx} className="p-2.5 rounded-lg bg-base border border-line-soft flex flex-col md:flex-row gap-2 md:items-center">
                      <select
                        value={linha.tipo_colheita}
                        onChange={(e) => atualizarLinhaRapida(idx, 'tipo_colheita', e.target.value)}
                        disabled={!formItem.cultura}
                        className="flex-1 rounded-lg bg-surface-raised border border-line px-2 py-1.5 text-xs text-ink"
                      >
                        <option value="">Tipo…</option>
                        {tiposDisponiveis.map((t) => (
                          <option key={t.value} value={t.value}>
                            {t.label}
                          </option>
                        ))}
                      </select>
                      <input
                        type="number"
                        step="0.01"
                        placeholder="Qtd (kg)"
                        value={linha.quantidade_kg}
                        onChange={(e) => atualizarLinhaRapida(idx, 'quantidade_kg', e.target.value)}
                        className="w-full md:w-24 rounded-lg bg-surface-raised border border-line px-2 py-1.5 text-xs text-ink"
                      />
                      <input
                        type="number"
                        placeholder="Qtd (cx)"
                        value={linha.quantidade_caixas}
                        onChange={(e) => atualizarLinhaRapida(idx, 'quantidade_caixas', e.target.value)}
                        className="w-full md:w-24 rounded-lg bg-surface-raised border border-line px-2 py-1.5 text-xs text-ink"
                      />
                      <input
                        type="number"
                        step="0.01"
                        placeholder="Preço venda"
                        value={linha.preco_unitario}
                        onChange={(e) => atualizarLinhaRapida(idx, 'preco_unitario', e.target.value)}
                        className="w-full md:w-24 rounded-lg bg-surface-raised border border-line px-2 py-1.5 text-xs text-ink"
                      />
                      <select
                        value={linha.unidade_preco}
                        onChange={(e) => atualizarLinhaRapida(idx, 'unidade_preco', e.target.value)}
                        className="w-full md:w-28 rounded-lg bg-surface-raised border border-line px-2 py-1.5 text-xs text-ink"
                      >
                        <option value="kg">R$/kg</option>
                        <option value="caixa">R$/caixa</option>
                      </select>
                      {linhasRapidas.length > 1 && (
                        <button type="button" onClick={() => removerLinhaRapida(idx)} className="p-1.5 text-ink-faint hover:text-rose shrink-0">
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  ))}
                </div>

                <div className="p-3 rounded-xl bg-rose/5 border border-rose/20 space-y-2.5">
                  <label className="text-xs font-semibold text-rose">Custo de colheita do dia (terceirizado)</label>
                  <p className="text-[11px] text-ink-faint -mt-1">
                    Um valor só, aplicado sobre a soma de {custoRapido.unidade === 'kg' ? 'kg' : 'caixas'} de todos os tipos acima.
                  </p>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className={labelCls}>Custo unit. (R$)</label>
                      <input
                        type="number"
                        step="0.01"
                        value={custoRapido.valor}
                        onChange={(e) => setCustoRapido((c) => ({ ...c, valor: e.target.value }))}
                        className={inputCls}
                      />
                    </div>
                    <div>
                      <label className={labelCls}>Unidade</label>
                      <select
                        value={custoRapido.unidade}
                        onChange={(e) => setCustoRapido((c) => ({ ...c, unidade: e.target.value }))}
                        className={inputCls}
                      >
                        <option value="kg">Por kg</option>
                        <option value="caixa">Por caixa</option>
                      </select>
                    </div>
                  </div>
                </div>
              </>
            )}

            <div>
              <label className={labelCls}>Observações</label>
              <textarea
                value={formItem.observacoes}
                onChange={(e) => setFormItem((f) => ({ ...f, observacoes: e.target.value }))}
                rows={2}
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
                <button
                  type="button"
                  onClick={resetForm}
                  className="px-4 py-2.5 rounded-xl bg-line-soft text-ink text-sm font-medium hover:bg-line transition-colors"
                >
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
            ) : modoRapido ? (
              <button
                type="button"
                onClick={adicionarLoteNaFila}
                className="w-full inline-flex items-center justify-center gap-2 rounded-xl bg-tech text-base font-bold h-11 hover:bg-tech/90 transition-colors"
              >
                <ListPlus className="w-4 h-4" /> Adicionar todos os tipos à lista
              </button>
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
              <ClipboardList className="w-4 h-4" /> Lista ({fila.length})
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
                    <div className="text-center text-ink-faint text-xs py-8 italic">
                      Preencha o formulário e clique em "Adicionar à lista".
                    </div>
                  ) : (
                    fila.map((item) => (
                      <div key={item.tempId} className="bg-surface-raised p-2.5 rounded-xl border border-line text-xs relative">
                        <button onClick={() => removerDaFila(item.tempId)} className="absolute top-2 right-2 text-ink-faint hover:text-rose">
                          <X className="w-3.5 h-3.5" />
                        </button>
                        <div className="font-bold text-brand">{getTalhaoNome(item.talhao_id)}</div>
                        <div className="font-medium text-ink">{tipoColheitaLabel(item.tipo_colheita)}</div>
                        <div className="text-ink-faint mt-0.5">{item.data}</div>
                        <div className="flex gap-2 mt-1 flex-wrap">
                          {item.quantidade_kg > 0 && (
                            <span className="bg-line-soft px-1.5 py-0.5 rounded text-ink-muted font-bold">{formatKg(item.quantidade_kg)}</span>
                          )}
                          {item.quantidade_caixas > 0 && (
                            <span className="bg-tech/10 px-1.5 py-0.5 rounded text-tech font-bold">{formatCaixas(item.quantidade_caixas)}</span>
                          )}
                          {item.loteId && <span className="bg-brand/10 px-1.5 py-0.5 rounded text-brand font-bold">lote</span>}
                        </div>
                        <div className="text-brand font-bold mt-1">Receita: {formatBRL(item.valor_total)}</div>
                        {item.custoTotalCalc > 0 && <div className="text-rose">Custo: {formatBRL(item.custoTotalCalc)}</div>}
                      </div>
                    ))
                  )}
                </div>
                {lotesCusto.length > 0 && (
                  <div className="mt-2.5 pt-2.5 border-t border-line space-y-1">
                    <p className="text-[10px] font-bold text-ink-faint uppercase">Custos de lote (combinados)</p>
                    {lotesCusto.map((lote) => (
                      <div key={lote.loteId} className="text-[11px] text-rose flex justify-between gap-2">
                        <span className="truncate">{lote.resumoTipos}</span>
                        <span className="font-bold shrink-0">{formatBRL(lote.valor)}</span>
                      </div>
                    ))}
                  </div>
                )}
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

      <Modal open={openTipoModal} onClose={() => setOpenTipoModal(false)} title="Novo tipo de colheita">
        <div className="space-y-3">
          <div>
            <label className={labelCls}>Cultura</label>
            <select
              value={novoTipo.cultura}
              onChange={(e) => setNovoTipo((t) => ({ ...t, cultura: e.target.value }))}
              className={inputCls}
            >
              <option value="">Selecione…</option>
              {(culturas || []).map((c) => (
                <option key={c.id} value={c.nome}>
                  {c.nome}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className={labelCls}>Nome do tipo</label>
            <input
              value={novoTipo.nome}
              onChange={(e) => setNovoTipo((t) => ({ ...t, nome: e.target.value }))}
              placeholder="Ex: Premium"
              className={inputCls}
            />
          </div>
          <div className="flex justify-end gap-2.5 pt-1">
            <button
              onClick={() => setOpenTipoModal(false)}
              className="px-4 py-2.5 rounded-xl bg-line-soft text-ink text-sm font-medium hover:bg-line transition-colors"
            >
              Cancelar
            </button>
            <button
              onClick={salvarNovoTipo}
              disabled={!novoTipo.nome || !novoTipo.cultura || salvandoTipo}
              className="px-4 py-2.5 rounded-xl bg-brand text-base font-semibold text-sm disabled:opacity-40 hover:bg-brand/90 transition-colors"
            >
              Criar
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
