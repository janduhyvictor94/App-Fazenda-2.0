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
import { Plus, Edit, Trash2, Wheat, Filter, Package, TrendingUp, Calendar, FileText } from 'lucide-react';
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
  const createMutation = useMutation({
    mutationFn: async (data) => {
      const { data: result, error } = await supabase.from('colheitas').insert(data).select();
      if (error) throw error; return result;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['colheitas'] });
      resetForm();
    }
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }) => {
      const { data: result, error } = await supabase.from('colheitas').update(data).eq('id', id).select();
      if (error) throw error; return result;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['colheitas'] });
      resetForm();
    }
  });

  const deleteMutation = useMutation({
    mutationFn: async (id) => {
      const { error } = await supabase.from('colheitas').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['colheitas'] });
    }
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
    }
  });

  // --- LÓGICA ---
  const resetForm = () => {
    setFormData({
      talhao_id: '', data: format(new Date(), 'yyyy-MM-dd'), cultura: '', tipo_colheita: '',
      quantidade_kg: '', quantidade_caixas: '', preco_unitario: '', unidade_preco: 'kg',
      custo_colheita: '', unidade_custo: 'kg', observacoes: ''
    });
    setEditingColheita(null);
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

  const handleSubmit = async (e) => {
    e.preventDefault();
    const valorTotal = calcularValorTotal();
    const custoTotal = calcularCustoTotal();
    
    const data = {
      ...formData,
      quantidade_kg: formData.quantidade_kg ? parseFloat(formData.quantidade_kg) : null,
      quantidade_caixas: formData.quantidade_caixas ? parseFloat(formData.quantidade_caixas) : null,
      preco_unitario: formData.preco_unitario ? parseFloat(formData.preco_unitario) : null,
      custo_colheita: formData.custo_colheita ? parseFloat(formData.custo_colheita) : null,
      valor_total: valorTotal
    };

    if (editingColheita) {
      await updateMutation.mutateAsync({ id: editingColheita.id, data });
    } else {
      await createMutation.mutateAsync(data);
    }

    if (custoTotal > 0) {
      await supabase.from('custos').insert({
        descricao: `Colheita - ${tipoColheitaLabel(formData.tipo_colheita)} - ${getTalhaoNome(formData.talhao_id)}`,
        categoria: 'terceirizado',
        talhao_id: formData.talhao_id,
        valor: custoTotal,
        data: formData.data,
        observacoes: `Custo de colheita: R$ ${formData.custo_colheita}/${formData.unidade_custo}`
      });
      queryClient.invalidateQueries({ queryKey: ['custos'] });
    }
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
            <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto rounded-[2rem]">
                <DialogHeader>
                <DialogTitle>{editingColheita ? 'Editar Colheita' : 'Nova Colheita'}</DialogTitle>
                <DialogDescription>Dados de produção colhida.</DialogDescription>
                </DialogHeader>
                <form onSubmit={handleSubmit} className="space-y-4 pt-2">
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

                    <div className="space-y-2">
                        <Label>Observações</Label>
                        <Textarea value={formData.observacoes || ""} onChange={(e) => setFormData({ ...formData, observacoes: e.target.value })} placeholder="Detalhes..." rows={2} className="rounded-xl" />
                    </div>

                    <div className="flex justify-end gap-3 pt-2">
                        <Button type="button" variant="outline" onClick={resetForm} className="rounded-xl border-stone-200">Cancelar</Button>
                        <Button type="submit" className="bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl px-6" disabled={createMutation.isPending || updateMutation.isPending}>
                            {editingColheita ? 'Salvar' : 'Registrar'}
                        </Button>
                    </div>
                </form>
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
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard title="Total Colhido (Kg)" value={`${(totalKg / 1000).toFixed(1)} ton`} icon={Wheat} color="text-amber-600" />
        <StatCard title="Total Colhido (Cx)" value={`${totalCaixas.toLocaleString('pt-BR')} cx`} icon={Package} color="text-blue-600" />
        <StatCard title="Receita Total" value={`R$ ${totalReceita.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`} icon={TrendingUp} color="text-emerald-600" />
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
                    <Calendar className="w-4 h-4 text-stone-400" />
                    <Input type="date" value={dataInicio || ""} onChange={(e) => setDataInicio(e.target.value)} min="2020-01-01" max="2040-12-31" className="w-32 border-none bg-transparent h-8 p-0 text-sm" />
                    <span className="text-stone-400">-</span>
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
                                {!colheita.quantidade_kg && !colheita.quantidade_caixas && <span className="text-stone-400">-</span>}
                            </div>
                        </TableCell>
                        <TableCell className="text-right">
                            <div className="flex flex-col items-end">
                                <span className="font-bold text-emerald-600">R$ {colheita.valor_total?.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
                                <span className="text-[10px] text-stone-400 font-medium mt-0.5">R$ {colheita.preco_unitario?.toFixed(2)}/{colheita.unidade_preco}</span>
                            </div>
                        </TableCell>
                        <TableCell className="text-right pr-6">
                            <div className="flex justify-end gap-1">
                                <Button variant="ghost" size="icon" className="h-8 w-8 text-stone-400 hover:text-stone-700 hover:bg-stone-100 rounded-lg" onClick={() => handleEdit(colheita)}><Edit className="w-4 h-4" /></Button>
                                <Button variant="ghost" size="icon" className="h-8 w-8 text-red-300 hover:text-red-500 hover:bg-red-50 rounded-lg" onClick={() => deleteMutation.mutate(colheita.id)}><Trash2 className="w-4 h-4" /></Button>
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