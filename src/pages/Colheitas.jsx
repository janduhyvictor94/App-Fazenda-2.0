import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabaseClient';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogDescription } from '@/components/ui/dialog';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Plus, Edit, Trash2, Wheat, Filter, Package, TrendingUp, Calendar, FileText, ListPlus, ClipboardList, X } from 'lucide-react';
import EmptyState from '@/components/ui/EmptyState';
import StatCard from '@/components/ui/StatCard';
import { format } from 'date-fns';

const tiposColheitaManga = [
  { value: 'exportacao', label: 'Exportação' },
  { value: 'mercado_interno', label: 'Mercado Interno' },
  { value: 'caixas', label: 'Caixas' },
  { value: 'arrastao', label: 'Arrastão' },
  { value: 'polpa', label: 'Polpa' }
];

const tiposColheitaGoiaba = [
  { value: 'caixa_verde', label: 'Caixa Verde' },
  { value: 'madura', label: 'Madura' },
  { value: 'polpa', label: 'Polpa' }
];

export default function Colheitas() {
  const [open, setOpen] = useState(false);
  const [editingColheita, setEditingColheita] = useState(null);
  const [colheitaQueue, setColheitaQueue] = useState([]);
  const [lotesCusto, setLotesCusto] = useState([]);
  const [modoRapido, setModoRapido] = useState(false);
  const [linhasRapidas, setLinhasRapidas] = useState([{ tipo_colheita: '', quantidade_kg: '', quantidade_caixas: '', preco_unitario: '', unidade_preco: 'kg' }]);
  const [custoRapido, setCustoRapido] = useState({ valor: '', unidade: 'kg' });
  
  // Filtros
  const [filtroTalhao, setFiltroTalhao] = useState('todos');
  const [filtroCultura, setFiltroCultura] = useState('todos');
  const [dataInicio, setDataInicio] = useState('');
  const [dataFim, setDataFim] = useState('');
  
  // Dialogs e Dados
  const [openTipoDialog, setOpenTipoDialog] = useState(false);
  const [novoTipoColheita, setNovoTipoColheita] = useState({ nome: '', cultura: '' });
  const [formData, setFormData] = useState({
    talhao_id: '',
    data: format(new Date(), 'yyyy-MM-dd'),
    cultura: '',
    tipo_colheita: '',
    quantidade_kg: '',
    quantidade_caixas: '',
    preco_unitario: '',
    unidade_preco: 'kg',
    custo_colheita: '',
    unidade_custo: 'kg',
    observacoes: ''
  });

  const queryClient = useQueryClient();

  // --- QUERIES ---
  const { data: talhoes = [] } = useQuery({
    queryKey: ['talhoes'],
    queryFn: async () => {
      const { data, error } = await supabase.from('talhoes').select('*');
      if (error) throw error; return data;
    }
  });

  const { data: colheitas = [] } = useQuery({
    queryKey: ['colheitas'],
    queryFn: async () => {
      const { data, error } = await supabase.from('colheitas').select('*').order('data', { ascending: false });
      if (error) throw error; return data;
    }
  });

  const { data: tiposCustomizados = [] } = useQuery({
    queryKey: ['tipos-colheita'],
    queryFn: async () => {
      const { data, error } = await supabase.from('tipos_colheita').select('*');
      if (error) throw error; return data;
    }
  });

  // --- MUTATIONS ---
  const createBatchMutation = useMutation({
    mutationFn: async ({ itens, lotes }) => {
      const payloadColheitas = itens.map(({ tempId, custoTotalCalc, loteId, ...rest }) => rest);
      const { error } = await supabase.from('colheitas').insert(payloadColheitas);
      if (error) throw error;

      // Custos de itens avulsos (modo padrão, um por registro)
      const custosIndividuais = itens
        .filter(item => !item.loteId && item.custoTotalCalc > 0)
        .map(item => ({
          descricao: `Colheita - ${tipoColheitaLabel(item.tipo_colheita)} - ${getTalhaoNome(item.talhao_id)}`,
          categoria: 'colheita',
          talhao_id: item.talhao_id,
          valor: item.custoTotalCalc,
          data: item.data,
          observacoes: `Custo de colheita: R$ ${item.custo_colheita}/${item.unidade_custo}`
        }));

      // Custos de lote (modo rápido: vários tipos no mesmo dia, um único custo combinado)
      const custosDeLotes = (lotes || []).filter(l => l.valor > 0).map(lote => ({
        descricao: `Colheita - ${lote.resumoTipos} - ${getTalhaoNome(lote.talhao_id)}`,
        categoria: 'colheita',
        talhao_id: lote.talhao_id,
        valor: lote.valor,
        data: lote.data,
        observacoes: `Custo de colheita (lote, vários tipos): R$ ${lote.custoUnit}/${lote.unidade}`
      }));

      const custosParaInserir = [...custosIndividuais, ...custosDeLotes];
      if (custosParaInserir.length > 0) {
        const { error: errCustos } = await supabase.from('custos').insert(custosParaInserir);
        if (errCustos) throw errCustos;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['colheitas'] });
      queryClient.invalidateQueries({ queryKey: ['custos'] });
      setColheitaQueue([]);
      setLotesCusto([]);
      resetForm();
    },
    onError: (error) => { alert(`Não foi possível salvar as colheitas.\n\nMotivo: ${error.message || 'Erro desconhecido'}`); console.error('Erro ao salvar lote de colheitas:', error); }
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }) => {
      const { data: result, error } = await supabase.from('colheitas').update(data).eq('id', id).select();
      if (error) throw error; return result;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['colheitas'] });
      resetForm();
    },
    onError: (error) => { alert(`Não foi possível salvar as alterações.\n\nMotivo: ${error.message || 'Erro desconhecido'}`); console.error('Erro ao atualizar colheita:', error); }
  });

  const deleteMutation = useMutation({
    mutationFn: async (id) => {
      const { error } = await supabase.from('colheitas').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['colheitas'] });
    },
    onError: (error) => { alert(`Não foi possível excluir a colheita.\n\nMotivo: ${error.message || 'Erro desconhecido'}`); console.error('Erro ao excluir colheita:', error); }
  });

  const createTipoMutation = useMutation({
    mutationFn: async (data) => {
      const { data: result, error } = await supabase.from('tipos_colheita').insert(data).select();
      if (error) throw error; return result;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tipos-colheita'] });
      setNovoTipoColheita({ nome: '', cultura: '' });
      setOpenTipoDialog(false);
    },
    onError: (error) => { alert(`Não foi possível criar o tipo de colheita.\n\nMotivo: ${error.message || 'Erro desconhecido'}`); console.error('Erro ao criar tipo de colheita:', error); }
  });

  // --- LÓGICA ---
  const resetForm = () => {
    setFormData({
      talhao_id: '', data: format(new Date(), 'yyyy-MM-dd'), cultura: '', tipo_colheita: '',
      quantidade_kg: '', quantidade_caixas: '', preco_unitario: '', unidade_preco: 'kg',
      custo_colheita: '', unidade_custo: 'kg', observacoes: ''
    });
    setEditingColheita(null);
    setColheitaQueue([]);
    setLotesCusto([]);
    setModoRapido(false);
    setLinhasRapidas([{ tipo_colheita: '', quantidade_kg: '', quantidade_caixas: '', preco_unitario: '', unidade_preco: 'kg' }]);
    setCustoRapido({ valor: '', unidade: 'kg' });
    setOpen(false);
  };

  const handleEdit = (colheita) => {
    setEditingColheita(colheita);
    setFormData({
      talhao_id: colheita.talhao_id || '',
      data: colheita.data || '',
      cultura: colheita.cultura || '',
      tipo_colheita: colheita.tipo_colheita || '',
      quantidade_kg: colheita.quantidade_kg || '',
      quantidade_caixas: colheita.quantidade_caixas || '',
      preco_unitario: colheita.preco_unitario || '',
      unidade_preco: colheita.unidade_preco || 'kg',
      custo_colheita: colheita.custo_colheita || '',
      unidade_custo: colheita.unidade_custo || 'kg',
      observacoes: colheita.observacoes || ''
    });
    setOpen(true);
  };

  const calcularValorTotal = () => {
    const qtd = formData.unidade_preco === 'kg' ? parseFloat(formData.quantidade_kg) || 0 : parseFloat(formData.quantidade_caixas) || 0;
    const preco = parseFloat(formData.preco_unitario) || 0;
    return qtd * preco;
  };

  const calcularCustoTotal = () => {
    const qtd = formData.unidade_custo === 'kg' ? parseFloat(formData.quantidade_kg) || 0 : parseFloat(formData.quantidade_caixas) || 0;
    const custo = parseFloat(formData.custo_colheita) || 0;
    return qtd * custo;
  };


  const handleAddToQueue = () => {
    if (!formData.talhao_id || !formData.data || !formData.cultura || !formData.tipo_colheita) {
      return alert("Preencha Talhão, Data, Cultura e Tipo para adicionar.");
    }
    const valorTotal = calcularValorTotal();
    const custoTotal = calcularCustoTotal();
    const item = {
      ...formData,
      quantidade_kg: formData.quantidade_kg ? parseFloat(formData.quantidade_kg) : null,
      quantidade_caixas: formData.quantidade_caixas ? parseFloat(formData.quantidade_caixas) : null,
      preco_unitario: formData.preco_unitario ? parseFloat(formData.preco_unitario) : null,
      custo_colheita: formData.custo_colheita ? parseFloat(formData.custo_colheita) : null,
      valor_total: valorTotal,
      custoTotalCalc: custoTotal,
      tempId: Date.now()
    };
    setColheitaQueue([...colheitaQueue, item]);
    // Mantém Talhão, Data e Cultura (comum registrar várias colheitas da mesma área/dia em seguida), limpa o resto
    setFormData(prev => ({
      ...prev,
      quantidade_kg: '', quantidade_caixas: '', preco_unitario: '',
      custo_colheita: '', observacoes: ''
    }));
  };

  const handleRemoveFromQueue = (tempId) => {
    const item = colheitaQueue.find(i => i.tempId === tempId);
    const novaFila = colheitaQueue.filter(i => i.tempId !== tempId);
    setColheitaQueue(novaFila);
    // Se era o último item de um lote, remove também o custo combinado daquele lote (não faz mais sentido sozinho)
    if (item?.loteId && !novaFila.some(i => i.loteId === item.loteId)) {
      setLotesCusto(lotesCusto.filter(l => l.loteId !== item.loteId));
    }
  };
  const handleSaveAll = () => { if (colheitaQueue.length > 0) createBatchMutation.mutate({ itens: colheitaQueue, lotes: lotesCusto }); };

  // --- Modo Rápido: vários tipos (caixa verde, madura, polpa...) no mesmo dia, com um custo único combinado ---
  const addLinhaRapida = () => setLinhasRapidas([...linhasRapidas, { tipo_colheita: '', quantidade_kg: '', quantidade_caixas: '', preco_unitario: '', unidade_preco: 'kg' }]);
  const removeLinhaRapida = (index) => setLinhasRapidas(linhasRapidas.filter((_, i) => i !== index));
  const updateLinhaRapida = (index, campo, valor) => setLinhasRapidas(linhasRapidas.map((linha, i) => i === index ? { ...linha, [campo]: valor } : linha));

  const handleAddLoteToQueue = () => {
    if (!formData.talhao_id || !formData.data || !formData.cultura) {
      return alert("Preencha Talhão, Data e Cultura para adicionar.");
    }
    const linhasValidas = linhasRapidas.filter(l => l.tipo_colheita && (parseFloat(l.quantidade_kg) > 0 || parseFloat(l.quantidade_caixas) > 0));
    if (linhasValidas.length === 0) {
      return alert("Preencha ao menos um tipo com quantidade colhida.");
    }

    const loteId = Date.now();
    const novosItens = linhasValidas.map((linha, idx) => {
      const qtd = linha.unidade_preco === 'kg' ? parseFloat(linha.quantidade_kg) || 0 : parseFloat(linha.quantidade_caixas) || 0;
      const preco = parseFloat(linha.preco_unitario) || 0;
      return {
        talhao_id: formData.talhao_id,
        data: formData.data,
        cultura: formData.cultura,
        tipo_colheita: linha.tipo_colheita,
        quantidade_kg: linha.quantidade_kg ? parseFloat(linha.quantidade_kg) : null,
        quantidade_caixas: linha.quantidade_caixas ? parseFloat(linha.quantidade_caixas) : null,
        preco_unitario: preco || null,
        unidade_preco: linha.unidade_preco,
        custo_colheita: null,
        unidade_custo: custoRapido.unidade,
        observacoes: formData.observacoes || '',
        valor_total: qtd * preco,
        loteId,
        tempId: Date.now() + idx
      };
    });

    // Custo único do lote: preço por caixa/kg (igual pra todos os tipos) × soma das quantidades de todos os tipos
    const custoUnitValor = parseFloat(custoRapido.valor) || 0;
    let custoLoteTotal = 0;
    if (custoUnitValor > 0) {
      const somaQtd = linhasValidas.reduce((acc, l) => acc + (custoRapido.unidade === 'kg' ? (parseFloat(l.quantidade_kg) || 0) : (parseFloat(l.quantidade_caixas) || 0)), 0);
      custoLoteTotal = somaQtd * custoUnitValor;
    }

    setColheitaQueue([...colheitaQueue, ...novosItens]);
    if (custoLoteTotal > 0) {
      const resumoTipos = linhasValidas.map(l => tipoColheitaLabel(l.tipo_colheita)).join(' + ');
      setLotesCusto([...lotesCusto, { loteId, talhao_id: formData.talhao_id, data: formData.data, valor: custoLoteTotal, custoUnit: custoUnitValor, unidade: custoRapido.unidade, resumoTipos }]);
    }

    // Mantém Talhão, Data e Cultura, limpa as linhas de tipo e o custo
    setLinhasRapidas([{ tipo_colheita: '', quantidade_kg: '', quantidade_caixas: '', preco_unitario: '', unidade_preco: 'kg' }]);
    setCustoRapido({ valor: '', unidade: 'kg' });
    setFormData(prev => ({ ...prev, observacoes: '' }));
  };

  const tiposColheitaPadrao = formData.cultura === 'manga' ? tiposColheitaManga : formData.cultura === 'goiaba' ? tiposColheitaGoiaba : [];
  const tiposCustomizadosFiltrados = tiposCustomizados.filter(t => t.cultura === formData.cultura);
  const tiposColheita = [ ...tiposColheitaPadrao, ...tiposCustomizadosFiltrados.map(t => ({ value: t.nome, label: t.nome })) ];

  const colheitasFiltradas = colheitas.filter(c => {
    if (filtroTalhao !== 'todos' && c.talhao_id !== filtroTalhao) return false;
    if (filtroCultura !== 'todos' && c.cultura !== filtroCultura) return false;
    if (dataInicio && c.data) {
      const dataColheita = new Date(c.data);
      const dataInicioDate = new Date(dataInicio);
      if (dataColheita < dataInicioDate) return false;
    }
    if (dataFim && c.data) {
      const dataColheita = new Date(c.data);
      const dataFimDate = new Date(dataFim);
      if (dataColheita > dataFimDate) return false;
    }
    return true;
  });

  const totalKg = colheitasFiltradas.reduce((acc, c) => acc + (c.quantidade_kg || 0), 0);
  const totalCaixas = colheitasFiltradas.reduce((acc, c) => acc + (c.quantidade_caixas || 0), 0);
  const totalReceita = colheitasFiltradas.reduce((acc, c) => acc + (c.valor_total || 0), 0);
  const totalCustoColheita = colheitasFiltradas.reduce((acc, c) => {
    if (!c.custo_colheita) return acc;
    const qtdBase = c.unidade_custo === 'kg' ? (c.quantidade_kg || 0) : (c.quantidade_caixas || 0);
    return acc + (qtdBase * c.custo_colheita);
  }, 0);

  const getTalhaoNome = (id) => talhoes.find(t => t.id === id)?.nome || '-';

  const tipoColheitaLabel = (tipo) => {
    const allTipos = [...tiposColheitaManga, ...tiposColheitaGoiaba];
    const padrao = allTipos.find(t => t.value === tipo);
    if (padrao) return padrao.label;
    const customizado = tiposCustomizados.find(t => t.nome === tipo);
    return customizado ? customizado.nome : tipo;
  };

  return (
    <div className="space-y-6">
      {/* Header Padronizado */}
      <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-4 bg-white p-4 rounded-[1.5rem] border border-stone-100 shadow-sm">
        <div>
          <h1 className="text-2xl font-bold text-stone-900 tracking-tight">Colheitas</h1>
          <p className="text-stone-500 font-medium">Registro e histórico de produção</p>
        </div>
        
        <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
                <Button className="bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl h-10 px-5 shadow-lg shadow-emerald-100 transition-all active:scale-95 ml-2">
                <Plus className="w-4 h-4 mr-2" /> Registrar Colheita
                </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-5xl max-h-[90vh] overflow-y-auto rounded-[2rem]">
                <DialogHeader>
                <DialogTitle>{editingColheita ? 'Editar Colheita' : 'Registrar Colheitas'}</DialogTitle>
                <DialogDescription>{editingColheita ? 'Dados de produção colhida.' : 'Adicione várias colheitas à lista e salve tudo de uma vez.'}</DialogDescription>
                </DialogHeader>
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 pt-2">
                <div className="lg:col-span-2 space-y-4 border-r border-stone-100 pr-0 lg:pr-6">
                <form onSubmit={(e) => e.preventDefault()} className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <Label>Talhão</Label>
                            <Select value={formData.talhao_id || ""} onValueChange={(value) => setFormData({ ...formData, talhao_id: value })}>
                                <SelectTrigger className="rounded-xl"><SelectValue placeholder="Selecione" /></SelectTrigger>
                                <SelectContent>
                                    {talhoes.map((talhao) => (<SelectItem key={talhao.id} value={talhao.id}>{talhao.nome}</SelectItem>))}
                                </SelectContent>
                            </Select>
                        </div>
                        <div className="space-y-2">
                            <Label>Data</Label>
                            <Input type="date" value={formData.data || ""} onChange={(e) => setFormData({ ...formData, data: e.target.value })} required className="rounded-xl" />
                        </div>
                    </div>

                    {!editingColheita && (
                        <div className="flex items-center gap-1 bg-stone-50 p-1 rounded-xl border border-stone-200 w-fit">
                            <button type="button" onClick={() => setModoRapido(false)} className={`px-3 h-8 rounded-lg text-sm font-bold transition-all ${!modoRapido ? 'bg-white text-stone-900 shadow-sm' : 'text-stone-500 hover:text-stone-700'}`}>Padrão</button>
                            <button type="button" onClick={() => setModoRapido(true)} className={`px-3 h-8 rounded-lg text-sm font-bold transition-all ${modoRapido ? 'bg-white text-stone-900 shadow-sm' : 'text-stone-500 hover:text-stone-700'}`}>Rápido (Vários Tipos)</button>
                        </div>
                    )}
                    {modoRapido && !editingColheita && (
                        <p className="text-xs text-stone-500 -mt-1">Pra dias com mais de um tipo de colheita (ex: caixa verde + madura + polpa) no mesmo talhão. O custo de colheita é o mesmo por caixa/kg pra todos, então você informa uma vez só e ele soma tudo.</p>
                    )}

                    {(!modoRapido || editingColheita) && (
                    <>
                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <Label>Cultura</Label>
                            <Select value={formData.cultura || ""} onValueChange={(value) => setFormData({ ...formData, cultura: value, tipo_colheita: '' })}>
                                <SelectTrigger className="rounded-xl"><SelectValue placeholder="Selecione" /></SelectTrigger>
                                <SelectContent><SelectItem value="manga">Manga</SelectItem><SelectItem value="goiaba">Goiaba</SelectItem></SelectContent>
                            </Select>
                        </div>
                        <div className="space-y-2">
                            <div className="flex items-center justify-between">
                                <Label>Tipo</Label>
                                <Button type="button" variant="ghost" size="sm" onClick={() => setOpenTipoDialog(true)} className="h-6 text-xs px-2 text-blue-600 hover:text-blue-700 hover:bg-blue-50 rounded-lg" disabled={!formData.cultura}>
                                    <Plus className="w-3 h-3 mr-1" /> Novo
                                </Button>
                            </div>
                            <Select value={formData.tipo_colheita || ""} onValueChange={(value) => setFormData({ ...formData, tipo_colheita: value })} disabled={!formData.cultura}>
                                <SelectTrigger className="rounded-xl"><SelectValue placeholder="Selecione" /></SelectTrigger>
                                <SelectContent>{tiposColheita.map((tipo) => (<SelectItem key={tipo.value} value={tipo.value}>{tipo.label}</SelectItem>))}</SelectContent>
                            </Select>
                        </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <Label>Qtd (kg)</Label>
                            <Input type="number" step="0.01" value={formData.quantidade_kg || ""} onChange={(e) => setFormData({ ...formData, quantidade_kg: e.target.value })} placeholder="Ex: 1500" className="rounded-xl" />
                        </div>
                        <div className="space-y-2">
                            <Label>Qtd (caixas)</Label>
                            <Input type="number" value={formData.quantidade_caixas || ""} onChange={(e) => setFormData({ ...formData, quantidade_caixas: e.target.value })} placeholder="Ex: 100" className="rounded-xl" />
                        </div>
                    </div>

                    <div className="p-4 bg-stone-50 rounded-xl space-y-3 border border-stone-100">
                        <Label className="text-stone-700 font-medium">Dados Financeiros</Label>
                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label className="text-xs text-stone-500">Preço Unit.</Label>
                                <Input type="number" step="0.01" value={formData.preco_unitario || ""} onChange={(e) => setFormData({ ...formData, preco_unitario: e.target.value })} placeholder="R$" className="rounded-xl bg-white" />
                            </div>
                            <div className="space-y-2">
                                <Label className="text-xs text-stone-500">Unidade</Label>
                                <Select value={formData.unidade_preco || ""} onValueChange={(value) => setFormData({ ...formData, unidade_preco: value })}>
                                    <SelectTrigger className="rounded-xl bg-white"><SelectValue /></SelectTrigger>
                                    <SelectContent><SelectItem value="kg">Por kg</SelectItem><SelectItem value="caixa">Por caixa</SelectItem></SelectContent>
                                </Select>
                            </div>
                        </div>
                        <div className="flex items-center justify-between pt-1">
                            <span className="text-sm font-medium text-stone-600">Receita Total:</span>
                            <span className="text-lg font-bold text-emerald-600">R$ {calcularValorTotal().toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
                        </div>
                    </div>

                    <div className="p-4 bg-red-50/50 rounded-xl space-y-3 border border-red-100">
                        <Label className="text-red-800 font-medium">Custo da Colheita (Terceirizado)</Label>
                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label className="text-xs text-red-700">Custo Unit.</Label>
                                <Input type="number" step="0.01" value={formData.custo_colheita || ""} onChange={(e) => setFormData({ ...formData, custo_colheita: e.target.value })} placeholder="R$" className="rounded-xl bg-white border-red-200" />
                            </div>
                            <div className="space-y-2">
                                <Label className="text-xs text-red-700">Unidade</Label>
                                <Select value={formData.unidade_custo || ""} onValueChange={(value) => setFormData({ ...formData, unidade_custo: value })}>
                                    <SelectTrigger className="rounded-xl bg-white border-red-200"><SelectValue /></SelectTrigger>
                                    <SelectContent><SelectItem value="kg">Por kg</SelectItem><SelectItem value="caixa">Por caixa</SelectItem></SelectContent>
                                </Select>
                            </div>
                        </div>
                        <div className="flex items-center justify-between pt-1">
                            <span className="text-sm font-medium text-red-800">Custo Total:</span>
                            <span className="text-lg font-bold text-red-600">R$ {calcularCustoTotal().toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
                        </div>
                    </div>
                    </>
                    )}

                    {modoRapido && !editingColheita && (
                    <>
                    <div className="space-y-2">
                        <Label>Cultura</Label>
                        <Select value={formData.cultura || ""} onValueChange={(value) => setFormData({ ...formData, cultura: value })}>
                            <SelectTrigger className="rounded-xl"><SelectValue placeholder="Selecione" /></SelectTrigger>
                            <SelectContent><SelectItem value="manga">Manga</SelectItem><SelectItem value="goiaba">Goiaba</SelectItem></SelectContent>
                        </Select>
                    </div>

                    <div className="space-y-3">
                        <div className="flex items-center justify-between">
                            <Label className="text-stone-700 font-medium">Tipos Colhidos Nesse Dia</Label>
                            <Button type="button" variant="outline" size="sm" onClick={addLinhaRapida} disabled={!formData.cultura} className="h-7 text-xs rounded-lg border-blue-200 text-blue-600 hover:bg-blue-50"><Plus className="w-3 h-3 mr-1" /> Adicionar Tipo</Button>
                        </div>
                        {linhasRapidas.map((linha, index) => (
                            <div key={index} className="p-3 bg-stone-50 rounded-xl border border-stone-100 flex flex-col md:flex-row gap-2 md:items-center">
                                <Select value={linha.tipo_colheita || ""} onValueChange={(value) => updateLinhaRapida(index, 'tipo_colheita', value)} disabled={!formData.cultura}>
                                    <SelectTrigger className="w-full md:flex-1 rounded-lg bg-white h-9 text-xs"><SelectValue placeholder="Tipo" /></SelectTrigger>
                                    <SelectContent>{tiposColheita.map((tipo) => (<SelectItem key={tipo.value} value={tipo.value}>{tipo.label}</SelectItem>))}</SelectContent>
                                </Select>
                                <Input type="number" step="0.01" placeholder="Qtd (kg)" className="w-full md:w-24 rounded-lg bg-white h-9 text-xs" value={linha.quantidade_kg} onChange={(e) => updateLinhaRapida(index, 'quantidade_kg', e.target.value)} />
                                <Input type="number" placeholder="Qtd (cx)" className="w-full md:w-24 rounded-lg bg-white h-9 text-xs" value={linha.quantidade_caixas} onChange={(e) => updateLinhaRapida(index, 'quantidade_caixas', e.target.value)} />
                                <Input type="number" step="0.01" placeholder="Preço venda" className="w-full md:w-24 rounded-lg bg-white h-9 text-xs" value={linha.preco_unitario} onChange={(e) => updateLinhaRapida(index, 'preco_unitario', e.target.value)} />
                                <Select value={linha.unidade_preco} onValueChange={(value) => updateLinhaRapida(index, 'unidade_preco', value)}>
                                    <SelectTrigger className="w-full md:w-28 rounded-lg bg-white h-9 text-xs"><SelectValue /></SelectTrigger>
                                    <SelectContent><SelectItem value="kg">R$/kg</SelectItem><SelectItem value="caixa">R$/caixa</SelectItem></SelectContent>
                                </Select>
                                {linhasRapidas.length > 1 && (
                                    <Button type="button" variant="ghost" size="icon" onClick={() => removeLinhaRapida(index)} className="h-9 w-9 shrink-0 text-stone-300 hover:text-red-500"><Trash2 className="w-4 h-4" /></Button>
                                )}
                            </div>
                        ))}
                    </div>

                    <div className="p-4 bg-red-50/50 rounded-xl space-y-3 border border-red-100">
                        <Label className="text-red-800 font-medium">Custo de Colheita do Dia (Terceirizado)</Label>
                        <p className="text-[11px] text-stone-500 -mt-1">Um valor só, aplicado sobre a soma de {custoRapido.unidade === 'kg' ? 'kg' : 'caixas'} de todos os tipos acima.</p>
                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label className="text-xs text-red-700">Custo Unit.</Label>
                                <Input type="number" step="0.01" value={custoRapido.valor} onChange={(e) => setCustoRapido({ ...custoRapido, valor: e.target.value })} placeholder="R$" className="rounded-xl bg-white border-red-200" />
                            </div>
                            <div className="space-y-2">
                                <Label className="text-xs text-red-700">Unidade</Label>
                                <Select value={custoRapido.unidade} onValueChange={(value) => setCustoRapido({ ...custoRapido, unidade: value })}>
                                    <SelectTrigger className="rounded-xl bg-white border-red-200"><SelectValue /></SelectTrigger>
                                    <SelectContent><SelectItem value="kg">Por kg</SelectItem><SelectItem value="caixa">Por caixa</SelectItem></SelectContent>
                                </Select>
                            </div>
                        </div>
                    </div>
                    </>
                    )}

                    <div className="space-y-2">
                        <Label>Observações</Label>
                        <Textarea value={formData.observacoes || ""} onChange={(e) => setFormData({ ...formData, observacoes: e.target.value })} placeholder="Detalhes..." rows={2} className="rounded-xl" />
                    </div>

                    {editingColheita ? (
                        <div className="flex justify-end gap-3 pt-2">
                            <Button type="button" variant="outline" onClick={resetForm} className="rounded-xl border-stone-200">Cancelar</Button>
                            <Button type="button" onClick={async () => { await updateMutation.mutateAsync({ id: editingColheita.id, data: { ...formData, quantidade_kg: formData.quantidade_kg ? parseFloat(formData.quantidade_kg) : null, quantidade_caixas: formData.quantidade_caixas ? parseFloat(formData.quantidade_caixas) : null, preco_unitario: formData.preco_unitario ? parseFloat(formData.preco_unitario) : null, custo_colheita: formData.custo_colheita ? parseFloat(formData.custo_colheita) : null, valor_total: calcularValorTotal() } }); }} className="bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl px-6" disabled={updateMutation.isPending}>
                                Salvar Alterações
                            </Button>
                        </div>
                    ) : modoRapido ? (
                        <Button type="button" onClick={handleAddLoteToQueue} className="w-full rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold h-12">
                            <ListPlus className="w-5 h-5 mr-2" /> Adicionar Todos os Tipos à Lista
                        </Button>
                    ) : (
                        <Button type="button" onClick={handleAddToQueue} className="w-full rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold h-12">
                            <ListPlus className="w-5 h-5 mr-2" /> Adicionar à Lista
                        </Button>
                    )}
                </form>
                </div>

                <div className="lg:col-span-1 bg-stone-50 rounded-2xl border border-stone-200 p-4 flex flex-col h-full min-h-[300px]">
                    <h4 className="text-sm font-bold text-stone-700 mb-3 flex items-center gap-2"><ClipboardList className="w-4 h-4" /> Lista de Colheitas ({colheitaQueue.length})</h4>
                    {editingColheita ? (
                        <div className="flex-1 flex items-center justify-center text-center text-stone-500 text-xs italic">Modo de edição individual.<br/>A lista está desabilitada.</div>
                    ) : (
                        <>
                            <div className="flex-1 overflow-y-auto space-y-2 max-h-[500px] pr-1 scrollbar-thin">
                                {colheitaQueue.length === 0 ? (
                                    <div className="text-center text-stone-500 text-xs py-10 italic">Preencha o formulário e clique em "Adicionar à Lista".</div>
                                ) : (
                                    colheitaQueue.map((item) => (
                                        <div key={item.tempId} className="bg-white p-3 rounded-xl border border-stone-100 shadow-sm text-sm relative group animate-in slide-in-from-left-2">
                                            <button onClick={() => handleRemoveFromQueue(item.tempId)} className="absolute top-2 right-2 text-stone-300 hover:text-red-500 transition-colors"><X className="w-4 h-4" /></button>
                                            <div className="font-bold text-emerald-700">{getTalhaoNome(item.talhao_id)}</div>
                                            <div className="font-medium text-stone-700">{tipoColheitaLabel(item.tipo_colheita)}</div>
                                            <div className="text-xs text-stone-500 mt-1">{item.data ? format(new Date(item.data + 'T12:00:00'), 'dd/MM/yyyy') : '-'}</div>
                                            <div className="flex gap-2 mt-1">
                                                {item.quantidade_kg > 0 && <span className="text-[11px] bg-stone-100 px-1.5 py-0.5 rounded text-stone-600 font-bold">{item.quantidade_kg} kg</span>}
                                                {item.quantidade_caixas > 0 && <span className="text-[11px] bg-blue-50 px-1.5 py-0.5 rounded text-blue-600 font-bold">{item.quantidade_caixas} cx</span>}
                                                {item.loteId && <span className="text-[11px] bg-purple-50 px-1.5 py-0.5 rounded text-purple-600 font-bold">lote</span>}
                                            </div>
                                            <div className="text-xs font-bold text-emerald-600 mt-1">Receita: R$ {item.valor_total.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</div>
                                            {item.custoTotalCalc > 0 && <div className="text-[11px] text-red-600">Custo: R$ {item.custoTotalCalc.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</div>}
                                        </div>
                                    ))
                                )}
                            </div>
                            {lotesCusto.length > 0 && (
                                <div className="mt-3 pt-3 border-t border-stone-200 space-y-1">
                                    <p className="text-[11px] font-bold text-stone-500 uppercase">Custos de Lote (combinados)</p>
                                    {lotesCusto.map((lote) => (
                                        <div key={lote.loteId} className="text-[11px] text-red-600 flex justify-between">
                                            <span className="truncate pr-2">{lote.resumoTipos} ({getTalhaoNome(lote.talhao_id)})</span>
                                            <span className="font-bold shrink-0">R$ {lote.valor.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
                                        </div>
                                    ))}
                                </div>
                            )}
                            <div className="mt-4 pt-4 border-t border-stone-200">
                                <Button onClick={handleSaveAll} disabled={colheitaQueue.length === 0 || createBatchMutation.isPending} className="w-full rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold h-11 shadow-lg shadow-emerald-100">
                                    {createBatchMutation.isPending ? 'Salvando...' : `Confirmar (${colheitaQueue.length})`}
                                </Button>
                            </div>
                        </>
                    )}
                </div>
                </div>
            </DialogContent>
        </Dialog>

        {/* Dialog Novo Tipo */}
        <Dialog open={openTipoDialog} onOpenChange={setOpenTipoDialog}>
            <DialogContent className="sm:max-w-md rounded-[2rem]">
                <DialogHeader>
                    <DialogTitle>Novo Tipo de Colheita</DialogTitle>
                    <DialogDescription className="sr-only">Cadastrar tipo</DialogDescription>
                </DialogHeader>
                <div className="space-y-4">
                    <div className="space-y-2">
                        <Label>Cultura</Label>
                        <Select value={novoTipoColheita.cultura || ""} onValueChange={(value) => setNovoTipoColheita({ ...novoTipoColheita, cultura: value })}>
                            <SelectTrigger className="rounded-xl"><SelectValue placeholder="Selecione" /></SelectTrigger>
                            <SelectContent><SelectItem value="manga">Manga</SelectItem><SelectItem value="goiaba">Goiaba</SelectItem></SelectContent>
                        </Select>
                    </div>
                    <div className="space-y-2">
                        <Label>Nome do Tipo</Label>
                        <Input value={novoTipoColheita.nome || ""} onChange={(e) => setNovoTipoColheita({ ...novoTipoColheita, nome: e.target.value })} placeholder="Ex: Premium" className="rounded-xl" />
                    </div>
                    <div className="flex justify-end gap-3 pt-2">
                        <Button variant="outline" onClick={() => setOpenTipoDialog(false)} className="rounded-xl">Cancelar</Button>
                        <Button onClick={() => createTipoMutation.mutate(novoTipoColheita)} disabled={!novoTipoColheita.nome || !novoTipoColheita.cultura || createTipoMutation.isPending} className="bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl">Criar</Button>
                    </div>
                </div>
            </DialogContent>
        </Dialog>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
        <StatCard title="Total Colhido (Kg)" value={`${(totalKg / 1000).toFixed(1)} ton`} icon={Wheat} color="text-amber-600" />
        <StatCard title="Total Colhido (Cx)" value={`${totalCaixas.toLocaleString('pt-BR')} cx`} icon={Package} color="text-blue-600" />
        <StatCard title="Receita Total" value={`R$ ${totalReceita.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`} icon={TrendingUp} color="text-emerald-600" />
        <StatCard title="Custo de Colheita" value={`R$ ${totalCustoColheita.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`} icon={Package} color="text-red-600" />
        <StatCard title="Registros" value={colheitasFiltradas.length} icon={FileText} color="text-stone-600" />
      </div>

      {/* Filtros e Tabela */}
      <Card className="border-stone-100 rounded-[2rem] shadow-sm">
        <CardContent className="pt-6 pb-6">
            <div className="flex flex-wrap items-center gap-4">
                <div className="flex items-center gap-2 text-stone-500">
                    <Filter className="w-4 h-4" />
                    <span className="text-sm font-bold uppercase tracking-wide">Filtros:</span>
                </div>
                <Select value={filtroTalhao || "todos"} onValueChange={setFiltroTalhao}>
                    <SelectTrigger className="w-40 rounded-xl bg-stone-50 border-stone-200"><SelectValue placeholder="Talhão" /></SelectTrigger>
                    <SelectContent>{talhoes.map((t) => (<SelectItem key={t.id} value={t.id}>{t.nome}</SelectItem>))}<SelectItem value="todos">Todos Talhões</SelectItem></SelectContent>
                </Select>
                <Select value={filtroCultura || "todos"} onValueChange={setFiltroCultura}>
                    <SelectTrigger className="w-40 rounded-xl bg-stone-50 border-stone-200"><SelectValue placeholder="Cultura" /></SelectTrigger>
                    <SelectContent><SelectItem value="todos">Todas Culturas</SelectItem><SelectItem value="manga">Manga</SelectItem><SelectItem value="goiaba">Goiaba</SelectItem></SelectContent>
                </Select>
                <div className="flex items-center gap-2 bg-stone-50 p-1 px-3 rounded-xl border border-stone-200">
                    <Calendar className="w-4 h-4 text-stone-500" />
                    <Input type="date" value={dataInicio || ""} onChange={(e) => setDataInicio(e.target.value)} min="2020-01-01" max="2040-12-31" className="w-32 border-none bg-transparent h-8 p-0 text-sm" />
                    <span className="text-stone-500">-</span>
                    <Input type="date" value={dataFim || ""} onChange={(e) => setDataFim(e.target.value)} min="2020-01-01" max="2040-12-31" className="w-32 border-none bg-transparent h-8 p-0 text-sm" />
                </div>
            </div>
        </CardContent>
      </Card>

      {colheitasFiltradas.length === 0 ? (
        <EmptyState icon={Wheat} title="Nenhuma colheita registrada" description="Registre suas colheitas para acompanhar a produção." actionLabel="Registrar" onAction={() => setOpen(true)} />
      ) : (
        <Card className="border-stone-100 rounded-[2rem] shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
            <Table>
                <TableHeader className="bg-stone-50">
                <TableRow>
                    <TableHead className="pl-6">Data</TableHead>
                    <TableHead>Talhão</TableHead>
                    <TableHead>Cultura</TableHead>
                    <TableHead>Tipo</TableHead>
                    <TableHead className="text-right">Quantidade</TableHead>
                    <TableHead className="text-right">Venda Total</TableHead>
                    <TableHead className="text-right">Custo Colheita</TableHead>
                    <TableHead className="text-right pr-6 w-[120px]">Ações</TableHead>
                </TableRow>
                </TableHeader>
                <TableBody>
                {colheitasFiltradas.map((colheita) => (
                    <TableRow key={colheita.id} className="hover:bg-stone-50 transition-colors">
                        <TableCell className="pl-6 font-medium text-stone-600">
                            {colheita.data ? format(new Date(colheita.data + 'T12:00:00'), 'dd/MM/yyyy') : '-'}
                        </TableCell>
                        <TableCell className="font-bold text-stone-700">{getTalhaoNome(colheita.talhao_id)}</TableCell>
                        <TableCell>
                            <Badge className={colheita.cultura === 'manga' ? 'bg-orange-100 text-orange-800 border-orange-200 border' : 'bg-pink-100 text-pink-800 border-pink-200 border'}>
                                {colheita.cultura === 'manga' ? '🥭 Manga' : '🍈 Goiaba'}
                            </Badge>
                        </TableCell>
                        <TableCell className="capitalize text-stone-600">{tipoColheitaLabel(colheita.tipo_colheita)}</TableCell>
                        <TableCell className="text-right">
                            <div className="flex flex-col items-end">
                                {colheita.quantidade_kg > 0 && <span className="font-medium text-stone-700">{colheita.quantidade_kg.toLocaleString('pt-BR')} kg</span>}
                                {colheita.quantidade_caixas > 0 && <span className="text-xs font-bold text-blue-600 bg-blue-50 px-2 py-0.5 rounded-md mt-0.5">{colheita.quantidade_caixas.toLocaleString('pt-BR')} cx</span>}
                                {!colheita.quantidade_kg && !colheita.quantidade_caixas && <span className="text-stone-500">-</span>}
                            </div>
                        </TableCell>
                        <TableCell className="text-right">
                            <div className="flex flex-col items-end">
                                <span className="font-bold text-emerald-600">R$ {colheita.valor_total?.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
                                <span className="text-xs text-stone-500 font-medium mt-0.5">R$ {colheita.preco_unitario?.toFixed(2)}/{colheita.unidade_preco}</span>
                            </div>
                        </TableCell>
                        <TableCell className="text-right">
                            {colheita.custo_colheita ? (() => {
                                const qtdBase = colheita.unidade_custo === 'kg' ? (colheita.quantidade_kg || 0) : (colheita.quantidade_caixas || 0);
                                const custoTotalLinha = qtdBase * colheita.custo_colheita;
                                return (
                                    <div className="flex flex-col items-end">
                                        <span className="font-bold text-red-600">R$ {custoTotalLinha.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
                                        <span className="text-xs text-stone-500 font-medium mt-0.5">R$ {colheita.custo_colheita.toFixed(2)}/{colheita.unidade_custo}</span>
                                    </div>
                                );
                            })() : <span className="text-stone-500">-</span>}
                        </TableCell>
                        <TableCell className="text-right pr-6">
                            <div className="flex justify-end gap-1">
                                <Button variant="ghost" size="icon" className="h-8 w-8 text-stone-500 hover:text-stone-700 hover:bg-stone-100 rounded-lg" onClick={() => handleEdit(colheita)}><Edit className="w-4 h-4" /></Button>
                                <Button variant="ghost" size="icon" className="h-8 w-8 text-red-300 hover:text-red-500 hover:bg-red-50 rounded-lg" onClick={() => { if (confirm("Excluir esta colheita? Essa ação não pode ser desfeita.")) deleteMutation.mutate(colheita.id) }}><Trash2 className="w-4 h-4" /></Button>
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
