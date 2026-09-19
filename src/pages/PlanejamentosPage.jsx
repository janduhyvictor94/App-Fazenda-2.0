import React, { useEffect, useMemo, useState } from 'react';
import {
  Plus,
  Save,
  Trash2,
  Calendar,
  Droplets,
  Leaf,
  ShoppingCart,
  Calculator,
  CircleDot,
  Settings,
  Trees,
  FileText,
  FileSpreadsheet,
  Copy,
  Edit2,
  PlayCircle,
  Send,
  Briefcase,
  Loader2,
  AlertTriangle,
  ListChecks
} from 'lucide-react';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import Modal from '../components/Modal.jsx';
import { salvarPlanejamento, duplicarPlanejamento, excluirPlanejamento, aplicarPlanejamentoNaSafra } from '../lib/data.js';

const cicloLabels = { dia: 'Dia', semana: 'Semana', mes: 'Mês', livre: 'Etapa' };

const metodoConfig = {
  foliar: { label: 'Foliar', icon: Droplets, cls: 'bg-tech/10 border-tech/30 text-tech' },
  adubacao: { label: 'Adubação', icon: Leaf, cls: 'bg-brand/10 border-brand/30 text-brand' },
  terceirizado: { label: 'Terceirizado', icon: Briefcase, cls: 'bg-amber/10 border-amber/30 text-amber' }
};

const inputCls = 'w-full rounded-lg bg-base border border-line px-3 py-2 text-sm text-ink';
const smallInputCls = 'rounded-lg bg-surface border border-line px-2.5 py-1.5 text-xs text-ink';

export default function PlanejamentosPage({ dados, recarregar }) {
  const { insumos = [], planejamentos = [], safras = [], talhoes = [], culturas = [] } = dados;
  const safrasAtivas = useMemo(() => safras.filter((s) => s.status === 'ativo'), [safras]);

  const [activePlanId, setActivePlanId] = useState('novo');
  const [openNovaPlanilha, setOpenNovaPlanilha] = useState(false);
  const [novoPlan, setNovoPlan] = useState({ nome: '', cultura: 'goiaba', tipo_ciclo: 'dia', quantidade_plantas: '' });

  const [planNome, setPlanNome] = useState('');
  const [planCultura, setPlanCultura] = useState('goiaba');
  const [planTipoCiclo, setPlanTipoCiclo] = useState('dia');
  const [planPlantas, setPlanPlantas] = useState('');
  const [planFases, setPlanFases] = useState([]);

  const [openNovaFase, setOpenNovaFase] = useState(false);
  const [novaFaseMomento, setNovaFaseMomento] = useState('');

  const [openApplyModal, setOpenApplyModal] = useState(false);
  const [applySafraId, setApplySafraId] = useState('');
  const [applyStartDate, setApplyStartDate] = useState(new Date().toISOString().slice(0, 10));

  const [salvando, setSalvando] = useState(false);
  const [duplicando, setDuplicando] = useState(false);
  const [excluindo, setExcluindo] = useState(false);
  const [aplicando, setAplicando] = useState(false);
  const [erro, setErro] = useState(null);
  const [erroAplicar, setErroAplicar] = useState(null);
  const [mensagem, setMensagem] = useState(null);

  useEffect(() => {
    if (activePlanId && activePlanId !== 'novo') {
      const plan = planejamentos.find((p) => p.id === activePlanId);
      if (plan) {
        setPlanNome(plan.nome);
        setPlanCultura(plan.cultura);
        setPlanTipoCiclo(plan.dados?.tipo_ciclo || 'dia');
        setPlanPlantas(plan.dados?.quantidade_plantas || '');
        setPlanFases(plan.dados?.fases || []);
      }
    } else {
      setPlanNome('');
      setPlanCultura('goiaba');
      setPlanTipoCiclo('dia');
      setPlanPlantas('');
      setPlanFases([]);
    }
  }, [activePlanId, planejamentos]);

  const getInsumoDetalhes = (id) => insumos.find((i) => i.id === id) || null;

  async function handleCreateNew() {
    if (!novoPlan.nome) {
      setErro('Dê um nome ao planejamento.');
      return;
    }
    setSalvando(true);
    setErro(null);
    try {
      const criado = await salvarPlanejamento({
        payload: {
          nome: novoPlan.nome,
          cultura: novoPlan.cultura,
          dados: { tipo_ciclo: novoPlan.tipo_ciclo, quantidade_plantas: novoPlan.quantidade_plantas, fases: [] }
        }
      });
      await recarregar();
      setActivePlanId(criado.id);
      setOpenNovaPlanilha(false);
      setNovoPlan({ nome: '', cultura: 'goiaba', tipo_ciclo: 'dia', quantidade_plantas: '' });
    } catch (err) {
      setErro(err.message || 'Não foi possível criar o planejamento.');
    } finally {
      setSalvando(false);
    }
  }

  async function handleSaveCurrent() {
    if (activePlanId === 'novo') return;
    setSalvando(true);
    setMensagem(null);
    try {
      await salvarPlanejamento({
        id: activePlanId,
        payload: { nome: planNome, cultura: planCultura, dados: { tipo_ciclo: planTipoCiclo, quantidade_plantas: planPlantas, fases: planFases } }
      });
      await recarregar();
      setMensagem('Planejamento salvo.');
    } catch (err) {
      alert(`Não foi possível salvar o planejamento.\n\nMotivo: ${err.message || 'Erro desconhecido'}`);
    } finally {
      setSalvando(false);
    }
  }

  async function handleDuplicate() {
    const atual = planejamentos.find((p) => p.id === activePlanId);
    if (!atual) return;
    setDuplicando(true);
    try {
      const copia = await duplicarPlanejamento({
        nome: planNome,
        cultura: planCultura,
        dados: { tipo_ciclo: planTipoCiclo, quantidade_plantas: planPlantas, fases: planFases }
      });
      await recarregar();
      setActivePlanId(copia.id);
    } catch (err) {
      alert(`Não foi possível duplicar o planejamento.\n\nMotivo: ${err.message || 'Erro desconhecido'}`);
    } finally {
      setDuplicando(false);
    }
  }

  async function handleDelete() {
    if (!confirm('Excluir este planejamento? Essa ação não pode ser desfeita.')) return;
    setExcluindo(true);
    try {
      await excluirPlanejamento(activePlanId);
      await recarregar();
      setActivePlanId('novo');
    } catch (err) {
      alert(`Não foi possível excluir o planejamento.\n\nMotivo: ${err.message || 'Erro desconhecido'}`);
    } finally {
      setExcluindo(false);
    }
  }

  function handleAddFase() {
    const momento = parseInt(novaFaseMomento, 10);
    if (Number.isNaN(momento)) return;
    if (planFases.some((f) => f.momento === momento)) {
      alert('Esta etapa já existe!');
      return;
    }
    setPlanFases(
      [...planFases, { id: Date.now().toString(), momento, nome_etapa: '', aplicacoes: [] }].sort((a, b) => a.momento - b.momento)
    );
    setNovaFaseMomento('');
    setOpenNovaFase(false);
  }

  const handleRemoveFase = (idFase) => {
    if (confirm('Remover etapa?')) setPlanFases((prev) => prev.filter((f) => f.id !== idFase));
  };
  const handleUpdateFase = (idFase, campo, valor) =>
    setPlanFases((prev) => prev.map((f) => (f.id === idFase ? { ...f, [campo]: valor } : f)));
  const handleAddAplicacao = (idFase) =>
    setPlanFases((prev) =>
      prev.map((f) =>
        f.id === idFase
          ? { ...f, aplicacoes: [...f.aplicacoes, { id: Date.now().toString(), metodo: 'foliar', insumo_id: '', quantidade: '', modo_aplicacao: 'ml/area', descricao_servico: '', valor_estimado: '' }] }
          : f
      )
    );
  const handleUpdateAplicacao = (idFase, idApp, campo, valor) =>
    setPlanFases((prev) =>
      prev.map((f) => (f.id === idFase ? { ...f, aplicacoes: f.aplicacoes.map((a) => (a.id === idApp ? { ...a, [campo]: valor } : a)) } : f))
    );
  const handleRemoveAplicacao = (idFase, idApp) =>
    setPlanFases((prev) => prev.map((f) => (f.id === idFase ? { ...f, aplicacoes: f.aplicacoes.filter((a) => a.id !== idApp) } : f)));

  const resumoCompras = useMemo(() => {
    const map = new Map();
    const plantas = parseInt(planPlantas, 10) || 0;
    let custoTerceirizadoEstimado = 0;

    planFases.forEach((fase) => {
      fase.aplicacoes.forEach((app) => {
        if (app.metodo === 'terceirizado') {
          custoTerceirizadoEstimado += parseFloat(app.valor_estimado) || 0;
        } else if (app.insumo_id && app.quantidade && app.modo_aplicacao) {
          const qtd = parseFloat(app.quantidade) || 0;
          let qtdConvertida = 0;
          let isLitro = false;
          if (app.modo_aplicacao === 'g/planta') qtdConvertida = (qtd * plantas) / 1000;
          else if (app.modo_aplicacao === 'kg/area') qtdConvertida = qtd;
          else if (app.modo_aplicacao === 'ml/area') {
            qtdConvertida = qtd / 1000;
            isLitro = true;
          } else if (app.modo_aplicacao === 'l/area') {
            qtdConvertida = qtd;
            isLitro = true;
          }
          if (qtdConvertida > 0) {
            const existente = map.get(app.insumo_id) || { total_kg_L: 0, isLitro };
            map.set(app.insumo_id, { total_kg_L: existente.total_kg_L + qtdConvertida, isLitro: isLitro || existente.isLitro });
          }
        }
      });
    });

    const resumo = [];
    let custoTotalInsumos = 0;
    map.forEach((data, insumo_id) => {
      const insumo = getInsumoDetalhes(insumo_id);
      if (insumo) {
        const tamanhoEmb = parseFloat(insumo.tamanho_embalagem) || 1;
        const qtdEmbalagensNecessarias = data.total_kg_L / tamanhoEmb;
        const custoEstimado = Math.ceil(qtdEmbalagensNecessarias) * (insumo.preco_unitario || 0);
        custoTotalInsumos += custoEstimado;
        resumo.push({
          ...insumo,
          quantidadeTotalBase: data.total_kg_L,
          qtdEmbalagens: qtdEmbalagensNecessarias,
          unidadeCalculada: data.isLitro ? 'L' : 'kg',
          custoEstimado
        });
      }
    });
    resumo.sort((a, b) => a.nome.localeCompare(b.nome));

    return { itens: resumo, custoTotalInsumos, custoTerceirizadoEstimado, custoGeralEstimado: custoTotalInsumos + custoTerceirizadoEstimado };
  }, [planFases, insumos, planPlantas]);

  function usoTotalStr(app) {
    const qtd = parseFloat(app.quantidade) || 0;
    const plantas = parseInt(planPlantas, 10) || 0;
    if (qtd <= 0) return '-';
    if (app.modo_aplicacao === 'g/planta' && plantas > 0) return `${((qtd * plantas) / 1000).toLocaleString('pt-BR', { maximumFractionDigits: 2 })} kg`;
    if (app.modo_aplicacao === 'kg/area') return `${qtd.toLocaleString('pt-BR', { maximumFractionDigits: 2 })} kg`;
    if (app.modo_aplicacao === 'ml/area') return `${(qtd / 1000).toLocaleString('pt-BR', { maximumFractionDigits: 2 })} L`;
    if (app.modo_aplicacao === 'l/area') return `${qtd.toLocaleString('pt-BR', { maximumFractionDigits: 2 })} L`;
    return '-';
  }

  function generatePDF() {
    const doc = new jsPDF();
    doc.setFontSize(18);
    doc.text(`Planejamento: ${planNome}`, 14, 20);
    doc.setFontSize(11);
    doc.setTextColor(100);
    doc.text(`Cultura: ${planCultura.toUpperCase()} | Ciclo por: ${cicloLabels[planTipoCiclo]}s | Plantas: ${planPlantas || 0}`, 14, 28);
    doc.setFontSize(14);
    doc.setTextColor(0);
    doc.text('Cronograma de Aplicações e Serviços', 14, 40);

    const cronogramaRows = [];
    const prefixoEtapa = planTipoCiclo === 'livre' ? 'Etapa' : cicloLabels[planTipoCiclo];

    planFases.forEach((f) => {
      const phaseName = f.nome_etapa ? ` - ${f.nome_etapa.toUpperCase()}` : '';
      cronogramaRows.push([{ content: `${prefixoEtapa} ${f.momento}${phaseName}`, colSpan: 5, styles: { fillColor: [230, 245, 240], textColor: [6, 78, 59], fontStyle: 'bold', halign: 'left' } }]);
      if (f.aplicacoes.length === 0) {
        cronogramaRows.push([{ content: 'Nenhum item cadastrado.', colSpan: 5, styles: { fontStyle: 'italic', halign: 'center', textColor: [150, 150, 150] } }]);
      } else {
        f.aplicacoes.forEach((app) => {
          if (app.metodo === 'terceirizado') {
            cronogramaRows.push([f.momento.toString(), 'Terceirizado', app.descricao_servico || 'Serviço', `R$ ${parseFloat(app.valor_estimado || 0).toLocaleString('pt-BR')}`, '-']);
          } else {
            const insumo = getInsumoDetalhes(app.insumo_id);
            cronogramaRows.push([f.momento.toString(), app.metodo === 'foliar' ? 'Foliar' : 'Adubação', insumo ? insumo.nome : '-', `${app.quantidade} ${app.modo_aplicacao}`, usoTotalStr(app)]);
          }
        });
      }
    });

    autoTable(doc, { startY: 45, head: [['Etapa', 'Método', 'Insumo/Serviço', 'Dosagem/Valor', 'Uso Total']], body: cronogramaRows, theme: 'grid', headStyles: { fillColor: [16, 185, 129] }, styles: { fontSize: 9 } });
    const finalY = doc.lastAutoTable.finalY || 45;

    doc.setFontSize(14);
    doc.text('Resumo de Compras e Estimativas', 14, finalY + 15);
    const resumoRows = resumoCompras.itens.map((item) => [
      item.nome,
      `R$ ${(item.preco_unitario || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`,
      `${item.quantidadeTotalBase.toLocaleString('pt-BR', { maximumFractionDigits: 2 })} ${item.unidadeCalculada}`,
      `${Math.ceil(item.qtdEmbalagens)} un.`,
      `R$ ${item.custoEstimado.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`
    ]);

    autoTable(doc, {
      startY: finalY + 20,
      head: [['Produto', 'Preço Ref. (Emb)', 'Necessidade', 'Comprar', 'Custo Est.']],
      body: resumoRows,
      foot: [
        ['', '', '', 'Insumos Estimados:', `R$ ${resumoCompras.custoTotalInsumos.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`],
        ['', '', '', 'Serviços Estimados:', `R$ ${resumoCompras.custoTerceirizadoEstimado.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`],
        ['', '', '', 'TOTAL GERAL ESTIMADO:', `R$ ${resumoCompras.custoGeralEstimado.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`]
      ],
      theme: 'grid',
      headStyles: { fillColor: [59, 130, 246] },
      footStyles: { fillColor: [240, 240, 240], textColor: [0, 0, 0], fontStyle: 'bold' },
      styles: { fontSize: 9 }
    });
    doc.save(`Planejamento_${planNome.replace(/\s+/g, '_')}.pdf`);
  }

  function generateExcel() {
    let csv = '﻿';
    const prefixoEtapa = planTipoCiclo === 'livre' ? 'Etapa' : cicloLabels[planTipoCiclo];
    csv += `Planejamento:;${planNome}\n`;
    csv += `Cultura:;${planCultura}\n`;
    csv += `Ciclo por:;${prefixoEtapa}s\n`;
    csv += `Qtd de Plantas:;${planPlantas || 0}\n\n`;
    csv += 'CRONOGRAMA DE APLICACOES\n';
    csv += 'Etapa;Nome da Etapa;Metodo;Produto_ou_Servico;Quantidade_ou_Estimativa;Modo_Aplicacao;Uso_Total\n';
    planFases.forEach((f) => {
      if (f.aplicacoes.length === 0) {
        csv += `${prefixoEtapa} ${f.momento};${f.nome_etapa || '-'};-;-;-;-;-\n`;
      } else {
        f.aplicacoes.forEach((app) => {
          if (app.metodo === 'terceirizado') {
            csv += `${prefixoEtapa} ${f.momento};${f.nome_etapa || '-'};Terceirizado;${app.descricao_servico || 'Servico'};R$ ${app.valor_estimado || 0};Valor Estimado;-\n`;
          } else {
            const insumo = getInsumoDetalhes(app.insumo_id);
            const nomeInsumo = insumo ? insumo.nome : '-';
            const metodo = app.metodo === 'foliar' ? 'Foliar' : 'Adubacao';
            csv += `${prefixoEtapa} ${f.momento};${f.nome_etapa || '-'};${metodo};${nomeInsumo};${app.quantidade};${app.modo_aplicacao};${usoTotalStr(app)}\n`;
          }
        });
      }
    });
    csv += '\nRESUMO DE COMPRAS (INSUMOS)\n';
    csv += 'Produto;Preco Ref. da Embalagem;Necessidade Total;Unidade de Medida;Comprar (Embalagens);Custo Estimado\n';
    resumoCompras.itens.forEach((item) => {
      const preco = (item.preco_unitario || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 });
      const totalBase = item.quantidadeTotalBase.toLocaleString('pt-BR', { maximumFractionDigits: 2 });
      const emb = Math.ceil(item.qtdEmbalagens).toString();
      const custo = item.custoEstimado.toLocaleString('pt-BR', { minimumFractionDigits: 2 });
      csv += `${item.nome};R$ ${preco};${totalBase};${item.unidadeCalculada};${emb};R$ ${custo}\n`;
    });
    csv += `\nCusto Estimado Insumos;;;;;R$ ${resumoCompras.custoTotalInsumos.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}\n`;
    csv += `Custo Estimado Terceirizados;;;;;R$ ${resumoCompras.custoTerceirizadoEstimado.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}\n`;
    csv += `CUSTO TOTAL ESTIMADO;;;;;R$ ${resumoCompras.custoGeralEstimado.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}\n`;

    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.setAttribute('download', `Planejamento_${planNome.replace(/\s+/g, '_')}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }

  async function handleAplicarNaSafra() {
    setErroAplicar(null);
    const safraSelecionada = safras.find((s) => s.id === applySafraId);
    setAplicando(true);
    try {
      const qtd = await aplicarPlanejamentoNaSafra({
        safra: safraSelecionada,
        safraId: applySafraId,
        planNome,
        tipoCiclo: planTipoCiclo,
        quantidadePlantas: planPlantas,
        fases: planFases,
        insumos,
        dataInicio: applyStartDate
      });
      await recarregar();
      setOpenApplyModal(false);
      alert(`Sucesso! ${qtd} atividades foram agendadas na tela de Atividades.`);
    } catch (err) {
      setErroAplicar(err.message || 'Erro ao gerar atividades.');
    } finally {
      setAplicando(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="rounded-xl2 bg-tech/10 border border-tech/25 p-4 flex items-start gap-3">
        <ListChecks className="w-4 h-4 text-tech shrink-0 mt-0.5" />
        <p className="text-sm text-ink-muted">
          Monte um cronograma-modelo de aplicações e serviços por etapa — depois de pronto, use{' '}
          <span className="text-ink font-semibold">&quot;Aplicar na Safra&quot;</span> pra gerar as atividades de
          verdade numa safra ativa, com as datas já calculadas.
        </p>
      </div>

      <div className="rounded-xl2 bg-surface border border-line p-4 flex flex-col xl:flex-row xl:items-center justify-between gap-4">
        <div>
          <h2 className="font-display font-bold text-lg text-ink">Planejamento de ciclos</h2>
          <p className="text-sm text-ink-faint">Cronograma de aplicações foliares e adubações</p>
        </div>

        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5">
          <select
            value={activePlanId}
            onChange={(e) => setActivePlanId(e.target.value)}
            className="w-full sm:w-72 rounded-xl bg-base border border-line px-3 py-2.5 text-sm font-medium text-ink"
          >
            <option value="novo">+ Criar novo ciclo</option>
            {planejamentos.map((p) => (
              <option key={p.id} value={p.id}>
                {p.nome} ({p.cultura})
              </option>
            ))}
          </select>

          {activePlanId === 'novo' ? (
            <button
              onClick={() => setOpenNovaPlanilha(true)}
              className="inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl bg-brand text-base font-semibold text-sm hover:bg-brand/90 transition-colors shrink-0"
            >
              <Plus className="w-4 h-4" /> Iniciar planejamento
            </button>
          ) : (
            <div className="flex flex-wrap gap-2">
              <button onClick={generatePDF} title="Baixar PDF" className="inline-flex items-center gap-1.5 px-3 py-2.5 rounded-xl bg-surface-raised border border-line text-ink-muted hover:text-ink text-xs font-medium transition-colors">
                <FileText className="w-4 h-4 text-rose" /> PDF
              </button>
              <button onClick={generateExcel} title="Baixar Excel" className="inline-flex items-center gap-1.5 px-3 py-2.5 rounded-xl bg-surface-raised border border-line text-ink-muted hover:text-ink text-xs font-medium transition-colors">
                <FileSpreadsheet className="w-4 h-4 text-brand" /> Excel
              </button>
              <button
                onClick={() => setOpenApplyModal(true)}
                disabled={planFases.length === 0}
                title="Aplicar isso no calendário real"
                className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-brand/15 border border-brand/30 text-brand font-semibold text-xs disabled:opacity-40 disabled:cursor-not-allowed hover:bg-brand/20 transition-colors"
              >
                <PlayCircle className="w-4 h-4" /> Aplicar na safra
              </button>
              <button
                onClick={handleDuplicate}
                disabled={duplicando}
                title="Duplicar planejamento"
                className="inline-flex items-center gap-1.5 px-3 py-2.5 rounded-xl bg-surface-raised border border-line text-ink-muted hover:text-tech text-xs font-medium transition-colors disabled:opacity-40"
              >
                <Copy className="w-4 h-4 text-tech" /> Duplicar
              </button>
              <button
                onClick={handleSaveCurrent}
                disabled={salvando}
                className="inline-flex items-center gap-1.5 px-5 py-2.5 rounded-xl bg-tech text-base font-semibold text-xs disabled:opacity-40 transition-colors"
              >
                {salvando ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />} Salvar
              </button>
              <button
                onClick={handleDelete}
                disabled={excluindo}
                className="inline-flex items-center gap-1.5 px-3 py-2.5 rounded-xl bg-rose/10 border border-rose/25 text-rose text-xs font-medium hover:bg-rose/15 transition-colors disabled:opacity-40"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          )}
        </div>
      </div>

      {mensagem && <div className="rounded-xl2 bg-brand/10 border border-brand/25 p-3 text-sm text-ink">{mensagem}</div>}

      {activePlanId === 'novo' ? (
        <div className="rounded-xl2 border border-dashed border-line p-10 flex flex-col items-center gap-2 text-center">
          <CircleDot className="w-6 h-6 text-ink-faint" />
          <p className="text-sm text-ink-faint">Selecione um planejamento no topo ou crie um novo para organizar suas aplicações.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-5">
            <div className="rounded-xl2 bg-surface border border-line p-5 flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div className="flex-1 space-y-2.5">
                <div className="flex items-center gap-2.5 flex-wrap">
                  <input
                    value={planNome}
                    onChange={(e) => setPlanNome(e.target.value)}
                    title="Clique para renomear este planejamento"
                    className="text-lg font-display font-bold text-ink bg-transparent border border-transparent hover:border-line focus:border-brand/50 rounded-lg h-9 px-2 min-w-[220px] outline-none transition-colors"
                  />
                  <span className="px-2.5 py-1 rounded-lg bg-line-soft text-ink-muted text-xs font-medium capitalize">{planCultura}</span>
                </div>
                <div className="flex flex-wrap items-center gap-3 px-1">
                  <span className="text-xs text-ink-faint flex items-center gap-1.5">
                    <Settings className="w-3.5 h-3.5" /> Formato: <b className="text-ink">{planTipoCiclo === 'livre' ? 'Livre (sem data)' : `${cicloLabels[planTipoCiclo]}s`}</b>
                  </span>
                  <span className="flex items-center gap-2 bg-base px-3 py-1.5 rounded-lg border border-line">
                    <Trees className="w-3.5 h-3.5 text-brand" />
                    <span className="text-xs text-ink-faint">Plantas:</span>
                    <input
                      type="number"
                      value={planPlantas}
                      onChange={(e) => setPlanPlantas(e.target.value)}
                      className="w-16 h-6 text-xs font-bold bg-transparent outline-none text-ink"
                      placeholder="Ex: 500"
                    />
                  </span>
                </div>
              </div>

              <button
                onClick={() => setOpenNovaFase(true)}
                className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-ink text-base font-semibold text-sm shrink-0 hover:opacity-90 transition-opacity"
              >
                <Plus className="w-4 h-4" /> Adicionar {cicloLabels[planTipoCiclo]}
              </button>
            </div>

            <div className="space-y-4">
              {planFases.length === 0 ? (
                <div className="rounded-xl2 border border-dashed border-line p-8 text-center">
                  <Calendar className="w-5 h-5 text-ink-faint mx-auto mb-2" />
                  <p className="text-sm text-ink-faint">Nenhuma etapa programada.</p>
                  <p className="text-xs text-ink-faint mt-1">Clique em &quot;Adicionar {cicloLabels[planTipoCiclo]}&quot; para começar.</p>
                </div>
              ) : (
                planFases.map((fase) => (
                  <div key={fase.id} className="rounded-xl2 bg-surface border border-line overflow-hidden">
                    <div className="bg-line-soft/40 px-4 py-3 border-b border-line flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
                      <div className="flex items-center gap-2.5">
                        <span className="w-8 h-8 rounded-full bg-brand/15 border border-brand/30 flex items-center justify-center text-xs font-bold text-brand shrink-0">
                          {fase.momento}
                        </span>
                        <input
                          placeholder="Nome da etapa (ex: Indução…)"
                          value={fase.nome_etapa || ''}
                          onChange={(e) => handleUpdateFase(fase.id, 'nome_etapa', e.target.value)}
                          className="h-8 text-sm font-semibold bg-surface border border-line rounded-lg px-2.5 text-ink w-full max-w-[240px]"
                        />
                      </div>
                      <div className="flex gap-2">
                        <button onClick={() => handleAddAplicacao(fase.id)} className="h-8 text-xs px-3 rounded-lg bg-brand/10 border border-brand/25 text-brand font-medium hover:bg-brand/15 transition-colors">
                          <Plus className="w-3 h-3 inline mr-1" /> Adicionar item
                        </button>
                        <button onClick={() => handleRemoveFase(fase.id)} className="h-8 w-8 rounded-lg text-ink-faint hover:text-rose hover:bg-rose/10 transition-colors flex items-center justify-center">
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>

                    <div className="p-3.5">
                      {fase.aplicacoes.length === 0 ? (
                        <p className="text-xs text-ink-faint italic text-center py-2">Nenhum item adicionado nesta etapa.</p>
                      ) : (
                        <div className="space-y-2.5">
                          {fase.aplicacoes.map((app) => {
                            const config = metodoConfig[app.metodo] || metodoConfig.foliar;
                            const Icon = config.icon;
                            const total = usoTotalStr(app);
                            return (
                              <div key={app.id} className="flex flex-col md:flex-row gap-2 md:items-center p-2.5 rounded-xl bg-line-soft/30 border border-line">
                                <select
                                  value={app.metodo}
                                  onChange={(e) => {
                                    const v = e.target.value;
                                    handleUpdateAplicacao(fase.id, app.id, 'metodo', v);
                                    if (v !== 'terceirizado') handleUpdateAplicacao(fase.id, app.id, 'modo_aplicacao', v === 'foliar' ? 'ml/area' : 'g/planta');
                                  }}
                                  className={`w-full md:w-[130px] h-9 text-xs font-semibold rounded-lg border px-2 ${config.cls}`}
                                >
                                  <option value="foliar">Foliar</option>
                                  <option value="adubacao">Adubação</option>
                                  <option value="terceirizado">Terceirizado</option>
                                </select>

                                {app.metodo === 'terceirizado' ? (
                                  <>
                                    <input
                                      placeholder="Descrição do serviço (ex: Poda, Roçada)"
                                      value={app.descricao_servico || ''}
                                      onChange={(e) => handleUpdateAplicacao(fase.id, app.id, 'descricao_servico', e.target.value)}
                                      className={`flex-1 h-9 ${smallInputCls}`}
                                    />
                                    <div className="flex items-center justify-between md:justify-end gap-2 w-full md:w-auto shrink-0">
                                      <span className="text-xs text-ink-faint font-medium whitespace-nowrap">R$ est.</span>
                                      <input
                                        type="number"
                                        placeholder="Opcional"
                                        value={app.valor_estimado || ''}
                                        onChange={(e) => handleUpdateAplicacao(fase.id, app.id, 'valor_estimado', e.target.value)}
                                        className={`w-24 h-9 text-center font-semibold ${smallInputCls}`}
                                      />
                                      <button onClick={() => handleRemoveAplicacao(fase.id, app.id)} className="h-8 w-8 rounded-lg text-ink-faint hover:text-rose flex items-center justify-center shrink-0">
                                        <Trash2 className="w-3.5 h-3.5" />
                                      </button>
                                    </div>
                                  </>
                                ) : (
                                  <>
                                    <select
                                      value={app.insumo_id}
                                      onChange={(e) => handleUpdateAplicacao(fase.id, app.id, 'insumo_id', e.target.value)}
                                      className={`flex-1 h-9 ${smallInputCls}`}
                                    >
                                      <option value="">Selecione o produto…</option>
                                      {insumos.map((ins) => (
                                        <option key={ins.id} value={ins.id}>
                                          {ins.nome}
                                        </option>
                                      ))}
                                    </select>
                                    <div className="flex items-center justify-between md:justify-end gap-2 w-full md:w-auto shrink-0">
                                      <input
                                        type="number"
                                        placeholder="Qtd"
                                        value={app.quantidade}
                                        onChange={(e) => handleUpdateAplicacao(fase.id, app.id, 'quantidade', e.target.value)}
                                        className={`w-16 h-9 text-center font-semibold ${smallInputCls}`}
                                      />
                                      <select
                                        value={app.modo_aplicacao || (app.metodo === 'foliar' ? 'ml/area' : 'g/planta')}
                                        onChange={(e) => handleUpdateAplicacao(fase.id, app.id, 'modo_aplicacao', e.target.value)}
                                        className={`w-24 h-9 ${smallInputCls}`}
                                      >
                                        {app.metodo === 'foliar' ? (
                                          <>
                                            <option value="ml/area">ml / área</option>
                                            <option value="l/area">L / área</option>
                                          </>
                                        ) : (
                                          <>
                                            <option value="g/planta">g / planta</option>
                                            <option value="kg/area">kg / área</option>
                                          </>
                                        )}
                                      </select>
                                      {total !== '-' && (
                                        <span className="hidden sm:flex flex-col items-center bg-line-soft border border-line px-2 py-0.5 rounded-lg leading-none">
                                          <span className="text-[9px] font-bold text-ink-faint uppercase mb-0.5">Uso total</span>
                                          <span className="text-xs font-bold text-ink whitespace-nowrap">{total}</span>
                                        </span>
                                      )}
                                      <button onClick={() => handleRemoveAplicacao(fase.id, app.id)} className="h-8 w-8 rounded-lg text-ink-faint hover:text-rose flex items-center justify-center shrink-0">
                                        <Trash2 className="w-3.5 h-3.5" />
                                      </button>
                                    </div>
                                  </>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          <div className="lg:col-span-1">
            <div className="sticky top-24 rounded-xl2 bg-surface border border-line overflow-hidden">
              <div className="p-5 text-center bg-line-soft/50 border-b border-line">
                <div className="flex items-center justify-center gap-2 mb-3 text-ink-faint">
                  <ShoppingCart className="w-3.5 h-3.5" />
                  <span className="text-[11px] uppercase font-semibold tracking-widest">Resumo do ciclo</span>
                </div>
                <p className="text-ink-faint text-[11px] uppercase font-semibold tracking-widest mb-1">Custo total estimado</p>
                <div className="text-2xl font-display font-bold text-brand tabular">
                  {resumoCompras.custoGeralEstimado.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                </div>
                <div className="flex justify-center gap-4 mt-2.5 text-xs text-ink-faint font-medium">
                  <span>Insumos: {resumoCompras.custoTotalInsumos.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</span>
                  <span>Serviços: {resumoCompras.custoTerceirizadoEstimado.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</span>
                </div>
                {(!planPlantas || planPlantas === '0') && planFases.some((f) => f.aplicacoes.some((a) => a.modo_aplicacao === 'g/planta')) && (
                  <div className="mt-3 bg-rose/10 border border-rose/25 text-rose text-xs py-1.5 px-3 rounded-lg inline-block">
                    Informe a Qtd de Plantas para calcular &quot;g/planta&quot;
                  </div>
                )}
              </div>

              <div className="p-4">
                <h3 className="text-sm font-semibold text-ink mb-3 flex items-center gap-2">
                  <Calculator className="w-4 h-4 text-ink-faint" /> Lista de compras necessária
                </h3>
                {resumoCompras.itens.length === 0 ? (
                  <p className="text-center text-ink-faint py-8 italic text-sm">Adicione produtos e preencha as quantidades para ver o resumo.</p>
                ) : (
                  <div className="space-y-2.5 max-h-[480px] overflow-y-auto pr-1 scrollbar-thin">
                    {resumoCompras.itens.map((item, idx) => (
                      <div key={idx} className="rounded-xl bg-line-soft/40 border border-line p-3 flex items-center justify-between gap-2">
                        <div className="flex-1 truncate">
                          <p className="font-semibold text-ink text-sm truncate" title={item.nome}>
                            {item.nome}
                          </p>
                          <p className="text-xs text-ink-faint">Ref: {(item.preco_unitario || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}/embalagem</p>
                        </div>
                        <div className="text-right shrink-0">
                          <p className="text-sm font-bold text-ink tabular">
                            {item.quantidadeTotalBase.toLocaleString('pt-BR', { maximumFractionDigits: 2 })} <span className="text-xs text-ink-faint uppercase">{item.unidadeCalculada}</span>
                          </p>
                          <p className="text-xs text-ink-faint">
                            Comprar <b className="text-ink">{Math.ceil(item.qtdEmbalagens)}</b> un.
                          </p>
                          <p className="text-xs font-semibold text-ink-muted mt-0.5 tabular">{item.custoEstimado.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal: novo planejamento */}
      <Modal open={openNovaPlanilha} onClose={() => setOpenNovaPlanilha(false)} title="Novo ciclo de planejamento" description="Crie o esqueleto base de aplicações.">
        <div className="space-y-4">
          <div>
            <label className="text-[11px] uppercase tracking-wide text-ink-faint font-semibold block mb-1">Nome do planejamento</label>
            <input value={novoPlan.nome} onChange={(e) => setNovoPlan({ ...novoPlan, nome: e.target.value })} className={inputCls} placeholder="Ex: Manga Palmer — sem data fixa" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-[11px] uppercase tracking-wide text-ink-faint font-semibold block mb-1">Cultura</label>
              <select value={novoPlan.cultura} onChange={(e) => setNovoPlan({ ...novoPlan, cultura: e.target.value })} className={inputCls}>
                {culturas.length === 0 && <option value={novoPlan.cultura}>{novoPlan.cultura}</option>}
                {culturas.map((c) => (
                  <option key={c.id} value={c.nome}>
                    {c.nome.charAt(0).toUpperCase() + c.nome.slice(1)}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-[11px] uppercase tracking-wide text-ink-faint font-semibold block mb-1">Formato do ciclo</label>
              <select value={novoPlan.tipo_ciclo} onChange={(e) => setNovoPlan({ ...novoPlan, tipo_ciclo: e.target.value })} className={inputCls}>
                <option value="dia">Por dia</option>
                <option value="semana">Por semana</option>
                <option value="mes">Por mês</option>
                <option value="livre">Livre / etapas</option>
              </select>
            </div>
          </div>
          <div>
            <label className="text-[11px] uppercase tracking-wide text-ink-faint font-semibold block mb-1">
              Qtd. de plantas <span className="normal-case text-ink-faint font-normal">(usado no cálculo g/planta)</span>
            </label>
            <input type="number" value={novoPlan.quantidade_plantas} onChange={(e) => setNovoPlan({ ...novoPlan, quantidade_plantas: e.target.value })} className={inputCls} placeholder="Ex: 500" />
          </div>

          {erro && (
            <div className="flex items-start gap-2 text-sm text-rose">
              <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{erro}</span>
            </div>
          )}

          <button
            onClick={handleCreateNew}
            disabled={salvando || !novoPlan.nome}
            className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-brand text-base font-semibold text-sm disabled:opacity-40 disabled:cursor-not-allowed hover:bg-brand/90 transition-colors"
          >
            {salvando && <Loader2 className="w-4 h-4 animate-spin" />} Criar estrutura
          </button>
        </div>
      </Modal>

      {/* Modal: nova etapa */}
      <Modal open={openNovaFase} onClose={() => setOpenNovaFase(false)} title="Adicionar etapa" description="Digite o número da etapa no ciclo." maxWidth="max-w-xs">
        <div className="space-y-4">
          <div>
            <label className="text-[11px] uppercase tracking-wide text-ink-faint font-semibold block mb-1">
              {planTipoCiclo === 'livre' ? 'Ordem da etapa (ex: 1, 2, 3…)' : `Número do ${cicloLabels[planTipoCiclo]} (ex: -7, 0, 14)`}
            </label>
            <input type="number" value={novaFaseMomento} onChange={(e) => setNovaFaseMomento(e.target.value)} className={inputCls} placeholder="Digite o número…" />
          </div>
          <button
            onClick={handleAddFase}
            disabled={!novaFaseMomento}
            className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-brand text-base font-semibold text-sm disabled:opacity-40 disabled:cursor-not-allowed hover:bg-brand/90 transition-colors"
          >
            Adicionar à linha do tempo
          </button>
        </div>
      </Modal>

      {/* Modal: aplicar na safra */}
      <Modal open={openApplyModal} onClose={() => setOpenApplyModal(false)} title="Aplicar planejamento" description="Gerar atividades no calendário da safra selecionada.">
        <div className="space-y-4">
          <div>
            <label className="text-[11px] uppercase tracking-wide text-ink-faint font-semibold block mb-1">Safra destino (ativa)</label>
            <select value={applySafraId} onChange={(e) => setApplySafraId(e.target.value)} className={inputCls}>
              <option value="">Selecione a safra…</option>
              {safrasAtivas.length === 0 && <option disabled>Nenhuma safra ativa.</option>}
              {safrasAtivas.map((s) => {
                const talhao = talhoes.find((t) => t.id === s.talhao_id);
                return (
                  <option key={s.id} value={s.id}>
                    {s.nome} {talhao ? `(${talhao.nome})` : ''}
                  </option>
                );
              })}
            </select>
          </div>
          <div>
            <label className="text-[11px] uppercase tracking-wide text-ink-faint font-semibold block mb-1">
              Data base de início {planTipoCiclo === 'livre' && <span className="normal-case font-normal">(opcional)</span>}
            </label>
            <input type="date" value={applyStartDate} onChange={(e) => setApplyStartDate(e.target.value)} className={inputCls} />
            {planTipoCiclo === 'livre' ? (
              <p className="text-xs text-ink-faint mt-1.5">
                As etapas nascem <b className="text-ink">sem data</b> em Atividades, na ordem certa. Você escolhe a data real de cada uma só
                quando marcar como concluída — e é aí que o custo entra no financeiro daquele talhão.
              </p>
            ) : (
              <p className="text-xs text-ink-faint mt-1.5">As {cicloLabels[planTipoCiclo]}s serão calculadas a partir desta data.</p>
            )}
          </div>

          {erroAplicar && (
            <div className="flex items-start gap-2 text-sm text-rose">
              <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{erroAplicar}</span>
            </div>
          )}

          <div className="flex justify-end gap-2.5 pt-2">
            <button onClick={() => setOpenApplyModal(false)} className="px-4 py-2.5 rounded-xl bg-line-soft text-ink text-sm font-medium hover:bg-line transition-colors">
              Cancelar
            </button>
            <button
              onClick={handleAplicarNaSafra}
              disabled={aplicando || !applySafraId}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-brand text-base font-semibold text-sm disabled:opacity-40 disabled:cursor-not-allowed hover:bg-brand/90 transition-colors"
            >
              {aplicando ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
              {aplicando ? 'Agendando…' : 'Gerar atividades'}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
