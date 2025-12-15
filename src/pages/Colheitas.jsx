import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabaseClient';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Plus, Edit, Trash2, Wheat, Filter, Package, TrendingUp, TrendingDown } from 'lucide-react';
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
  const [filtroTalhao, setFiltroTalhao] = useState('todos');
  const [filtroCultura, setFiltroCultura] = useState('todos');
  const [dataInicio, setDataInicio] = useState('');
  const [dataFim, setDataFim] = useState('');
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

  const { data: talhoes = [] } = useQuery({
    queryKey: ['talhoes'],
    queryFn: async () => {
      const { data, error } = await supabase.from('talhoes').select('*');
      if (error) throw error;
      return data;
    }
  });

  const { data: colheitas = [], isLoading } = useQuery({
    queryKey: ['colheitas'],
    queryFn: async () => {
      const { data, error } = await supabase.from('colheitas').select('*').order('data', { ascending: false });
      if (error) throw error;
      return data;
    }
  });

  const { data: tiposCustomizados = [] } = useQuery({
    queryKey: ['tipos-colheita'],
    queryFn: async () => {
      const { data, error } = await supabase.from('tipos_colheita').select('*');
      if (error) throw error;
      return data;
    }
  });

  const createMutation = useMutation({
    mutationFn: async (data) => {
      const { data: result, error } = await supabase.from('colheitas').insert(data).select();
      if (error) throw error;
      return result;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['colheitas'] });
      resetForm();
    }
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }) => {
      const { data: result, error } = await supabase.from('colheitas').update(data).eq('id', id).select();
      if (error) throw error;
      return result;
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
      if (error) throw error;
      return result;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tipos-colheita'] });
      setNovoTipoColheita({ nome: '', cultura: '' });
      setOpenTipoDialog(false);
    }
  });

  const resetForm = () => {
    setFormData({
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
    const qtd = formData.unidade_preco === 'kg' 
      ? parseFloat(formData.quantidade_kg) || 0
      : parseFloat(formData.quantidade_caixas) || 0;
    const preco = parseFloat(formData.preco_unitario) || 0;
    return qtd * preco;
  };

  const calcularCustoTotal = () => {
    const qtd = formData.unidade_custo === 'kg' 
      ? parseFloat(formData.quantidade_kg) || 0
      : parseFloat(formData.quantidade_caixas) || 0;
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

  const tiposColheitaPadrao = formData.cultura === 'manga' ? tiposColheitaManga : 
                               formData.cultura === 'goiaba' ? tiposColheitaGoiaba : [];
  
  const tiposCustomizadosFiltrados = tiposCustomizados.filter(t => t.cultura === formData.cultura);
  
  const tiposColheita = [
    ...tiposColheitaPadrao,
    ...tiposCustomizadosFiltrados.map(t => ({ value: t.nome, label: t.nome }))
  ];

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
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-stone-900">Colheitas</h1>
          <p className="text-stone-500">Registro e acompanhamento de colheitas</p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button className="bg-amber-600 hover:bg-amber-700">
              <Plus className="w-4 h-4 mr-2" />
              Nova Colheita
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>
                {editingColheita ? 'Editar Colheita' : 'Nova Colheita'}
              </DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Talhão</Label>
                  <Select
                    value={formData.talhao_id}
                    onValueChange={(value) => setFormData({ ...formData, talhao_id: value })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione" />
                    </SelectTrigger>
                    <SelectContent>
                      {talhoes.map((talhao) => (
                        <SelectItem key={talhao.id} value={talhao.id}>
                          {talhao.nome}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Data</Label>
                  <Input
                    type="date"
                    value={formData.data}
                    onChange={(e) => setFormData({ ...formData, data: e.target.value })}
                    required
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Cultura</Label>
                  <Select
                    value={formData.cultura}
                    onValueChange={(value) => setFormData({ ...formData, cultura: value, tipo_colheita: '' })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="manga">Manga</SelectItem>
                      <SelectItem value="goiaba">Goiaba</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label>Tipo de Colheita</Label>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => setOpenTipoDialog(true)}
                      className="h-7 text-xs"
                      disabled={!formData.cultura}
                    >
                      <Plus className="w-3 h-3 mr-1" />
                      Novo Tipo
                    </Button>
                  </div>
                  <Select
                    value={formData.tipo_colheita}
                    onValueChange={(value) => setFormData({ ...formData, tipo_colheita: value })}
                    disabled={!formData.cultura}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione" />
                    </SelectTrigger>
                    <SelectContent>
                      {tiposColheita.map((tipo) => (
                        <SelectItem key={tipo.value} value={tipo.value}>
                          {tipo.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Quantidade (kg)</Label>
                  <Input
                    type="number"
                    step="0.01"
                    value={formData.quantidade_kg}
                    onChange={(e) => setFormData({ ...formData, quantidade_kg: e.target.value })}
                    placeholder="Ex: 1500"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Quantidade (caixas)</Label>
                  <Input
                    type="number"
                    value={formData.quantidade_caixas}
                    onChange={(e) => setFormData({ ...formData, quantidade_caixas: e.target.value })}
                    placeholder="Ex: 100"
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label>Preço Unitário</Label>
                  <Input
                    type="number"
                    step="0.01"
                    value={formData.preco_unitario}
                    onChange={(e) => setFormData({ ...formData, preco_unitario: e.target.value })}
                    placeholder="R$"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Unidade</Label>
                  <Select
                    value={formData.unidade_preco}
                    onValueChange={(value) => setFormData({ ...formData, unidade_preco: value })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="kg">Por kg</SelectItem>
                      <SelectItem value="caixa">Por caixa</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Receita Total</Label>
                  <div className="h-10 px-3 py-2 bg-emerald-50 rounded-md flex items-center font-medium text-emerald-700">
                    R$ {calcularValorTotal().toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                  </div>
                </div>
              </div>

              <div className="p-4 bg-stone-50 rounded-xl">
                <Label className="text-base font-medium mb-3 block">Custo da Colheita (Terceirizado)</Label>
                <div className="grid grid-cols-3 gap-4">
                  <div className="space-y-2">
                    <Label>Custo Unit.</Label>
                    <Input
                      type="number"
                      step="0.01"
                      value={formData.custo_colheita}
                      onChange={(e) => setFormData({ ...formData, custo_colheita: e.target.value })}
                      placeholder="R$"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Unidade</Label>
                    <Select
                      value={formData.unidade_custo}
                      onValueChange={(value) => setFormData({ ...formData, unidade_custo: value })}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="kg">Por kg</SelectItem>
                        <SelectItem value="caixa">Por caixa</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Custo Total</Label>
                    <div className="h-10 px-3 py-2 bg-red-50 rounded-md flex items-center font-medium text-red-700">
                      R$ {calcularCustoTotal().toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                    </div>
                  </div>
                </div>
              </div>

              <div className="space-y-2">
                <Label>Observações</Label>
                <Textarea
                  value={formData.observacoes}
                  onChange={(e) => setFormData({ ...formData, observacoes: e.target.value })}
                  placeholder="Observações sobre a colheita..."
                  rows={2}
                />
              </div>

              <div className="flex justify-end gap-3 pt-4">
                <Button type="button" variant="outline" onClick={resetForm}>
                  Cancelar
                </Button>
                <Button 
                  type="submit" 
                  className="bg-amber-600 hover:bg-amber-700"
                  disabled={createMutation.isPending || updateMutation.isPending}
                >
                  {editingColheita ? 'Salvar' : 'Registrar'}
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>

        {/* Dialog para criar novo tipo de colheita */}
        <Dialog open={openTipoDialog} onOpenChange={setOpenTipoDialog}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>Criar Novo Tipo de Colheita</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>Cultura</Label>
                <Select
                  value={novoTipoColheita.cultura}
                  onValueChange={(value) => setNovoTipoColheita({ ...novoTipoColheita, cultura: value })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="manga">Manga</SelectItem>
                    <SelectItem value="goiaba">Goiaba</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Nome do Tipo</Label>
                <Input
                  value={novoTipoColheita.nome}
                  onChange={(e) => setNovoTipoColheita({ ...novoTipoColheita, nome: e.target.value })}
                  placeholder="Ex: Premium, Segunda, etc."
                />
              </div>
              <div className="flex justify-end gap-3">
                <Button variant="outline" onClick={() => setOpenTipoDialog(false)}>
                  Cancelar
                </Button>
                <Button 
                  onClick={() => createTipoMutation.mutate(novoTipoColheita)}
                  disabled={!novoTipoColheita.nome || !novoTipoColheita.cultura || createTipoMutation.isPending}
                >
                  Criar
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          title="Total Colhido (Kg)"
          value={`${(totalKg / 1000).toFixed(1)} ton`}
          icon={Wheat}
          iconBg="bg-amber-50"
          iconColor="text-amber-600"
        />
         <StatCard
          title="Total Colhido (Cx)"
          value={`${totalCaixas.toLocaleString('pt-BR')} cx`}
          icon={Package}
          iconBg="bg-blue-50"
          iconColor="text-blue-600"
        />
        <StatCard
          title="Receita Total"
          value={`R$ ${totalReceita.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`}
          iconBg="bg-emerald-50"
          iconColor="text-emerald-600"
        />
         <StatCard
          title="Registros"
          value={colheitasFiltradas.length}
          iconBg="bg-stone-100"
          iconColor="text-stone-600"
        />
      </div>

      {/* Filtros */}
      <Card className="border-stone-100">
        <CardContent className="pt-4">
          <div className="flex flex-wrap items-center gap-4">
            <div className="flex items-center gap-2">
              <Filter className="w-4 h-4 text-stone-400" />
              <span className="text-sm font-medium text-stone-600">Filtros:</span>
            </div>
            <Select value={filtroTalhao} onValueChange={setFiltroTalhao}>
              <SelectTrigger className="w-40">
                <SelectValue placeholder="Talhão" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todos Talhões</SelectItem>
                {talhoes.map((t) => (
                  <SelectItem key={t.id} value={t.id}>{t.nome}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={filtroCultura} onValueChange={setFiltroCultura}>
              <SelectTrigger className="w-40">
                <SelectValue placeholder="Cultura" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todas Culturas</SelectItem>
                <SelectItem value="manga">Manga</SelectItem>
                <SelectItem value="goiaba">Goiaba</SelectItem>
              </SelectContent>
            </Select>
            <div className="flex items-center gap-2">
              <Label className="text-sm text-stone-600">De:</Label>
              <Input
                type="date"
                value={dataInicio}
                onChange={(e) => setDataInicio(e.target.value)}
                min="2020-01-01"
                max="2040-12-31"
                className="w-36"
              />
            </div>
            <div className="flex items-center gap-2">
              <Label className="text-sm text-stone-600">Até:</Label>
              <Input
                type="date"
                value={dataFim}
                onChange={(e) => setDataFim(e.target.value)}
                min="2020-01-01"
                max="2040-12-31"
                className="w-36"
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Tabela Aprimorada */}
      {colheitasFiltradas.length === 0 ? (
        <EmptyState
          icon={Wheat}
          title="Nenhuma colheita registrada"
          description="Registre suas colheitas para acompanhar a produção e o faturamento."
          actionLabel="Registrar Colheita"
          onAction={() => setOpen(true)}
        />
      ) : (
        <Card className="border-stone-100 overflow-hidden">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="bg-stone-50">
                  <TableHead>Data</TableHead>
                  <TableHead>Talhão</TableHead>
                  <TableHead>Cultura</TableHead>
                  <TableHead>Tipo</TableHead>
                  <TableHead className="text-right">Quantidade</TableHead>
                  <TableHead className="text-right">Venda Total</TableHead>
                  <TableHead className="w-24"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {colheitasFiltradas.map((colheita) => (
                  <TableRow key={colheita.id} className="hover:bg-stone-50">
                    <TableCell>
                      {colheita.data ? format(new Date(colheita.data + 'T12:00:00'), 'dd/MM/yyyy') : '-'}
                    </TableCell>
                    <TableCell className="font-medium">{getTalhaoNome(colheita.talhao_id)}</TableCell>
                    <TableCell>
                      <Badge className={
                        colheita.cultura === 'manga' ? 'bg-orange-100 text-orange-700' : 'bg-pink-100 text-pink-700'
                      }>
                        {colheita.cultura === 'manga' ? (
                            <span className="flex items-center gap-1">🥭 Manga</span>
                        ) : (
                            <span className="flex items-center gap-1">🍈 Goiaba</span>
                        )}
                      </Badge>
                    </TableCell>
                    <TableCell className="capitalize">{tipoColheitaLabel(colheita.tipo_colheita)}</TableCell>
                    
                    {/* Coluna Quantidade Inteligente */}
                    <TableCell className="text-right">
                        <div className="flex flex-col items-end">
                            {colheita.quantidade_kg > 0 && (
                                <span className="font-medium text-stone-700">{colheita.quantidade_kg.toLocaleString('pt-BR')} kg</span>
                            )}
                            {colheita.quantidade_caixas > 0 && (
                                <span className="text-xs font-medium text-blue-600 bg-blue-50 px-2 py-0.5 rounded-full mt-0.5">
                                    {colheita.quantidade_caixas.toLocaleString('pt-BR')} cx
                                </span>
                            )}
                            {!colheita.quantidade_kg && !colheita.quantidade_caixas && (
                                <span className="text-stone-400">-</span>
                            )}
                        </div>
                    </TableCell>

                    <TableCell className="text-right">
                        <div className="flex flex-col items-end">
                            <span className="font-bold text-emerald-600">
                                R$ {colheita.valor_total?.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                            </span>
                            <span className="text-xs text-stone-400">
                                (R$ {colheita.preco_unitario?.toFixed(2)}/{colheita.unidade_preco})
                            </span>
                        </div>
                    </TableCell>
                    
                    <TableCell>
                      <div className="flex items-center justify-end gap-1">
                        <Button 
                          variant="ghost" 
                          size="sm"
                          onClick={() => handleEdit(colheita)}
                        >
                          <Edit className="w-4 h-4" />
                        </Button>
                        <Button 
                          variant="ghost" 
                          size="sm"
                          className="text-red-600 hover:text-red-700 hover:bg-red-50"
                          onClick={() => deleteMutation.mutate(colheita.id)}
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
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