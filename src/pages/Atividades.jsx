import React, { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabaseClient';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Switch } from '@/components/ui/switch';
import { Plus, Edit, Trash2, ClipboardList, Filter, Package, Copy, MessageCircle, CheckCircle2, Calendar as CalendarIcon, ListPlus, X, Send, FileText, LayoutGrid, ArrowRight, FileDown, ArrowLeft, Map, Archive } from 'lucide-react';
import EmptyState from '@/components/ui/EmptyState';
import { format, parseISO, subDays, isWithinInterval, startOfDay, endOfDay } from 'date-fns';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

const tiposAtividadePadrao = [
  { value: 'inducao', label: 'Indução' },
  { value: 'poda', label: 'Poda' },
  { value: 'adubacao', label: 'Adubação' },
  { value: 'pulverizacao', label: 'Pulverização' },
  { value: 'maturacao', label: 'Maturação' },
  { value: 'irrigacao', label: 'Irrigação' },
  { value: 'capina', label: 'Capina' },
  { value: 'outro', label: 'Outro' }
];

const statusLabels = {
  programada: { label: 'Programada', color: 'bg-blue-100 text-blue-700 border-blue-200' },
  em_andamento: { label: 'Em Andamento', color: 'bg-amber-100 text-amber-700 border-amber-200' },
  concluida: { label: 'Concluída', color: 'bg-emerald-100 text-emerald-700 border-emerald-200' },
  cancelada: { label: 'Cancelada', color: 'bg-red-100 text-red-700 border-red-200' }
};

export default function Atividades() {
  const [viewMode, setViewMode] = useState('selecao'); 
  
  const [open, setOpen] = useState(false);
  const [summaryOpen, setSummaryOpen] = useState(false);
  const [summaryText, setSummaryText] = useState('');
  
  const [areaViewOpen, setAreaViewOpen] = useState(false);
  const [reportOpen, setReportOpen] = useState(false);
  const [reportTalhao, setReportTalhao] = useState('todos');
  const [reportStartDate, setReportStartDate] = useState(format(subDays(new Date(), 30), 'yyyy-MM-dd'));
  const [reportEndDate, setReportEndDate] = useState(format(new Date(), 'yyyy-MM-dd'));

  const [editingAtividade, setEditingAtividade] = useState(null);
  const [activityQueue, setActivityQueue] = useState([]);

  const [concludeModalOpen, setConcludeModalOpen] = useState(false);
  const [activityToConclude, setActivityToConclude] = useState(null);
  const [dataConclusaoInput, setDataConclusaoInput] = useState(format(new Date(), 'yyyy-MM-dd'));

  const [filtroTalhao, setFiltroTalhao] = useState('todos');
  const [filtroStatus, setFiltroStatus] = useState('todos');
  const [filtroSafra, setFiltroSafra] = useState('todas'); 
  
  const [openTipoDialog, setOpenTipoDialog] = useState(false);
  const [novoTipo, setNovoTipo] = useState('');
  
  const [novoMetodo, setNovoMetodo] = useState('');
  const [mostrarNovoMetodo, setMostrarNovoMetodo] = useState(false);
  
  const [formData, setFormData] = useState({
    talhao_id: '',
    tipo: '',
    tipo_personalizado: '',
    data_programada: format(new Date(), 'yyyy-MM-dd'),
    data_realizada: '',
    status: 'programada',
    terceirizada: false,
    valor_terceirizado: '',
    insumos_utilizados: [],
    custo_total: 0,
    responsavel: '',
    observacoes: ''
  });
  
  const [insumoTemp, setInsumoTemp] = useState({ insumo_id: '', quantidade: '', metodo_aplicacao: 'foliar' });

  const queryClient = useQueryClient();

  const { data: talhoes = [] } = useQuery({ queryKey: ['talhoes'], queryFn: async () => { const { data } = await supabase.from('talhoes').select('*'); return data || []; } });
  const { data: atividades = [] } = useQuery({ queryKey: ['atividades'], queryFn: async () => { const { data } = await supabase.from('atividades').select('*').order('data_programada', { ascending: false }); return data || []; } });
  const { data: insumos = [] } = useQuery({ queryKey: ['insumos'], queryFn: async () => { const { data } = await supabase.from('insumos').select('*'); return data || []; } });
  const { data: tiposCustomizados = [] } = useQuery({ queryKey: ['tipos-atividade'], queryFn: async () => { const { data } = await supabase.from('tipos_atividade').select('*'); return data || []; } });
  const { data: safras = [] } = useQuery({ queryKey: ['safras'], queryFn: async () => { const { data } = await supabase.from('safras').select('*').order('data_inicio', { ascending: false }); return data || []; } });

  const areasResumo = useMemo(() => {
    return talhoes.map(talhao => {
        const atividadesArea = atividades.filter(a => a.talhao_id === talhao.id);
        const totalCusto = atividadesArea.reduce((acc, curr) => acc + (curr.custo_total || 0), 0);
        const pendentes = atividadesArea.filter(a => a.status === 'programada' || a.status === 'em_andamento');
        const concluidas = atividadesArea.filter(a => a.status === 'concluida');
        const proximas = pendentes.sort((a, b) => new Date(a.data_programada) - new Date(b.data_programada)).slice(0, 3);
        return { ...talhao, totalCusto, qtdPendentes: pendentes.length, qtdConcluidas: concluidas.length, proximas };
    });
  }, [talhoes, atividades]);

  const generatePDF = () => {
    const doc = new jsPDF();
    const filteredActivities = atividades.filter(a => {
        const date = parseISO(a.data_programada);
        const start = startOfDay(parseISO(reportStartDate));
        const end = endOfDay(parseISO(reportEndDate));
        return isWithinInterval(date, { start, end }) && (reportTalhao === 'todos' || String(a.talhao_id) === String(reportTalhao));
    }).sort((a, b) => new Date(a.data_programada) - new Date(b.data_programada));

    const totalGeral = filteredActivities.reduce((acc, curr) => acc + (curr.custo_total || 0), 0);
    const nomeFiltro = reportTalhao === 'todos' ? 'Todas as Válvulas' : talhoes.find(t => String(t.id) === String(reportTalhao))?.nome;

    doc.setFontSize(18); doc.text("Caderno de Campo - Fazenda Cassiano's", 14, 20);
    doc.setFontSize(10); doc.text(`Filtro: ${nomeFiltro}`, 14, 28); doc.text(`Período: ${format(parseISO(reportStartDate), 'dd/MM/yyyy')} a ${format(parseISO(reportEndDate), 'dd/MM/yyyy')}`, 14, 34);

    const tableColumn = ["Data", "Válvula", "Atividade", "Detalhes / Insumos", "Status", "Resp.", "Valor"];
    const tableRows = [];

    filteredActivities.forEach(ativ => {
        const dataFormatada = format(parseISO(ativ.data_programada), 'dd/MM/yy');
        const nomeValvula = getTalhaoNome(ativ.talhao_id);
        const tipo = ativ.tipo === 'outro' ? ativ.tipo_personalizado : getTipoLabel(ativ.tipo);
        let detalhes = "";
        if (ativ.insumos_utilizados && ativ.insumos_utilizados.length > 0) detalhes = ativ.insumos_utilizados.map(i => `${i.nome} (${i.quantidade}${i.unidade})`).join(', ');
        else if (ativ.terceirizada) detalhes = "Serviço Terceirizado";
        if (ativ.observacoes) detalhes += `\nObs: ${ativ.observacoes}`;
        const status = statusLabels[ativ.status]?.label || ativ.status;
        const valorFormatado = (ativ.custo_total || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
        tableRows.push([dataFormatada, nomeValvula, tipo, detalhes, status, ativ.responsavel || '-', valorFormatado]);
    });

    autoTable(doc, {
        head: [tableColumn], body: tableRows, foot: [["", "", "", "", "", "TOTAL GERAL:", totalGeral.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })]],
        startY: 40, theme: 'grid', styles: { fontSize: 8, cellPadding: 2 }, headStyles: { fillColor: [16, 185, 129] },
        footStyles: { fillColor: [240, 240, 240], textColor: [0,0,0], fontStyle: 'bold', halign: 'right' }, columnStyles: { 6: { halign: 'right' } }
    });
    doc.save(`relatorio_campo_${format(new Date(), 'yyyyMMdd')}.pdf`);
    setReportOpen(false);
  };

  const createBatchMutation = useMutation({
    mutationFn: async (activities) => {
      const payload = activities.map(a => { const { talhao_nome, tempId, ...rest } = a; if (rest.valor_terceirizado === '') rest.valor_terceirizado = null; return rest; });
      const { error } = await supabase.from('atividades').insert(payload); if (error) throw error;
    },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['atividades'] }); generateSummaryText(activityQueue); setActivityQueue([]); setOpen(false); setSummaryOpen(true); },
    onError: (error) => { alert(`Não foi possível salvar a programação.\n\nMotivo: ${error.message || 'Erro desconhecido'}`); console.error('Erro ao salvar atividades:', error); }
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }) => {
      const payload = { ...data }; if (payload.valor_terceirizado === '') payload.valor_terceirizado = null;
      const { data: result, error } = await supabase.from('atividades').update(payload).eq('id', id).select(); if (error) throw error; return result;
    }, onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['atividades'] }); resetForm(); },
    onError: (error) => { alert(`Não foi possível salvar a atividade.\n\nMotivo: ${error.message || 'Erro desconhecido'}`); console.error('Erro ao atualizar atividade:', error); }
  });

  const deleteMutation = useMutation({
    mutationFn: async (id) => { const { error } = await supabase.from('atividades').delete().eq('id', id); if (error) throw error; },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['atividades'] }); },
    onError: (error) => { alert(`Não foi possível excluir a atividade.\n\nMotivo: ${error.message || 'Erro desconhecido'}`); console.error('Erro ao excluir atividade:', error); }
  });
  const createTipoMutation = useMutation({
    mutationFn: async (data) => { const { data: result, error } = await supabase.from('tipos_atividade').insert(data).select(); if (error) throw error; return result; },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['tipos-atividade'] }); setNovoTipo(''); },
    onError: (error) => { alert(`Não foi possível criar o tipo.\n\nMotivo: ${error.message || 'Erro desconhecido'}`); console.error('Erro ao criar tipo:', error); }
  });
  const deleteTipoMutation = useMutation({
    mutationFn: async (id) => { const { error } = await supabase.from('tipos_atividade').delete().eq('id', id); if (error) throw error; },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['tipos-atividade'] }); },
    onError: (error) => { alert(`Não foi possível excluir o tipo.\n\nMotivo: ${error.message || 'Erro desconhecido'}`); console.error('Erro ao excluir tipo:', error); }
  });

  const handleAddToQueue = (e) => {
      e.preventDefault();
      if (!formData.talhao_id || !formData.tipo || !formData.data_programada) return alert("Preencha Válvula, Tipo e Data para adicionar.");

      // Se estiver dentro de uma safra específica, avisa se a data escolhida cair fora do período dela
      // (a atividade será salva normalmente, mas não vai aparecer neste filtro por safra)
      if (filtroSafra !== 'todas') {
          const safraAtual = safras.find(s => s.id === filtroSafra);
          if (safraAtual) {
              const inicio = safraAtual.data_inicio || '2000-01-01';
              const fim = safraAtual.data_fim || '2099-12-31';
              if (formData.data_programada < inicio || formData.data_programada > fim) {
                  const dataInicioFmt = format(parseISO(inicio), 'dd/MM/yyyy');
                  const dataFimFmt = safraAtual.data_fim ? format(parseISO(fim), 'dd/MM/yyyy') : 'em aberto';
                  const confirmar = confirm(`A data escolhida (${format(parseISO(formData.data_programada), 'dd/MM/yyyy')}) está fora do período desta safra (${dataInicioFmt} até ${dataFimFmt}).\n\nA atividade será salva normalmente, mas NÃO vai aparecer neste filtro "${safraAtual.nome}" — só em "Todas as Atividades".\n\nDeseja continuar mesmo assim?`);
                  if (!confirmar) return;
              }
          }
      }

      const talhaoNome = talhoes.find(t => String(t.id) === String(formData.talhao_id))?.nome || 'Válvula';
      const custoCalc = calcularCustoTotal();
      const safraIdAtual = filtroSafra !== 'todas' ? filtroSafra : null;
      const newItem = { ...formData, safra_id: safraIdAtual, valor_terceirizado: formData.valor_terceirizado ? parseFloat(formData.valor_terceirizado) : null, custo_total: custoCalc, data_realizada: formData.status === 'concluida' ? formData.data_programada : null, talhao_nome: talhaoNome, tempId: Date.now() };
      setActivityQueue([...activityQueue, newItem]);
      setFormData(prev => ({ ...prev, talhao_id: formData.talhao_id, observacoes: '', insumos_utilizados: [], custo_total: 0, terceirizada: false, valor_terceirizado: '' }));
  };

  const handleRemoveFromQueue = (tempId) => setActivityQueue(activityQueue.filter(item => item.tempId !== tempId));
  const handleSaveAll = () => { if (activityQueue.length > 0) createBatchMutation.mutate(activityQueue); };

  const generateSummaryText = (items) => {
      const grouped = items.reduce((acc, curr) => { const key = curr.talhao_nome; if (!acc[key]) acc[key] = []; acc[key].push(curr); return acc; }, {});
      let text = "*📋 PROGRAMAÇÃO DE ATIVIDADES*\n\n";
      Object.keys(grouped).forEach(talhao => {
          text += `*📍 ${talhao.toUpperCase()}*\n`;
          grouped[talhao].sort((a, b) => new Date(a.data_programada) - new Date(b.data_programada)).forEach(ativ => {
              const date = format(parseISO(ativ.data_programada), 'dd/MM'); const tipoLabel = ativ.tipo === 'outro' ? ativ.tipo_personalizado : getTipoLabel(ativ.tipo);
              text += `🔹 ${date}: ${tipoLabel}`;
              if (ativ.terceirizada) text += ` (Terceirizado)`;
              if (ativ.insumos_utilizados?.length > 0) { const insumosText = ativ.insumos_utilizados.map(i => `${i.nome} (${i.quantidade}${i.unidade}) ${i.metodo_aplicacao ? `[${i.metodo_aplicacao}]` : ''}`).join(', '); text += `\n   📦 Insumos: ${insumosText}`; }
              if (ativ.observacoes) text += `\n   📝 _Obs: ${ativ.observacoes}_`;
              text += `\n`;
          }); text += `\n`;
      }); text += `_Gerado pelo Sistema Fazenda Cassiano's_`; setSummaryText(text);
  };

  const handleViewActivityText = (atividade) => {
    const talhaoNome = getTalhaoNome(atividade.talhao_id); const tipoNome = atividade.tipo === 'outro' ? atividade.tipo_personalizado : getTipoLabel(atividade.tipo); const data = format(new Date(atividade.data_programada + 'T12:00:00'), 'dd/MM/yyyy');
    let text = `📋 *DETALHES DA ATIVIDADE*\n\n📍 *Válvula:* ${talhaoNome}\n🚜 *Atividade:* ${tipoNome}\n📅 *Data:* ${data}\n`;
    if (atividade.terceirizada) text += `👷 *Serviço:* Terceirizado\n`;
    if (atividade.insumos_utilizados && atividade.insumos_utilizados.length > 0) { text += `\n📦 *Insumos:*`; atividade.insumos_utilizados.forEach(i => { text += `\n   ▪ ${i.nome}: ${i.quantidade} ${i.unidade}` + (i.metodo_aplicacao ? ` (${i.metodo_aplicacao})` : ''); }); text += `\n`; }
    if (atividade.observacoes) text += `\n📝 *Observações:*\n${atividade.observacoes}`;
    setSummaryText(text); setSummaryOpen(true);
  };

  const handleConfirmarConclusao = () => {
      if (!activityToConclude || !dataConclusaoInput) return alert("Escolha a data em que a atividade foi realizada.");
      updateMutation.mutate({
          id: activityToConclude.id,
          data: { ...activityToConclude, status: 'concluida', data_realizada: dataConclusaoInput }
      });
      setConcludeModalOpen(false);
      setActivityToConclude(null);
  };

  const copyToClipboard = () => { navigator.clipboard.writeText(summaryText); alert("Texto copiado! Agora cole no WhatsApp."); };

  const resetForm = () => {
    setFormData({ talhao_id: '', tipo: '', tipo_personalizado: '', data_programada: format(new Date(), 'yyyy-MM-dd'), data_realizada: '', status: 'programada', terceirizada: false, valor_terceirizado: '', insumos_utilizados: [], custo_total: 0, responsavel: '', observacoes: '' });
    setInsumoTemp({ insumo_id: '', quantidade: '', metodo_aplicacao: 'foliar' }); setNovoMetodo(''); setMostrarNovoMetodo(false); setActivityQueue([]); setEditingAtividade(null); setOpen(false);
  };

  const handleNovaProgramacao = () => {
      let initialTalhao = '';
      if (filtroSafra !== 'todas') {
          const s = safras.find(x => x.id === filtroSafra);
          if (s) initialTalhao = String(s.talhao_id);
      } else if (filtroTalhao !== 'todos') {
          initialTalhao = String(filtroTalhao);
      }
      setFormData(prev => ({ ...prev, talhao_id: initialTalhao }));
      setOpen(true);
  };

  const handleEdit = (atividade) => { setEditingAtividade(atividade); setFormData({ ...atividade, talhao_id: String(atividade.talhao_id) }); setActivityQueue([]); setOpen(true); };
  const handleDuplicate = (atividade) => { setEditingAtividade(null); setFormData({ ...atividade, id: undefined, status: 'programada', data_realizada: '', talhao_id: String(atividade.talhao_id) }); setActivityQueue([]); setOpen(true); };

  const addInsumo = () => {
    if (!insumoTemp.insumo_id || !insumoTemp.quantidade) return; const insumoSelecionado = insumos.find(i => i.id === insumoTemp.insumo_id); if (!insumoSelecionado) return;
    const quantidade = parseFloat(insumoTemp.quantidade); const valorTotal = quantidade * (insumoSelecionado.preco_unitario || 0); const metodoFinal = (insumoTemp.metodo_aplicacao === 'outro' ? novoMetodo : insumoTemp.metodo_aplicacao) || 'foliar';
    const novosInsumos = [...formData.insumos_utilizados, { insumo_id: insumoSelecionado.id, nome: insumoSelecionado.nome, quantidade, unidade: insumoSelecionado.unidade, valor_unitario: insumoSelecionado.preco_unitario || 0, valor_total: valorTotal, metodo_aplicacao: metodoFinal }];
    setFormData({ ...formData, insumos_utilizados: novosInsumos, custo_total: novosInsumos.reduce((acc, i) => acc + (i.valor_total || 0), 0) + (formData.terceirizada ? parseFloat(formData.valor_terceirizado || 0) : 0) });
    setInsumoTemp({ insumo_id: '', quantidade: '', metodo_aplicacao: 'foliar' }); setNovoMetodo(''); setMostrarNovoMetodo(false);
  };

  const removeInsumo = (index) => {
    const novosInsumos = formData.insumos_utilizados.filter((_, i) => i !== index);
    setFormData({ ...formData, insumos_utilizados: novosInsumos, custo_total: novosInsumos.reduce((acc, i) => acc + (i.valor_total || 0), 0) + (formData.terceirizada ? parseFloat(formData.valor_terceirizado || 0) : 0) });
  };

  const calcularCustoTotal = () => formData.insumos_utilizados.reduce((acc, i) => acc + (i.valor_total || 0), 0) + (formData.terceirizada ? parseFloat(formData.valor_terceirizado || 0) : 0);

  const handleSubmitForm = (e) => {
      e.preventDefault();
      const payload = { ...formData, valor_terceirizado: formData.valor_terceirizado ? parseFloat(formData.valor_terceirizado) : null, custo_total: calcularCustoTotal(), data_realizada: formData.status === 'concluida' ? formData.data_programada : null };
      if (editingAtividade) updateMutation.mutate({ id: editingAtividade.id, data: payload }); else createBatchMutation.mutate([payload]);
  };

  const atividadesFiltradas = atividades.filter(a => {
    if (filtroTalhao !== 'todos' && String(a.talhao_id) !== String(filtroTalhao)) return false;
    if (filtroStatus !== 'todos' && a.status !== filtroStatus) return false;
    if (filtroSafra !== 'todas') {
        // Se a atividade já tem safra_id gravado, usa isso direto (mais confiável, funciona mesmo sem data)
        if (a.safra_id) return String(a.safra_id) === String(filtroSafra);

        // Fallback para atividades antigas, sem safra_id: cai de volta na checagem por data
        const safraSelecionada = safras.find(s => s.id === filtroSafra);
        if (safraSelecionada) {
            if (String(a.talhao_id) !== String(safraSelecionada.talhao_id)) return false;
            const dataAtiv = a.data_programada || '1900-01-01';
            const start = safraSelecionada.data_inicio || '2000-01-01';
            const end = safraSelecionada.data_fim || '2099-12-31';
            if (dataAtiv < start || dataAtiv > end) return false;
        }
    }
    return true;
  }).sort((a, b) => {
    // Etapas "livres" (sem data programada nem real ainda) sobem pro topo, ordenadas pela sequência da etapa.
    // As demais mantêm a ordem por data efetiva (real, se já concluída; senão a programada) — mais recente primeiro.
    const dataEfetivaA = a.data_realizada || a.data_programada;
    const dataEfetivaB = b.data_realizada || b.data_programada;
    const aSemData = !dataEfetivaA;
    const bSemData = !dataEfetivaB;
    if (aSemData && bSemData) return (a.ordem_etapa ?? 0) - (b.ordem_etapa ?? 0);
    if (aSemData) return -1;
    if (bSemData) return 1;
    return new Date(dataEfetivaB) - new Date(dataEfetivaA);
  });

  const getTalhaoNome = (id) => talhoes.find(t => String(t.id) === String(id))?.nome || '-';
  const getTipoLabel = (tipo) => { const padrao = tiposAtividadePadrao.find(t => t.value === tipo); if (padrao) return padrao.label; const customizado = tiposCustomizados.find(t => t.nome === tipo); return customizado ? customizado.nome : tipo; };
  const todosTipos = [ ...tiposAtividadePadrao, ...tiposCustomizados.map(t => ({ value: t.nome, label: t.nome })) ];

  const handleSelecionarSafra = (id) => {
      setFiltroSafra(id);
      setFiltroTalhao('todos'); 
      setViewMode('lista');
  };

  // --- RENDERIZAÇÃO DA TELA DE SELEÇÃO (AGORA POR SAFRAS) ---
  if (viewMode === 'selecao') {
      return (
        <div className="space-y-6 animate-in fade-in duration-500">
            <div className="flex flex-col bg-white p-6 rounded-[1.5rem] border border-stone-100 shadow-sm">
                <h1 className="text-2xl font-black text-stone-900 tracking-tight">Painel de Safras</h1>
                <p className="text-stone-500 font-medium">Escolha uma janela de safra para gerenciar as atividades daquele período sem acumular registros antigos.</p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                <Card 
                    onClick={() => handleSelecionarSafra('todas')}
                    className="cursor-pointer hover:border-emerald-500 hover:shadow-md transition-all border border-stone-200 bg-stone-50 group"
                >
                    <CardHeader className="text-center py-8">
                        <LayoutGrid className="w-10 h-10 mx-auto mb-3 text-stone-400 group-hover:text-emerald-500 transition-colors" />
                        <CardTitle className="text-lg text-stone-700 group-hover:text-emerald-700">Todas as Atividades</CardTitle>
                        <Badge variant="outline" className="mx-auto mt-2 bg-white text-stone-500">Histórico Completo</Badge>
                    </CardHeader>
                </Card>

                {safras.map(safra => {
                    const talhao = talhoes.find(t => String(t.id) === String(safra.talhao_id));
                    
                    // NOVA LÓGICA DE BLINDAGEM MAIS FORTE:
                    const statusText = String(safra.status || '').toLowerCase();
                    const nomeText = String(safra.nome || '').toLowerCase();
                    const hojeStr = new Date().toISOString().split('T')[0]; // Data de hoje no formato YYYY-MM-DD
                    
                    // A safra é finalizada se o status/nome disser, se "ativa" for falso, ou se a data de término já tiver passado de hoje
                    const isFinalizada = 
                        statusText === 'concluida' || 
                        statusText === 'finalizada' || 
                        statusText === 'encerrada' || 
                        statusText === 'arquivada' || 
                        safra.ativa === false ||
                        safra.arquivada === true ||
                        nomeText.includes('arquivada') || 
                        nomeText.includes('arqui') || 
                        nomeText.includes('finalizada') ||
                        (safra.data_fim && safra.data_fim < hojeStr);

                    return (
                        <Card 
                            key={safra.id} 
                            onClick={() => handleSelecionarSafra(safra.id)}
                            className={`cursor-pointer transition-all border group flex flex-col justify-center relative overflow-hidden ${
                                isFinalizada 
                                ? "bg-stone-100 border-stone-300 border-dashed hover:border-stone-400 hover:bg-stone-200/50 opacity-80" 
                                : "bg-white border-stone-200 hover:border-emerald-500 hover:shadow-md"
                            }`}
                        >
                            {/* Etiqueta Visual de Finalizada */}
                            {isFinalizada && (
                                <div className="absolute top-3 right-3">
                                    <Badge className="bg-stone-300 text-stone-700 hover:bg-stone-400 border-none shadow-none text-[11px] uppercase tracking-wider font-bold">Finalizada</Badge>
                                </div>
                            )}

                            <CardHeader className="text-center py-8">
                                {isFinalizada ? (
                                    <Archive className="w-10 h-10 mx-auto mb-3 text-stone-400 group-hover:text-stone-500 transition-colors" />
                                ) : (
                                    <CalendarIcon className="w-10 h-10 mx-auto mb-3 text-emerald-600/50 group-hover:text-emerald-500 transition-colors" />
                                )}
                                
                                <CardTitle className={`text-lg font-bold truncate px-2 ${
                                    isFinalizada ? "text-stone-500 group-hover:text-stone-700" : "text-stone-800 group-hover:text-emerald-700"
                                }`} title={safra.nome}>
                                    {safra.nome}
                                </CardTitle>
                                
                                <Badge variant="outline" className={`mx-auto mt-2 font-bold ${
                                    isFinalizada ? "bg-stone-200 border-stone-300 text-stone-600" : "bg-emerald-50 border-emerald-200 text-emerald-700"
                                }`}>
                                    {talhao ? talhao.nome : 'Sem Válvula'}
                                </Badge>
                            </CardHeader>
                        </Card>
                    );
                })}
            </div>
        </div>
      );
  }

  let tituloHeader = "Todas as Atividades";
  let subtituloHeader = "Histórico completo da fazenda";
  if (filtroSafra !== 'todas') {
      const s = safras.find(x => x.id === filtroSafra);
      if (s) {
          tituloHeader = s.nome;
          const t = talhoes.find(x => String(x.id) === String(s.talhao_id));
          subtituloHeader = t ? `Válvula Atrelada: ${t.nome}` : 'Safra selecionada';
      }
  } else if (filtroTalhao !== 'todos') {
      tituloHeader = getTalhaoNome(filtroTalhao);
      subtituloHeader = "Filtrado por Válvula";
  }

  // --- RENDERIZAÇÃO DA TELA DE LISTA ---
  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-300">
      
      <Dialog open={reportOpen} onOpenChange={setReportOpen}>
        <DialogContent className="sm:max-w-md rounded-[2rem]">
            <DialogHeader>
                <DialogTitle className="flex items-center gap-2 text-stone-800"><FileDown className="w-5 h-5 text-emerald-600" /> Exportar Caderno de Campo</DialogTitle>
                <DialogDescription>Gere um relatório PDF detalhado das atividades.</DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-2">
                <div className="space-y-2">
                    <Label>Válvula</Label>
                    <Select value={reportTalhao} onValueChange={setReportTalhao}>
                        <SelectTrigger className="rounded-xl"><SelectValue /></SelectTrigger>
                        <SelectContent>
                            <SelectItem value="todos">Todas as Válvulas</SelectItem>
                            {talhoes.map(t => <SelectItem key={t.id} value={t.id}>{t.nome}</SelectItem>)}
                        </SelectContent>
                    </Select>
                </div>
                <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2"><Label>Data Início</Label><Input type="date" value={reportStartDate} onChange={(e) => setReportStartDate(e.target.value)} className="rounded-xl" /></div>
                    <div className="space-y-2"><Label>Data Fim</Label><Input type="date" value={reportEndDate} onChange={(e) => setReportEndDate(e.target.value)} className="rounded-xl" /></div>
                </div>
                <Button onClick={generatePDF} className="w-full rounded-xl bg-emerald-600 hover:bg-emerald-700 font-bold text-white h-11"><FileDown className="w-4 h-4 mr-2" /> Baixar PDF</Button>
            </div>
        </DialogContent>
      </Dialog>

      <Dialog open={areaViewOpen} onOpenChange={setAreaViewOpen}>
        <DialogContent className="sm:max-w-5xl max-h-[90vh] overflow-y-auto rounded-[2rem] bg-stone-50">
            <DialogHeader className="mb-4">
                <DialogTitle className="flex items-center gap-2 text-xl text-stone-800"><LayoutGrid className="w-6 h-6 text-blue-600" /> Visão Geral por Válvula</DialogTitle>
                <DialogDescription>Resumo do preenchimento e atividades por área.</DialogDescription>
            </DialogHeader>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {areasResumo.map((area) => (
                    <Card key={area.id} className="border-stone-200 shadow-sm hover:shadow-md transition-shadow bg-white overflow-hidden">
                        <div className="p-4 border-b border-stone-100 flex justify-between items-center bg-stone-50/50"><h3 className="font-bold text-stone-800 text-lg">{area.nome}</h3><div className="text-xs font-semibold text-stone-500 bg-white px-2 py-1 rounded-lg border border-stone-200">{area.cultura || 'Diversos'}</div></div>
                        <div className="p-4 space-y-4">
                            <div className="grid grid-cols-2 gap-2 text-center">
                                <div className="bg-amber-50 rounded-lg p-2 border border-amber-100"><div className="text-xl font-bold text-amber-600">{area.qtdPendentes}</div><div className="text-xs uppercase font-bold text-amber-700/60">Programadas</div></div>
                                <div className="bg-emerald-50 rounded-lg p-2 border border-emerald-100"><div className="text-xl font-bold text-emerald-600">{area.qtdConcluidas}</div><div className="text-xs uppercase font-bold text-emerald-700/60">Concluídas</div></div>
                            </div>
                            <div>
                                <p className="text-xs font-bold text-stone-400 mb-2 uppercase tracking-wide">Próximas Atividades</p>
                                {area.proximas.length > 0 ? (
                                    <div className="space-y-1">{area.proximas.map(a => (<div key={a.id} className="flex justify-between items-center text-xs p-2 bg-stone-50 rounded-lg"><span className="font-medium text-stone-700">{getTipoLabel(a.tipo)}</span><span className="text-stone-400">{format(parseISO(a.data_programada), 'dd/MM')}</span></div>))}</div>
                                ) : (<div className="text-xs text-stone-300 italic text-center py-2 bg-stone-50 rounded-lg">Nenhuma atividade programada</div>)}
                            </div>
                            <div className="pt-2 border-t border-stone-100 flex justify-between items-center"><span className="text-xs font-medium text-stone-500">Custo Total Acumulado</span><span className="font-bold text-stone-800">R$ {area.totalCusto.toLocaleString('pt-BR', {minimumFractionDigits: 0})}</span></div>
                        </div>
                    </Card>
                ))}
            </div>
        </DialogContent>
      </Dialog>

      <Dialog open={concludeModalOpen} onOpenChange={setConcludeModalOpen}>
        <DialogContent className="sm:max-w-sm rounded-[2rem]">
            <DialogHeader>
                <DialogTitle className="flex items-center gap-2"><CheckCircle2 className="w-5 h-5 text-emerald-600" /> Concluir Atividade</DialogTitle>
                <DialogDescription>Escolha a data em que isso realmente aconteceu. É essa data que vai jogar o custo no mês certo do financeiro.</DialogDescription>
            </DialogHeader>
            {activityToConclude && (
                <div className="space-y-4 pt-2">
                    <div className="bg-stone-50 p-3 rounded-xl border border-stone-100">
                        <p className="font-bold text-stone-800 text-sm">{activityToConclude.tipo === 'outro' ? activityToConclude.tipo_personalizado : getTipoLabel(activityToConclude.tipo)}</p>
                        <p className="text-xs text-stone-500">{getTalhaoNome(activityToConclude.talhao_id)} · Custo: R$ {(activityToConclude.custo_total || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</p>
                    </div>
                    <div className="space-y-2">
                        <Label>Data Real de Realização</Label>
                        <Input type="date" value={dataConclusaoInput} onChange={(e) => setDataConclusaoInput(e.target.value)} className="rounded-xl" />
                    </div>
                    <Button onClick={handleConfirmarConclusao} disabled={updateMutation.isPending} className="w-full rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold h-11">
                        {updateMutation.isPending ? 'Salvando...' : 'Confirmar Conclusão'}
                    </Button>
                </div>
            )}
        </DialogContent>
      </Dialog>

      <Dialog open={summaryOpen} onOpenChange={setSummaryOpen}>
        <DialogContent className="sm:max-w-md rounded-[2rem]">
            <DialogHeader><DialogTitle className="flex items-center gap-2"><Send className="w-5 h-5 text-emerald-600" /> Resumo da Recomendação</DialogTitle><DialogDescription>Copie para enviar ao encarregado.</DialogDescription></DialogHeader>
            <div className="bg-stone-100 p-4 rounded-xl border border-stone-200 max-h-[300px] overflow-y-auto"><pre className="whitespace-pre-wrap text-sm font-mono text-stone-800">{summaryText}</pre></div>
            <DialogFooter><Button onClick={copyToClipboard} className="w-full rounded-xl bg-emerald-600 hover:bg-emerald-700"><Copy className="w-4 h-4 mr-2" /> Copiar Texto</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-4 bg-white p-4 rounded-[1.5rem] border border-stone-100 shadow-sm">
        <div className="flex items-center gap-4">
          <Button onClick={() => setViewMode('selecao')} variant="ghost" size="icon" className="rounded-xl bg-stone-50 hover:bg-stone-100 text-stone-600">
             <ArrowLeft className="w-5 h-5" />
          </Button>
          <div>
            <h1 className="text-2xl font-black text-stone-900 tracking-tight">{tituloHeader}</h1>
            <p className="text-stone-500 font-medium">{subtituloHeader}</p>
          </div>
        </div>
        
        <div className="flex gap-2 flex-wrap">
            <Button onClick={() => setReportOpen(true)} className="bg-white border border-stone-200 text-stone-700 hover:bg-stone-50 rounded-xl h-10 px-4 shadow-sm"><FileDown className="w-4 h-4 mr-2" /> PDF</Button>
            <Button onClick={() => setAreaViewOpen(true)} className="bg-white border border-stone-200 text-stone-700 hover:bg-stone-50 rounded-xl h-10 px-4 shadow-sm"><LayoutGrid className="w-4 h-4 mr-2" /> Visão Geral</Button>

            <Dialog open={open} onOpenChange={(v) => { if(!v) resetForm(); setOpen(v); }}>
            <DialogTrigger asChild>
                <Button onClick={handleNovaProgramacao} className="bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl h-10 px-5 shadow-lg shadow-emerald-100 transition-all active:scale-95 ml-2">
                    <Plus className="w-4 h-4 mr-2" /> Nova Programação
                </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-4xl max-h-[90vh] overflow-y-auto rounded-[2rem]">
                <DialogHeader><DialogTitle>{editingAtividade ? 'Editar Atividade' : 'Planejamento de Atividades'}</DialogTitle><DialogDescription>{editingAtividade ? 'Edite os detalhes desta atividade.' : 'Adicione várias atividades à lista e salve tudo de uma vez.'}</DialogDescription></DialogHeader>
                
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 pt-2">
                    <div className="lg:col-span-2 space-y-4 border-r border-stone-100 pr-0 lg:pr-6">
                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2"><Label>Válvula</Label><Select value={formData.talhao_id || ""} onValueChange={(value) => setFormData({ ...formData, talhao_id: value })}><SelectTrigger className="rounded-xl"><SelectValue placeholder="Selecione" /></SelectTrigger><SelectContent>{talhoes.map((talhao) => (<SelectItem key={talhao.id} value={String(talhao.id)}>{talhao.nome}</SelectItem>))}</SelectContent></Select></div>
                            <div className="space-y-2"><div className="flex items-center justify-between"><Label>Tipo de Atividade</Label><Button type="button" variant="ghost" size="sm" onClick={() => setOpenTipoDialog(true)} className="h-6 text-xs text-blue-600 px-2 rounded-lg"><Plus className="w-3 h-3 mr-1" /> Gerenciar</Button></div><Select value={formData.tipo || ""} onValueChange={(value) => setFormData({ ...formData, tipo: value })}><SelectTrigger className="rounded-xl"><SelectValue placeholder="Selecione" /></SelectTrigger><SelectContent>{todosTipos.map((tipo) => (<SelectItem key={tipo.value} value={tipo.value}>{tipo.label}</SelectItem>))}</SelectContent></Select></div>
                        </div>

                        {formData.tipo === 'outro' && (<div className="space-y-2"><Label>Nome da Atividade</Label><Input value={formData.tipo_personalizado || ""} onChange={(e) => setFormData({ ...formData, tipo_personalizado: e.target.value })} className="rounded-xl" /></div>)}

                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2"><Label>Data Programada</Label><Input type="date" value={formData.data_programada || ""} onChange={(e) => setFormData({ ...formData, data_programada: e.target.value })} className="rounded-xl" /></div>
                            <div className="space-y-2"><Label>Status</Label><Select value={formData.status || ""} onValueChange={(value) => setFormData({ ...formData, status: value })}><SelectTrigger className="rounded-xl"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="programada">Programada</SelectItem><SelectItem value="em_andamento">Em Andamento</SelectItem><SelectItem value="concluida">Concluída</SelectItem></SelectContent></Select></div>
                        </div>

                        <div className="space-y-2"><Label>Responsável</Label><Input value={formData.responsavel || ""} onChange={(e) => setFormData({ ...formData, responsavel: e.target.value })} className="rounded-xl" /></div>

                        <div className="p-4 bg-stone-50 rounded-xl space-y-4 border border-stone-100">
                            <div className="flex items-center justify-between"><Label className="text-base font-medium text-stone-700">Atividade Terceirizada</Label><Switch checked={formData.terceirizada} onCheckedChange={(checked) => setFormData({ ...formData, terceirizada: checked })} /></div>
                            {formData.terceirizada && (<div className="space-y-2 animate-in fade-in slide-in-from-top-2"><Label>Valor do Serviço</Label><Input type="number" step="0.01" value={formData.valor_terceirizado || ""} onChange={(e) => setFormData({ ...formData, valor_terceirizado: e.target.value })} placeholder="R$ 0,00" className="rounded-xl" /></div>)}
                        </div>

                        <div className="p-4 bg-stone-50 rounded-xl space-y-3 border border-stone-100">
                            <Label className="text-sm font-bold text-stone-700">Insumos (Opcional)</Label>
                            <div className="flex gap-2">
                                <Select value={insumoTemp.insumo_id || ""} onValueChange={(value) => setInsumoTemp({ ...insumoTemp, insumo_id: value })}><SelectTrigger className="w-full rounded-xl bg-white h-9 text-xs"><SelectValue placeholder="Insumo" /></SelectTrigger><SelectContent>{insumos.map((i) => (<SelectItem key={i.id} value={i.id}>{i.nome}</SelectItem>))}</SelectContent></Select>
                                <Input type="number" placeholder="Qtd" className="w-20 rounded-xl bg-white h-9 text-xs" value={insumoTemp.quantidade || ""} onChange={(e) => setInsumoTemp({ ...insumoTemp, quantidade: e.target.value })} />
                                <Select value={insumoTemp.metodo_aplicacao || "foliar"} onValueChange={(value) => { setInsumoTemp({ ...insumoTemp, metodo_aplicacao: value }); setMostrarNovoMetodo(value === 'outro'); }}><SelectTrigger className="w-32 rounded-xl bg-white h-9 text-xs"><SelectValue placeholder="Método" /></SelectTrigger><SelectContent><SelectItem value="foliar">Foliar</SelectItem><SelectItem value="adubacao">Adubação</SelectItem><SelectItem value="solo">Solo</SelectItem><SelectItem value="fertirrigacao">Fertirrigação</SelectItem><SelectItem value="outro">Outro...</SelectItem></SelectContent></Select>
                                {mostrarNovoMetodo && <Input placeholder="Nome" className="w-24 rounded-xl bg-white h-9 text-xs" value={novoMetodo || ""} onChange={(e) => setNovoMetodo(e.target.value)} />}
                                <Button type="button" onClick={addInsumo} size="sm" className="rounded-xl bg-white hover:bg-emerald-50 text-emerald-600 border border-emerald-200"><Plus className="w-4 h-4" /></Button>
                            </div>
                            
                            {formData.insumos_utilizados.length > 0 && (
                                <div className="flex flex-wrap gap-2">
                                    {formData.insumos_utilizados.map((ins, idx) => (
                                        <Badge key={idx} variant="secondary" className="bg-white border-stone-200 text-stone-600 pr-1 py-1">
                                            {ins.nome} ({ins.quantidade}) - <span className="capitalize ml-1 font-bold">{ins.metodo_aplicacao}</span>
                                            <button onClick={() => removeInsumo(idx)} className="ml-1 text-red-400 hover:text-red-600"><X className="w-3 h-3"/></button>
                                        </Badge>
                                    ))}
                                </div>
                            )}
                        </div>

                        <div className="flex items-center justify-between p-4 bg-emerald-50 rounded-xl border border-emerald-100"><span className="font-medium text-emerald-800">Custo Total Previsto</span><span className="text-xl font-bold text-emerald-700">R$ {calcularCustoTotal().toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span></div>
                        <div className="space-y-2"><Label>Observações</Label><Textarea value={formData.observacoes || ""} onChange={(e) => setFormData({ ...formData, observacoes: e.target.value })} rows={2} className="rounded-xl" placeholder="Detalhes para o encarregado..." /></div>

                        {!editingAtividade && (<Button onClick={handleAddToQueue} className="w-full rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold h-12"><ListPlus className="w-5 h-5 mr-2" /> Adicionar à Lista</Button>)}
                    </div>

                    <div className="lg:col-span-1 bg-stone-50 rounded-2xl border border-stone-200 p-4 flex flex-col h-full min-h-[300px]">
                        <h4 className="text-sm font-bold text-stone-700 mb-3 flex items-center gap-2"><ClipboardList className="w-4 h-4" /> Lista de Programação ({activityQueue.length})</h4>
                        {editingAtividade ? (
                            <div className="flex-1 flex items-center justify-center text-center text-stone-400 text-xs italic">Modo de edição individual.<br/>A lista está desabilitada.</div>
                        ) : (
                            <>
                                <div className="flex-1 overflow-y-auto space-y-2 max-h-[400px] pr-1 scrollbar-thin">
                                    {activityQueue.length === 0 ? (
                                        <div className="text-center text-stone-400 text-xs py-10 italic">Preencha o formulário e clique em "Adicionar à Lista".</div>
                                    ) : (
                                        activityQueue.map((item) => (
                                            <div key={item.tempId} className="bg-white p-3 rounded-xl border border-stone-100 shadow-sm text-sm relative group animate-in slide-in-from-left-2">
                                                <button onClick={() => handleRemoveFromQueue(item.tempId)} className="absolute top-2 right-2 text-stone-300 hover:text-red-500 transition-colors"><X className="w-4 h-4" /></button>
                                                <div className="font-bold text-emerald-700">{item.talhao_nome}</div>
                                                <div className="font-medium text-stone-700">{item.tipo === 'outro' ? item.tipo_personalizado : getTipoLabel(item.tipo)}</div>
                                                <div className="text-xs text-stone-500 mt-1 flex items-center gap-1"><CalendarIcon className="w-3 h-3"/> {format(parseISO(item.data_programada), 'dd/MM/yyyy')}</div>
                                                {item.terceirizada && <div className="text-xs text-blue-600 font-bold mt-1">Terceirizado: R$ {parseFloat(item.valor_terceirizado || 0).toLocaleString('pt-BR')}</div>}
                                                {item.insumos_utilizados.length > 0 && (<div className="mt-2 pt-2 border-t border-stone-50 flex gap-1 flex-wrap">{item.insumos_utilizados.map((i, k) => (<span key={k} className="text-xs bg-stone-100 px-1 rounded text-stone-500">{i.nome} - <span className="capitalize">{i.metodo_aplicacao}</span></span>))}</div>)}
                                            </div>
                                        ))
                                    )}
                                </div>
                                <div className="mt-4 pt-4 border-t border-stone-200">
                                    <Button onClick={handleSaveAll} disabled={activityQueue.length === 0 || createBatchMutation.isPending} className="w-full rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold h-11 shadow-lg shadow-emerald-100">{createBatchMutation.isPending ? 'Salvando...' : `Confirmar (${activityQueue.length})`}</Button>
                                </div>
                            </>
                        )}
                    </div>
                </div>

                {editingAtividade && (
                    <DialogFooter className="mt-4 border-t pt-4">
                        <Button type="button" variant="outline" onClick={resetForm} className="rounded-xl border-stone-200">Cancelar</Button>
                        <Button onClick={handleSubmitForm} className="bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl px-6">Salvar Alterações</Button>
                    </DialogFooter>
                )}
            </DialogContent>
            </Dialog>

            <Dialog open={openTipoDialog} onOpenChange={setOpenTipoDialog}>
            <DialogContent className="sm:max-w-md rounded-[2rem]">
                <DialogHeader><DialogTitle>Gerenciar Tipos</DialogTitle></DialogHeader>
                <div className="space-y-4">
                <div className="flex gap-2">
                    <Input value={novoTipo || ""} onChange={(e) => setNovoTipo(e.target.value)} placeholder="Novo tipo..." className="rounded-xl" />
                    <Button onClick={() => createTipoMutation.mutate({ nome: novoTipo })} disabled={!novoTipo} className="rounded-xl bg-emerald-600 hover:bg-emerald-700"><Plus className="w-4 h-4" /></Button>
                </div>
                <div className="border rounded-xl divide-y overflow-hidden">
                    {tiposCustomizados.map((tipo) => (
                    <div key={tipo.id} className="flex justify-between p-3 bg-stone-50 hover:bg-white transition-colors">
                        <span className="text-sm font-medium">{tipo.nome}</span>
                        <Button variant="ghost" size="sm" onClick={() => deleteTipoMutation.mutate(tipo.id)} className="h-6 w-6 p-0 text-red-400 hover:text-red-600"><Trash2 className="w-3 h-3" /></Button>
                    </div>
                    ))}
                </div>
                </div>
            </DialogContent>
            </Dialog>
        </div>
      </div>

      <Card className="border-stone-100 rounded-[2rem] shadow-sm">
        <CardContent className="pt-6 pb-6">
          <div className="flex flex-wrap items-center gap-4">
            <div className="flex items-center gap-2 text-stone-500">
              <Filter className="w-4 h-4" />
              <span className="text-sm font-bold uppercase tracking-wide">Filtros Ativos:</span>
            </div>
            
            <Select value={filtroSafra || "todas"} onValueChange={setFiltroSafra}>
              <SelectTrigger className="w-64 rounded-xl bg-emerald-50 border-emerald-200 font-bold text-emerald-800"><SelectValue placeholder="Filtrar por Safra" /></SelectTrigger>
              <SelectContent>
                  <SelectItem value="todas">Todas as Atividades</SelectItem>
                  {safras.map((s) => (<SelectItem key={s.id} value={s.id}>{s.nome}</SelectItem>))}
              </SelectContent>
            </Select>

            {filtroSafra === 'todas' && (
                <Select value={filtroTalhao || "todos"} onValueChange={setFiltroTalhao}>
                <SelectTrigger className="w-48 rounded-xl bg-stone-50 border-stone-200"><SelectValue placeholder="Válvula" /></SelectTrigger>
                <SelectContent>{talhoes.map((t) => (<SelectItem key={t.id} value={String(t.id)}>{t.nome}</SelectItem>))}<SelectItem value="todos">Todos</SelectItem></SelectContent>
                </Select>
            )}

            <Select value={filtroStatus || "todos"} onValueChange={setFiltroStatus}>
              <SelectTrigger className="w-40 rounded-xl bg-stone-50 border-stone-200"><SelectValue placeholder="Status" /></SelectTrigger>
              <SelectContent><SelectItem value="todos">Todos</SelectItem><SelectItem value="programada">Programada</SelectItem><SelectItem value="concluida">Concluída</SelectItem></SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {atividadesFiltradas.length === 0 ? (
        <EmptyState icon={ClipboardList} title="Nenhuma atividade encontrada" description="Ajuste os filtros ou cadastre uma nova." actionLabel="Nova Programação" onAction={handleNovaProgramacao} />
      ) : (
        <Card className="border-stone-100 rounded-[2rem] shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader className="bg-stone-50">
                <TableRow>
                  <TableHead className="pl-6 w-[120px]">Data</TableHead>
                  <TableHead>Atividade</TableHead>
                  <TableHead>Válvula</TableHead>
                  <TableHead className="text-right">Custo Total</TableHead>
                  <TableHead className="text-center w-[120px]">Status</TableHead>
                  <TableHead className="w-[180px] text-right pr-6">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {atividadesFiltradas.map((atividade) => (
                  <TableRow key={atividade.id} className="hover:bg-stone-50 transition-colors">
                    <TableCell className="pl-6 font-medium text-stone-600">
                        {(() => {
                            const dataExibir = atividade.data_realizada || atividade.data_programada;
                            if (!dataExibir) return <span className="text-stone-300 italic text-xs">Sem data</span>;
                            return format(new Date(dataExibir + 'T12:00:00'), 'dd/MM/yy');
                        })()}
                    </TableCell>
                    <TableCell>
                        <div className="font-bold text-stone-800">{atividade.tipo === 'outro' ? atividade.tipo_personalizado : getTipoLabel(atividade.tipo)}</div>
                        <div className="text-xs text-stone-400">{atividade.responsavel && `Resp: ${atividade.responsavel}`}</div>
                        {atividade.terceirizada && <Badge variant="outline" className="text-xs border-blue-200 text-blue-600 mt-1">Terceirizado</Badge>}
                    </TableCell>
                    <TableCell><Badge variant="outline" className="bg-white border-stone-200 text-stone-600">{getTalhaoNome(atividade.talhao_id)}</Badge></TableCell>
                    <TableCell className="text-right font-medium text-stone-700">R$ {(atividade.custo_total || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</TableCell>
                    <TableCell className="text-center">
                      <Badge className={`${statusLabels[atividade.status]?.color} border`}>{statusLabels[atividade.status]?.label}</Badge>
                    </TableCell>
                    <TableCell className="text-right pr-6">
                      <div className="flex justify-end gap-1">
                        {atividade.status !== 'concluida' && (
                            <Button variant="ghost" size="icon" className="h-8 w-8 text-emerald-500 hover:text-emerald-700 hover:bg-emerald-50 rounded-lg" onClick={() => { setActivityToConclude(atividade); setDataConclusaoInput(format(new Date(), 'yyyy-MM-dd')); setConcludeModalOpen(true); }} title="Concluir">
                                <CheckCircle2 className="w-4 h-4" />
                            </Button>
                        )}
                        <Button variant="ghost" size="icon" className="h-8 w-8 text-emerald-500 hover:text-emerald-700 hover:bg-emerald-50 rounded-lg" onClick={() => handleViewActivityText(atividade)} title="Ver Texto"><FileText className="w-4 h-4" /></Button>
                        <Button variant="ghost" size="icon" className="h-8 w-8 text-stone-400 hover:text-stone-700 hover:bg-stone-100 rounded-lg" onClick={() => handleEdit(atividade)} title="Editar"><Edit className="w-4 h-4" /></Button>
                        <Button variant="ghost" size="icon" className="h-8 w-8 text-blue-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg" onClick={() => handleDuplicate(atividade)} title="Duplicar"><Copy className="w-4 h-4" /></Button>
                        <Button variant="ghost" size="icon" className="h-8 w-8 text-red-300 hover:text-red-500 hover:bg-red-50 rounded-lg" onClick={() => { if(confirm("Excluir?")) deleteMutation.mutate(atividade.id) }} title="Excluir"><Trash2 className="w-4 h-4" /></Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </Card>
      )}
    </div>
  );
}