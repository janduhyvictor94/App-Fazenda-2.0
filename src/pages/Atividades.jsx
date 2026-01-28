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
import { Plus, Edit, Trash2, ClipboardList, Filter, Package, Copy, MessageCircle, CheckCircle2, Calendar as CalendarIcon, ListPlus, X, Send, FileText } from 'lucide-react';
import EmptyState from '@/components/ui/EmptyState';
import { format, parseISO } from 'date-fns';

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
  const [open, setOpen] = useState(false);
  const [summaryOpen, setSummaryOpen] = useState(false);
  const [summaryText, setSummaryText] = useState('');
  
  const [editingAtividade, setEditingAtividade] = useState(null);
  const [activityQueue, setActivityQueue] = useState([]);

  const [filtroTalhao, setFiltroTalhao] = useState('todos');
  const [filtroStatus, setFiltroStatus] = useState('todos');
  
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

  // --- QUERIES ---
  const { data: talhoes = [] } = useQuery({
    queryKey: ['talhoes'],
    queryFn: async () => { const { data } = await supabase.from('talhoes').select('*'); return data || []; }
  });

  const { data: atividades = [] } = useQuery({
    queryKey: ['atividades'],
    queryFn: async () => { const { data } = await supabase.from('atividades').select('*').order('data_programada', { ascending: false }); return data || []; }
  });

  const { data: insumos = [] } = useQuery({
    queryKey: ['insumos'],
    queryFn: async () => { const { data } = await supabase.from('insumos').select('*'); return data || []; }
  });

  const { data: tiposCustomizados = [] } = useQuery({
    queryKey: ['tipos-atividade'],
    queryFn: async () => { const { data } = await supabase.from('tipos_atividade').select('*'); return data || []; }
  });

  // --- MUTAÇÕES ---
  const createBatchMutation = useMutation({
    mutationFn: async (activities) => {
      const payload = activities.map(a => {
          const { talhao_nome, tempId, ...rest } = a;
          if (rest.valor_terceirizado === '') rest.valor_terceirizado = null;
          return rest;
      });
      const { error } = await supabase.from('atividades').insert(payload);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['atividades'] });
      generateSummaryText(activityQueue);
      setActivityQueue([]);
      setOpen(false);
      setSummaryOpen(true);
    }
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }) => {
      const payload = { ...data };
      if (payload.valor_terceirizado === '') payload.valor_terceirizado = null;
      const { data: result, error } = await supabase.from('atividades').update(payload).eq('id', id).select();
      if (error) throw error; return result;
    },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['atividades'] }); resetForm(); }
  });

  const deleteMutation = useMutation({
    mutationFn: async (id) => { const { error } = await supabase.from('atividades').delete().eq('id', id); if (error) throw error; },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['atividades'] }); }
  });

  const createTipoMutation = useMutation({
    mutationFn: async (data) => { const { data: result, error } = await supabase.from('tipos_atividade').insert(data).select(); if (error) throw error; return result; },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['tipos-atividade'] }); setNovoTipo(''); }
  });

  const deleteTipoMutation = useMutation({
    mutationFn: async (id) => { const { error } = await supabase.from('tipos_atividade').delete().eq('id', id); if (error) throw error; },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['tipos-atividade'] }); }
  });

  // --- LÓGICA DE FILA E RESUMO ---
  const handleAddToQueue = (e) => {
      e.preventDefault();
      if (!formData.talhao_id || !formData.tipo || !formData.data_programada) {
          alert("Preencha Válvula/Talhão, Tipo e Data para adicionar.");
          return;
      }
      const talhaoNome = talhoes.find(t => t.id === formData.talhao_id)?.nome || 'Válvula';
      const custoCalc = calcularCustoTotal();
      
      const newItem = {
          ...formData,
          valor_terceirizado: formData.valor_terceirizado ? parseFloat(formData.valor_terceirizado) : null,
          custo_total: custoCalc,
          data_realizada: formData.status === 'concluida' ? (formData.data_realizada || format(new Date(), 'yyyy-MM-dd')) : null,
          talhao_nome: talhaoNome,
          tempId: Date.now()
      };

      setActivityQueue([...activityQueue, newItem]);
      
      setFormData(prev => ({ 
          ...prev, 
          talhao_id: '', 
          observacoes: '', 
          insumos_utilizados: [], 
          custo_total: 0, 
          terceirizada: false, 
          valor_terceirizado: '' 
      }));
  };

  const handleRemoveFromQueue = (tempId) => {
      setActivityQueue(activityQueue.filter(item => item.tempId !== tempId));
  };

  const handleSaveAll = () => {
      if (activityQueue.length === 0) return;
      createBatchMutation.mutate(activityQueue);
  };

  const generateSummaryText = (items) => {
      const grouped = items.reduce((acc, curr) => {
          const key = curr.talhao_nome;
          if (!acc[key]) acc[key] = [];
          acc[key].push(curr);
          return acc;
      }, {});

      let text = "*📋 PROGRAMAÇÃO DE ATIVIDADES*\n\n";
      Object.keys(grouped).forEach(talhao => {
          text += `*📍 ${talhao.toUpperCase()}*\n`; // Nome do Talhão/Válvula
          grouped[talhao].sort((a, b) => new Date(a.data_programada) - new Date(b.data_programada)).forEach(ativ => {
              const date = format(parseISO(ativ.data_programada), 'dd/MM');
              const tipoLabel = ativ.tipo === 'outro' ? ativ.tipo_personalizado : getTipoLabel(ativ.tipo);
              text += `🔹 ${date}: ${tipoLabel}`;
              if (ativ.terceirizada) text += ` (Terceirizado)`;
              if (ativ.insumos_utilizados?.length > 0) {
                  const insumosText = ativ.insumos_utilizados.map(i => {
                      const metodo = i.metodo_aplicacao ? `[${i.metodo_aplicacao}]` : '';
                      return `${i.nome} (${i.quantidade}${i.unidade}) ${metodo}`;
                  }).join(', ');
                  text += `\n   📦 Insumos: ${insumosText}`;
              }
              if (ativ.observacoes) text += `\n   📝 _Obs: ${ativ.observacoes}_`;
              text += `\n`;
          });
          text += `\n`;
      });
      text += `_Gerado pelo Sistema Fazenda Cassiano's_`;
      setSummaryText(text);
  };

  const handleViewActivityText = (atividade) => {
    const talhaoNome = getTalhaoNome(atividade.talhao_id);
    const tipoNome = atividade.tipo === 'outro' ? atividade.tipo_personalizado : getTipoLabel(atividade.tipo);
    const data = format(new Date(atividade.data_programada + 'T12:00:00'), 'dd/MM/yyyy');
    
    let text = `📋 *DETALHES DA ATIVIDADE*\n\n`;
    text += `📍 *Válvula:* ${talhaoNome}\n`; // ALTERADO PARA VÁLVULA
    text += `🚜 *Atividade:* ${tipoNome}\n`;
    text += `📅 *Data:* ${data}\n`;
    
    if (atividade.terceirizada) text += `👷 *Serviço:* Terceirizado\n`;
    
    if (atividade.insumos_utilizados && atividade.insumos_utilizados.length > 0) {
        text += `\n📦 *Insumos:*`;
        atividade.insumos_utilizados.forEach(i => {
            text += `\n   ▪ ${i.nome}: ${i.quantidade} ${i.unidade}`;
            if(i.metodo_aplicacao) text += ` (${i.metodo_aplicacao})`;
        });
        text += `\n`;
    }

    if (atividade.observacoes) text += `\n📝 *Observações:*\n${atividade.observacoes}`;

    setSummaryText(text);
    setSummaryOpen(true);
  };

  const copyToClipboard = () => {
      navigator.clipboard.writeText(summaryText);
      alert("Texto copiado! Agora cole no WhatsApp do encarregado.");
  };

  // --- LÓGICA PADRÃO ---
  const resetForm = () => {
    setFormData({
      talhao_id: '', tipo: '', tipo_personalizado: '',
      data_programada: format(new Date(), 'yyyy-MM-dd'), data_realizada: '',
      status: 'programada', terceirizada: false, valor_terceirizado: '',
      insumos_utilizados: [], custo_total: 0, responsavel: '', observacoes: ''
    });
    setInsumoTemp({ insumo_id: '', quantidade: '', metodo_aplicacao: 'foliar' });
    setNovoMetodo('');
    setMostrarNovoMetodo(false);
    setActivityQueue([]); 
    setEditingAtividade(null);
    setOpen(false);
  };

  const handleEdit = (atividade) => {
    setEditingAtividade(atividade);
    setFormData({ ...atividade }); 
    setActivityQueue([]); 
    setOpen(true);
  };

  const handleDuplicate = (atividade) => {
    setEditingAtividade(null);
    setFormData({ ...atividade, id: undefined, status: 'programada', data_realizada: '' }); 
    setActivityQueue([]); 
    setOpen(true);
  };

  const addInsumo = () => {
    if (!insumoTemp.insumo_id || !insumoTemp.quantidade) return;
    const insumoSelecionado = insumos.find(i => i.id === insumoTemp.insumo_id);
    if (!insumoSelecionado) return;

    const quantidade = parseFloat(insumoTemp.quantidade);
    const valorUnitario = insumoSelecionado.preco_unitario || 0;
    const valorTotal = quantidade * valorUnitario;
    
    const metodoFinal = (insumoTemp.metodo_aplicacao === 'outro' ? novoMetodo : insumoTemp.metodo_aplicacao) || 'foliar';

    const novoInsumo = {
      insumo_id: insumoSelecionado.id, nome: insumoSelecionado.nome,
      quantidade, unidade: insumoSelecionado.unidade,
      valor_unitario: valorUnitario, valor_total: valorTotal,
      metodo_aplicacao: metodoFinal
    };

    const novosInsumos = [...formData.insumos_utilizados, novoInsumo];
    setFormData({ 
        ...formData, 
        insumos_utilizados: novosInsumos,
        custo_total: novosInsumos.reduce((acc, i) => acc + (i.valor_total || 0), 0) + (formData.terceirizada ? parseFloat(formData.valor_terceirizado || 0) : 0)
    });
    setInsumoTemp({ insumo_id: '', quantidade: '', metodo_aplicacao: 'foliar' });
    setNovoMetodo('');
    setMostrarNovoMetodo(false);
  };

  const removeInsumo = (index) => {
    const novosInsumos = formData.insumos_utilizados.filter((_, i) => i !== index);
    setFormData({ 
        ...formData, 
        insumos_utilizados: novosInsumos,
        custo_total: novosInsumos.reduce((acc, i) => acc + (i.valor_total || 0), 0) + (formData.terceirizada ? parseFloat(formData.valor_terceirizado || 0) : 0)
    });
  };

  const calcularCustoTotal = () => {
    const custoInsumos = formData.insumos_utilizados.reduce((acc, i) => acc + (i.valor_total || 0), 0);
    const custoTerceirizado = formData.terceirizada ? parseFloat(formData.valor_terceirizado || 0) : 0; 
    return custoInsumos + custoTerceirizado;
  };

  const handleSubmitForm = (e) => {
      e.preventDefault();
      const payload = {
          ...formData,
          valor_terceirizado: formData.valor_terceirizado ? parseFloat(formData.valor_terceirizado) : null,
          custo_total: calcularCustoTotal(),
          data_realizada: formData.status === 'concluida' ? (formData.data_realizada || format(new Date(), 'yyyy-MM-dd')) : null
      };

      if (editingAtividade) {
          updateMutation.mutate({ id: editingAtividade.id, data: payload });
      } else {
          createMutation.mutate(payload);
      }
  };
  
  const createMutation = useMutation({
    mutationFn: async (data) => {
      const { data: result, error } = await supabase.from('atividades').insert(data).select();
      if (error) throw error; return result;
    },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['atividades'] }); resetForm(); }
  });

  const atividadesFiltradas = atividades.filter(a => {
    if (filtroTalhao !== 'todos' && a.talhao_id !== filtroTalhao) return false;
    if (filtroStatus !== 'todos' && a.status !== filtroStatus) return false;
    return true;
  });

  const getTalhaoNome = (id) => talhoes.find(t => t.id === id)?.nome || '-';
  const getTipoLabel = (tipo) => {
    const padrao = tiposAtividadePadrao.find(t => t.value === tipo);
    if (padrao) return padrao.label;
    const customizado = tiposCustomizados.find(t => t.nome === tipo);
    return customizado ? customizado.nome : tipo;
  };

  const handleShareWhatsApp = (atividade) => {
    const talhaoNome = getTalhaoNome(atividade.talhao_id);
    const tipoNome = atividade.tipo === 'outro' ? atividade.tipo_personalizado : getTipoLabel(atividade.tipo);
    const data = format(new Date(atividade.data_programada + 'T12:00:00'), 'dd/MM/yyyy');
    const text = `🚜 *Nova Atividade Programada*\n\n📍 *Válvula:* ${talhaoNome}\n🔧 *Atividade:* ${tipoNome}\n📅 *Data:* ${data}\n${atividade.observacoes ? `📝 *Obs:* ${atividade.observacoes}` : ''}`;
    const url = `https://wa.me/?text=${encodeURIComponent(text)}`;
    window.open(url, '_blank');
  };

  const todosTipos = [ ...tiposAtividadePadrao, ...tiposCustomizados.map(t => ({ value: t.nome, label: t.nome })) ];

  return (
    <div className="space-y-6">
      
      {/* Modal de Resumo para WhatsApp */}
      <Dialog open={summaryOpen} onOpenChange={setSummaryOpen}>
        <DialogContent className="sm:max-w-md rounded-[2rem]">
            <DialogHeader>
                <DialogTitle className="flex items-center gap-2"><Send className="w-5 h-5 text-emerald-600" /> Resumo da Recomendação</DialogTitle>
                <DialogDescription>Abaixo está o texto gerado. Copie para enviar ao encarregado.</DialogDescription>
            </DialogHeader>
            <div className="bg-stone-100 p-4 rounded-xl border border-stone-200 max-h-[300px] overflow-y-auto">
                <pre className="whitespace-pre-wrap text-sm font-mono text-stone-800">{summaryText}</pre>
            </div>
            <DialogFooter>
                <Button onClick={copyToClipboard} className="w-full rounded-xl bg-emerald-600 hover:bg-emerald-700">
                    <Copy className="w-4 h-4 mr-2" /> Copiar Texto
                </Button>
            </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Header Padronizado */}
      <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-4 bg-white p-4 rounded-[1.5rem] border border-stone-100 shadow-sm">
        <div>
          <h1 className="text-2xl font-bold text-stone-900 tracking-tight">Atividades</h1>
          <p className="text-stone-500 font-medium">Gerenciamento de tarefas e manejo</p>
        </div>
        
        <Dialog open={open} onOpenChange={(v) => { if(!v) resetForm(); setOpen(v); }}>
          <DialogTrigger asChild>
            <Button className="bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl h-10 px-5 shadow-lg shadow-emerald-100 transition-all active:scale-95 ml-2">
              <Plus className="w-4 h-4 mr-2" /> Nova Programação
            </Button>
          </DialogTrigger>
          {/* AUMENTADO A LARGURA DO MODAL PARA CABER A LISTA */}
          <DialogContent className="sm:max-w-4xl max-h-[90vh] overflow-y-auto rounded-[2rem]">
            <DialogHeader>
              <DialogTitle>{editingAtividade ? 'Editar Atividade' : 'Planejamento de Atividades'}</DialogTitle>
              <DialogDescription>
                  {editingAtividade ? 'Edite os detalhes desta atividade.' : 'Adicione várias atividades à lista e salve tudo de uma vez.'}
              </DialogDescription>
            </DialogHeader>
            
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 pt-2">
                
                {/* COLUNA 1 e 2: FORMULÁRIO (OCUPA 2/3) */}
                <div className="lg:col-span-2 space-y-4 border-r border-stone-100 pr-0 lg:pr-6">
                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                        <Label>Válvula</Label> {/* ALTERADO AQUI */}
                        <Select value={formData.talhao_id || ""} onValueChange={(value) => setFormData({ ...formData, talhao_id: value })}>
                            <SelectTrigger className="rounded-xl"><SelectValue placeholder="Selecione" /></SelectTrigger>
                            <SelectContent>{talhoes.map((talhao) => (<SelectItem key={talhao.id} value={talhao.id}>{talhao.nome}</SelectItem>))}</SelectContent>
                        </Select>
                        </div>
                        <div className="space-y-2">
                        <div className="flex items-center justify-between">
                            <Label>Tipo de Atividade</Label>
                            <Button type="button" variant="ghost" size="sm" onClick={() => setOpenTipoDialog(true)} className="h-6 text-xs text-blue-600 hover:text-blue-700 hover:bg-blue-50 px-2 rounded-lg">
                                <Plus className="w-3 h-3 mr-1" /> Gerenciar Tipos
                            </Button>
                        </div>
                        <Select value={formData.tipo || ""} onValueChange={(value) => setFormData({ ...formData, tipo: value })}>
                            <SelectTrigger className="rounded-xl"><SelectValue placeholder="Selecione" /></SelectTrigger>
                            <SelectContent>{todosTipos.map((tipo) => (<SelectItem key={tipo.value} value={tipo.value}>{tipo.label}</SelectItem>))}</SelectContent>
                        </Select>
                        </div>
                    </div>

                    {formData.tipo === 'outro' && (
                        <div className="space-y-2"><Label>Nome da Atividade</Label><Input value={formData.tipo_personalizado || ""} onChange={(e) => setFormData({ ...formData, tipo_personalizado: e.target.value })} className="rounded-xl" /></div>
                    )}

                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2"><Label>Data Programada</Label><Input type="date" value={formData.data_programada || ""} onChange={(e) => setFormData({ ...formData, data_programada: e.target.value })} className="rounded-xl" /></div>
                        <div className="space-y-2"><Label>Status</Label><Select value={formData.status || ""} onValueChange={(value) => setFormData({ ...formData, status: value })}><SelectTrigger className="rounded-xl"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="programada">Programada</SelectItem><SelectItem value="em_andamento">Em Andamento</SelectItem><SelectItem value="concluida">Concluída</SelectItem></SelectContent></Select></div>
                    </div>

                    <div className="space-y-2"><Label>Responsável</Label><Input value={formData.responsavel || ""} onChange={(e) => setFormData({ ...formData, responsavel: e.target.value })} className="rounded-xl" /></div>

                    {/* SEÇÃO TERCEIRIZAÇÃO */}
                    <div className="p-4 bg-stone-50 rounded-xl space-y-4 border border-stone-100">
                        <div className="flex items-center justify-between">
                            <Label className="text-base font-medium text-stone-700">Atividade Terceirizada</Label>
                            <Switch checked={formData.terceirizada} onCheckedChange={(checked) => setFormData({ ...formData, terceirizada: checked })} />
                        </div>
                        {formData.terceirizada && (
                            <div className="space-y-2 animate-in fade-in slide-in-from-top-2">
                                <Label>Valor do Serviço</Label>
                                <Input type="number" step="0.01" value={formData.valor_terceirizado || ""} onChange={(e) => setFormData({ ...formData, valor_terceirizado: e.target.value })} placeholder="R$ 0,00" className="rounded-xl" />
                            </div>
                        )}
                    </div>

                    {/* SEÇÃO INSUMOS */}
                    <div className="p-4 bg-stone-50 rounded-xl space-y-3 border border-stone-100">
                        <Label className="text-sm font-bold text-stone-700">Insumos (Opcional)</Label>
                        <div className="flex gap-2">
                            <Select value={insumoTemp.insumo_id || ""} onValueChange={(value) => setInsumoTemp({ ...insumoTemp, insumo_id: value })}>
                                <SelectTrigger className="w-full rounded-xl bg-white h-9 text-xs"><SelectValue placeholder="Insumo" /></SelectTrigger>
                                <SelectContent>{insumos.map((i) => (<SelectItem key={i.id} value={i.id}>{i.nome}</SelectItem>))}</SelectContent>
                            </Select>
                            <Input type="number" placeholder="Qtd" className="w-20 rounded-xl bg-white h-9 text-xs" value={insumoTemp.quantidade || ""} onChange={(e) => setInsumoTemp({ ...insumoTemp, quantidade: e.target.value })} />
                            
                            <Select value={insumoTemp.metodo_aplicacao || "foliar"} onValueChange={(value) => { setInsumoTemp({ ...insumoTemp, metodo_aplicacao: value }); setMostrarNovoMetodo(value === 'outro'); }}>
                                <SelectTrigger className="w-32 rounded-xl bg-white h-9 text-xs"><SelectValue placeholder="Método" /></SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="foliar">Foliar</SelectItem>
                                    <SelectItem value="adubacao">Adubação</SelectItem>
                                    <SelectItem value="solo">Solo</SelectItem>
                                    <SelectItem value="fertirrigacao">Fertirrigação</SelectItem>
                                    <SelectItem value="outro">Outro...</SelectItem>
                                </SelectContent>
                            </Select>
                            
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

                    <div className="flex items-center justify-between p-4 bg-emerald-50 rounded-xl border border-emerald-100">
                        <span className="font-medium text-emerald-800">Custo Total Previsto</span>
                        <span className="text-xl font-bold text-emerald-700">R$ {calcularCustoTotal().toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
                    </div>

                    <div className="space-y-2">
                        <Label>Observações</Label>
                        <Textarea value={formData.observacoes || ""} onChange={(e) => setFormData({ ...formData, observacoes: e.target.value })} rows={2} className="rounded-xl" placeholder="Detalhes para o encarregado..." />
                    </div>

                    {!editingAtividade && (
                        <Button onClick={handleAddToQueue} className="w-full rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold h-12">
                            <ListPlus className="w-5 h-5 mr-2" /> Adicionar à Lista
                        </Button>
                    )}
                </div>

                {/* COLUNA 3: LISTA DE PRÉ-LANÇAMENTO */}
                <div className="lg:col-span-1 bg-stone-50 rounded-2xl border border-stone-200 p-4 flex flex-col h-full min-h-[300px]">
                    <h4 className="text-sm font-bold text-stone-700 mb-3 flex items-center gap-2">
                        <ClipboardList className="w-4 h-4" /> Lista de Programação ({activityQueue.length})
                    </h4>
                    
                    {editingAtividade ? (
                        <div className="flex-1 flex items-center justify-center text-center text-stone-400 text-xs italic">
                            Modo de edição individual.<br/>A lista está desabilitada.
                        </div>
                    ) : (
                        <>
                            <div className="flex-1 overflow-y-auto space-y-2 max-h-[400px] pr-1 scrollbar-thin">
                                {activityQueue.length === 0 ? (
                                    <div className="text-center text-stone-400 text-xs py-10 italic">
                                        Preencha o formulário e clique em "Adicionar à Lista" para montar a programação do dia/semana.
                                    </div>
                                ) : (
                                    activityQueue.map((item, idx) => (
                                        <div key={item.tempId} className="bg-white p-3 rounded-xl border border-stone-100 shadow-sm text-sm relative group animate-in slide-in-from-left-2">
                                            <button onClick={() => handleRemoveFromQueue(item.tempId)} className="absolute top-2 right-2 text-stone-300 hover:text-red-500 transition-colors"><X className="w-4 h-4" /></button>
                                            
                                            <div className="font-bold text-stone-800 text-emerald-700">{item.talhao_nome}</div>
                                            <div className="font-medium text-stone-700">{item.tipo === 'outro' ? item.tipo_personalizado : getTipoLabel(item.tipo)}</div>
                                            <div className="text-xs text-stone-500 mt-1 flex items-center gap-1">
                                                <CalendarIcon className="w-3 h-3"/> {format(parseISO(item.data_programada), 'dd/MM/yyyy')}
                                            </div>
                                            {item.terceirizada && <div className="text-[10px] text-blue-600 font-bold mt-1">Terceirizado: R$ {parseFloat(item.valor_terceirizado || 0).toLocaleString('pt-BR')}</div>}
                                            {item.insumos_utilizados.length > 0 && (
                                                <div className="mt-2 pt-2 border-t border-stone-50 flex gap-1 flex-wrap">
                                                    {item.insumos_utilizados.map((i, k) => (
                                                        <span key={k} className="text-[10px] bg-stone-100 px-1 rounded text-stone-500">
                                                            {i.nome} - <span className="capitalize">{i.metodo_aplicacao}</span>
                                                        </span>
                                                    ))}
                                                </div>
                                            )}
                                        </div>
                                    ))
                                )}
                            </div>
                            
                            <div className="mt-4 pt-4 border-t border-stone-200">
                                <Button onClick={handleSaveAll} disabled={activityQueue.length === 0 || createBatchMutation.isPending} className="w-full rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold h-11 shadow-lg shadow-emerald-100">
                                    {createBatchMutation.isPending ? 'Salvando...' : `Confirmar (${activityQueue.length})`}
                                </Button>
                            </div>
                        </>
                    )}
                </div>
            </div>

            {/* FOOTER APENAS PARA EDIÇÃO INDIVIDUAL */}
            {editingAtividade && (
                <DialogFooter className="mt-4 border-t pt-4">
                    <Button type="button" variant="outline" onClick={resetForm} className="rounded-xl border-stone-200">Cancelar</Button>
                    <Button onClick={handleSubmitForm} className="bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl px-6">
                        Salvar Alterações
                    </Button>
                </DialogFooter>
            )}
          </DialogContent>
        </Dialog>

        {/* Dialog de Tipos Customizados */}
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

      {/* Painel de Filtros Padronizado */}
      <Card className="border-stone-100 rounded-[2rem] shadow-sm">
        <CardContent className="pt-6 pb-6">
          <div className="flex flex-wrap items-center gap-4">
            <div className="flex items-center gap-2 text-stone-500">
              <Filter className="w-4 h-4" />
              <span className="text-sm font-bold uppercase tracking-wide">Filtros:</span>
            </div>
            <Select value={filtroTalhao || "todos"} onValueChange={setFiltroTalhao}>
              <SelectTrigger className="w-48 rounded-xl bg-stone-50 border-stone-200"><SelectValue placeholder="Válvula" /></SelectTrigger> {/* ALTERADO */}
              <SelectContent>{talhoes.map((t) => (<SelectItem key={t.id} value={t.id}>{t.nome}</SelectItem>))}<SelectItem value="todos">Todos</SelectItem></SelectContent>
            </Select>
            <Select value={filtroStatus || "todos"} onValueChange={setFiltroStatus}>
              <SelectTrigger className="w-40 rounded-xl bg-stone-50 border-stone-200"><SelectValue placeholder="Status" /></SelectTrigger>
              <SelectContent><SelectItem value="todos">Todos</SelectItem><SelectItem value="programada">Programada</SelectItem><SelectItem value="concluida">Concluída</SelectItem></SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Tabela Padronizada */}
      {atividadesFiltradas.length === 0 ? (
        <EmptyState icon={ClipboardList} title="Nenhuma atividade encontrada" description="Ajuste os filtros ou cadastre uma nova." actionLabel="Nova Atividade" onAction={() => setOpen(true)} />
      ) : (
        <Card className="border-stone-100 rounded-[2rem] shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader className="bg-stone-50">
                <TableRow>
                  <TableHead className="pl-6 w-[120px]">Data</TableHead>
                  <TableHead>Atividade</TableHead>
                  <TableHead>Válvula</TableHead> {/* ALTERADO AQUI */}
                  <TableHead className="text-right">Custo Total</TableHead>
                  <TableHead className="text-center w-[120px]">Status</TableHead>
                  <TableHead className="w-[180px] text-right pr-6">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {atividadesFiltradas.map((atividade) => (
                  <TableRow key={atividade.id} className="hover:bg-stone-50 transition-colors">
                    <TableCell className="pl-6 font-medium text-stone-600">
                        {atividade.data_programada ? format(new Date(atividade.data_programada + 'T12:00:00'), 'dd/MM/yy') : '-'}
                    </TableCell>
                    <TableCell>
                        <div className="font-bold text-stone-800">{atividade.tipo === 'outro' ? atividade.tipo_personalizado : getTipoLabel(atividade.tipo)}</div>
                        <div className="text-xs text-stone-400">{atividade.responsavel && `Resp: ${atividade.responsavel}`}</div>
                        {atividade.terceirizada && <Badge variant="outline" className="text-[10px] border-blue-200 text-blue-600 mt-1">Terceirizado</Badge>}
                    </TableCell>
                    <TableCell><Badge variant="outline" className="bg-white border-stone-200 text-stone-600">{getTalhaoNome(atividade.talhao_id)}</Badge></TableCell>
                    <TableCell className="text-right font-medium text-stone-700">R$ {(atividade.custo_total || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</TableCell>
                    <TableCell className="text-center">
                      <Badge className={`${statusLabels[atividade.status]?.color} border`}>{statusLabels[atividade.status]?.label}</Badge>
                    </TableCell>
                    <TableCell className="text-right pr-6">
                      <div className="flex justify-end gap-1">
                        {atividade.status !== 'concluida' && (
                            <Button variant="ghost" size="icon" className="h-8 w-8 text-emerald-500 hover:text-emerald-700 hover:bg-emerald-50 rounded-lg" onClick={() => updateMutation.mutate({ id: atividade.id, data: { ...atividade, status: 'concluida', data_realizada: format(new Date(), 'yyyy-MM-dd') } })} title="Concluir">
                                <CheckCircle2 className="w-4 h-4" />
                            </Button>
                        )}
                        {/* Botão Ver Texto (Resumo Individual) */}
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