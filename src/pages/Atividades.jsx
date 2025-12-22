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
import { Switch } from '@/components/ui/switch';
import { Plus, Edit, Trash2, ClipboardList, Filter, Package, Copy, MessageCircle, CheckCircle2 } from 'lucide-react';
import EmptyState from '@/components/ui/EmptyState';
import { format } from 'date-fns';

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
  programada: { label: 'Programada', color: 'bg-blue-100 text-blue-700' },
  em_andamento: { label: 'Em Andamento', color: 'bg-amber-100 text-amber-700' },
  concluida: { label: 'Concluída', color: 'bg-emerald-100 text-emerald-700' },
  cancelada: { label: 'Cancelada', color: 'bg-red-100 text-red-700' }
};

export default function Atividades() {
  const [open, setOpen] = useState(false);
  const [editingAtividade, setEditingAtividade] = useState(null);
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

  const { data: talhoes = [] } = useQuery({
    queryKey: ['talhoes'],
    queryFn: async () => {
      const { data, error } = await supabase.from('talhoes').select('*');
      if (error) throw error;
      return data;
    }
  });

  const { data: atividades = [] } = useQuery({
    queryKey: ['atividades'],
    queryFn: async () => {
      const { data, error } = await supabase.from('atividades').select('*').order('data_programada', { ascending: false });
      if (error) throw error;
      return data;
    }
  });

  const { data: insumos = [] } = useQuery({
    queryKey: ['insumos'],
    queryFn: async () => {
      const { data, error } = await supabase.from('insumos').select('*');
      if (error) throw error;
      return data;
    }
  });

  const { data: tiposCustomizados = [] } = useQuery({
    queryKey: ['tipos-atividade'],
    queryFn: async () => {
      const { data, error } = await supabase.from('tipos_atividade').select('*');
      if (error) throw error;
      return data;
    }
  });

  const createMutation = useMutation({
    mutationFn: async (data) => {
      const { data: result, error } = await supabase.from('atividades').insert(data).select();
      if (error) throw error;
      return result;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['atividades'] });
      resetForm();
    }
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }) => {
      const { data: result, error } = await supabase.from('atividades').update(data).eq('id', id).select();
      if (error) throw error;
      return result;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['atividades'] });
      resetForm();
    }
  });

  const deleteMutation = useMutation({
    mutationFn: async (id) => {
      const { error } = await supabase.from('atividades').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['atividades'] });
    }
  });

  const createTipoMutation = useMutation({
    mutationFn: async (data) => {
      const { data: result, error } = await supabase.from('tipos_atividade').insert(data).select();
      if (error) throw error;
      return result;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tipos-atividade'] });
      setNovoTipo('');
    }
  });

  const deleteTipoMutation = useMutation({
    mutationFn: async (id) => {
      const { error } = await supabase.from('tipos_atividade').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tipos-atividade'] });
    }
  });

  const resetForm = () => {
    setFormData({
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
    setInsumoTemp({ insumo_id: '', quantidade: '', metodo_aplicacao: 'foliar' });
    setEditingAtividade(null);
    setOpen(false);
  };

  const handleEdit = (atividade) => {
    setEditingAtividade(atividade);
    setFormData({
      talhao_id: atividade.talhao_id || '',
      tipo: atividade.tipo || '',
      tipo_personalizado: atividade.tipo_personalizado || '',
      data_programada: atividade.data_programada || '',
      data_realizada: atividade.data_realizada || '',
      status: atividade.status || 'programada',
      terceirizada: atividade.terceirizada || false,
      valor_terceirizado: atividade.valor_terceirizado || '',
      insumos_utilizados: atividade.insumos_utilizados || [],
      custo_total: atividade.custo_total || 0,
      responsavel: atividade.responsavel || '',
      observacoes: atividade.observacoes || ''
    });
    setOpen(true);
  };

  const handleDuplicate = (atividade) => {
    setEditingAtividade(null);
    setFormData({
      talhao_id: atividade.talhao_id || '',
      tipo: atividade.tipo || '',
      tipo_personalizado: atividade.tipo_personalizado || '',
      data_programada: format(new Date(), 'yyyy-MM-dd'),
      data_realizada: '',
      status: 'programada',
      terceirizada: atividade.terceirizada || false,
      valor_terceirizado: atividade.valor_terceirizado || '',
      insumos_utilizados: atividade.insumos_utilizados || [],
      custo_total: atividade.custo_total || 0,
      responsavel: atividade.responsavel || '',
      observacoes: atividade.observacoes || ''
    });
    setOpen(true);
  };

  const addInsumo = () => {
    if (!insumoTemp.insumo_id || !insumoTemp.quantidade) return;
    
    const insumoSelecionado = insumos.find(i => i.id === insumoTemp.insumo_id);
    if (!insumoSelecionado) return;

    const quantidade = parseFloat(insumoTemp.quantidade);
    const valorUnitario = insumoSelecionado.preco_unitario || 0;
    const valorTotal = quantidade * valorUnitario;

    const metodoFinal = insumoTemp.metodo_aplicacao === 'outro' ? novoMetodo : insumoTemp.metodo_aplicacao;

    const novoInsumo = {
      insumo_id: insumoSelecionado.id,
      nome: insumoSelecionado.nome,
      quantidade,
      unidade: insumoSelecionado.unidade,
      valor_unitario: valorUnitario,
      valor_total: valorTotal,
      metodo_aplicacao: metodoFinal
    };

    const novosInsumos = [...formData.insumos_utilizados, novoInsumo];
    
    setFormData({
      ...formData,
      insumos_utilizados: novosInsumos,
      custo_total: novosInsumos.reduce((acc, i) => acc + (i.valor_total || 0), 0) + (formData.terceirizada ? parseFloat(formData.valor_terceirizado) || 0 : 0)
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
      custo_total: novosInsumos.reduce((acc, i) => acc + (i.valor_total || 0), 0) + (formData.terceirizada ? parseFloat(formData.valor_terceirizado) || 0 : 0)
    });
  };

  const calcularCustoTotal = () => {
    const custoInsumos = formData.insumos_utilizados.reduce((acc, i) => acc + (i.valor_total || 0), 0);
    const custoTerceirizado = formData.terceirizada ? parseFloat(formData.valor_terceirizado) || 0 : 0;
    return custoInsumos + custoTerceirizado;
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    const data = {
      ...formData,
      valor_terceirizado: formData.valor_terceirizado ? parseFloat(formData.valor_terceirizado) : null,
      custo_total: calcularCustoTotal(),
      // Se status for concluída, preenche data_realizada automaticamente se estiver vazia
      data_realizada: formData.status === 'concluida' ? (formData.data_realizada || format(new Date(), 'yyyy-MM-dd')) : null
    };

    if (editingAtividade) {
      updateMutation.mutate({ id: editingAtividade.id, data });
    } else {
      createMutation.mutate(data);
    }
  };

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
    
    const text = `🚜 *Nova Atividade Programada*\n\n` +
      `📍 *Local:* ${talhaoNome}\n` +
      `🔧 *Atividade:* ${tipoNome}\n` +
      `📅 *Data:* ${data}\n` +
      `${atividade.observacoes ? `📝 *Obs:* ${atividade.observacoes}` : ''}`;
  
    const url = `https://wa.me/?text=${encodeURIComponent(text)}`;
    window.open(url, '_blank');
  };

  const todosTipos = [
    ...tiposAtividadePadrao,
    ...tiposCustomizados.map(t => ({ value: t.nome, label: t.nome }))
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-stone-900">Atividades</h1>
          <p className="text-stone-500">Gerenciamento de atividades por talhão</p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button className="bg-blue-600 hover:bg-blue-700">
              <Plus className="w-4 h-4 mr-2" />
              Nova Atividade
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>
                {editingAtividade ? 'Editar Atividade' : 'Nova Atividade'}
              </DialogTitle>
              <DialogDescription className="sr-only">
                Configure os detalhes da atividade agrícola, incluindo insumos e prazos.
              </DialogDescription>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Talhão</Label>
                  <Select
                    value={formData.talhao_id || ""}
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
                  <div className="flex items-center justify-between">
                    <Label>Tipo de Atividade</Label>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => setOpenTipoDialog(true)}
                      className="h-7 text-xs text-blue-600 hover:text-blue-700 hover:bg-blue-50"
                    >
                      <Plus className="w-3 h-3 mr-1" />
                      Gerenciar Tipos
                    </Button>
                  </div>
                  <Select
                    value={formData.tipo || ""}
                    onValueChange={(value) => setFormData({ ...formData, tipo: value })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione" />
                    </SelectTrigger>
                    <SelectContent>
                      {todosTipos.map((tipo) => (
                        <SelectItem key={tipo.value} value={tipo.value}>
                          {tipo.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {formData.tipo === 'outro' && (
                <div className="space-y-2">
                  <Label>Nome da Atividade</Label>
                  <Input
                    value={formData.tipo_personalizado || ""}
                    onChange={(e) => setFormData({ ...formData, tipo_personalizado: e.target.value })}
                    placeholder="Descreva a atividade"
                  />
                </div>
              )}

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Data Programada</Label>
                  <Input
                    type="date"
                    value={formData.data_programada || ""}
                    onChange={(e) => setFormData({ ...formData, data_programada: e.target.value })}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label>Status</Label>
                  <Select
                    value={formData.status || ""}
                    onValueChange={(value) => setFormData({ ...formData, status: value })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="programada">Programada</SelectItem>
                      <SelectItem value="em_andamento">Em Andamento</SelectItem>
                      <SelectItem value="concluida">Concluída</SelectItem>
                      <SelectItem value="cancelada">Cancelada</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="space-y-2">
                <Label>Responsável</Label>
                <Input
                  value={formData.responsavel || ""}
                  onChange={(e) => setFormData({ ...formData, responsavel: e.target.value })}
                  placeholder="Nome do responsável"
                />
              </div>

              <div className="p-4 bg-stone-50 rounded-xl space-y-4">
                <div className="flex items-center justify-between">
                  <Label className="text-base font-medium">Atividade Terceirizada</Label>
                  <Switch
                    checked={formData.terceirizada}
                    onCheckedChange={(checked) => setFormData({ ...formData, terceirizada: checked })}
                  />
                </div>
                {formData.terceirizada && (
                  <div className="space-y-2">
                    <Label>Valor do Serviço</Label>
                    <Input
                      type="number"
                      step="0.01"
                      value={formData.valor_terceirizado || ""}
                      onChange={(e) => setFormData({ ...formData, valor_terceirizado: e.target.value })}
                      placeholder="R$ 0,00"
                    />
                  </div>
                )}
              </div>

              <div className="p-4 bg-stone-50 rounded-xl space-y-4">
                <Label className="text-base font-medium">Insumos Utilizados</Label>
                <div className="flex flex-wrap gap-2">
                  <Select
                    value={insumoTemp.insumo_id || ""}
                    onValueChange={(value) => setInsumoTemp({ ...insumoTemp, insumo_id: value })}
                  >
                    <SelectTrigger className="w-60">
                      <SelectValue placeholder="Selecione um insumo" />
                    </SelectTrigger>
                    <SelectContent>
                      {insumos.map((insumo) => (
                        <SelectItem key={insumo.id} value={insumo.id}>
                          {insumo.nome} (R$ {insumo.preco_unitario?.toFixed(2)}/{insumo.unidade})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Input
                    type="number"
                    step="0.01"
                    placeholder="Quantidade"
                    className="w-28"
                    value={insumoTemp.quantidade || ""}
                    onChange={(e) => setInsumoTemp({ ...insumoTemp, quantidade: e.target.value })}
                  />
                  <Select
                    value={insumoTemp.metodo_aplicacao || ""}
                    onValueChange={(value) => {
                      setInsumoTemp({ ...insumoTemp, metodo_aplicacao: value });
                      setMostrarNovoMetodo(value === 'outro');
                    }}
                  >
                    <SelectTrigger className="w-40">
                      <SelectValue placeholder="Método" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="foliar">Foliar</SelectItem>
                      <SelectItem value="adubacao">Adubação</SelectItem>
                      <SelectItem value="solo">Solo</SelectItem>
                      <SelectItem value="fertirrigacao">Fertirrigação</SelectItem>
                      <SelectItem value="outro">Outro...</SelectItem>
                    </SelectContent>
                  </Select>
                  {mostrarNovoMetodo && (
                    <Input
                      placeholder="Nome do método"
                      className="w-40"
                      value={novoMetodo || ""}
                      onChange={(e) => setNovoMetodo(e.target.value)}
                    />
                  )}
                  <Button type="button" onClick={addInsumo} variant="outline" size="icon">
                    <Plus className="w-4 h-4" />
                  </Button>
                </div>

                {formData.insumos_utilizados.length > 0 && (
                  <div className="space-y-2">
                    {formData.insumos_utilizados.map((insumo, index) => (
                      <div key={index} className="flex items-start justify-between gap-3 p-3 bg-white rounded-lg border hover:border-stone-300 transition-colors">
                        <div className="flex items-start gap-3 flex-1">
                          <div className="mt-0.5">
                            <Package className="w-4 h-4 text-emerald-600" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="font-medium text-stone-900 mb-1">{insumo.nome}</div>
                            <div className="flex flex-wrap items-center gap-2 text-sm">
                              <Badge variant="secondary" className="text-xs">
                                {insumo.quantidade} {insumo.unidade}
                              </Badge>
                              {insumo.metodo_aplicacao && (
                                <Badge variant="outline" className="text-xs capitalize bg-blue-50 text-blue-700 border-blue-200">
                                  {insumo.metodo_aplicacao}
                                </Badge>
                              )}
                              <span className="text-emerald-600 font-semibold">
                                R$ {insumo.valor_total?.toFixed(2)}
                              </span>
                            </div>
                          </div>
                        </div>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => removeInsumo(index)}
                          className="text-red-600 hover:text-red-700 hover:bg-red-50 shrink-0"
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="flex items-center justify-between p-4 bg-emerald-50 rounded-xl">
                <span className="font-medium text-emerald-800">Custo Total da Atividade</span>
                <span className="text-xl font-bold text-emerald-600">
                  R$ {calcularCustoTotal().toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                </span>
              </div>

              <div className="space-y-2">
                <Label>Observações</Label>
                <Textarea
                  value={formData.observacoes || ""}
                  onChange={(e) => setFormData({ ...formData, observacoes: e.target.value })}
                  placeholder="Observações sobre a atividade..."
                  rows={2}
                />
              </div>

              <div className="flex justify-end gap-3 pt-4">
                <Button type="button" variant="outline" onClick={resetForm}>
                  Cancelar
                </Button>
                <Button 
                  type="submit" 
                  className="bg-blue-600 hover:bg-blue-700"
                  disabled={createMutation.isPending || updateMutation.isPending}
                >
                  {editingAtividade ? 'Salvar' : 'Criar'}
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>

        <Dialog open={openTipoDialog} onOpenChange={setOpenTipoDialog}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>Gerenciar Tipos de Atividade</DialogTitle>
              <DialogDescription className="sr-only">
                Adicione ou remova tipos personalizados de atividades agrícolas.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-6">
              <div className="space-y-2 p-4 bg-stone-50 rounded-lg">
                <Label className="text-sm font-medium">Adicionar Novo Tipo</Label>
                <div className="flex gap-2">
                  <Input
                    value={novoTipo || ""}
                    onChange={(e) => setNovoTipo(e.target.value)}
                    placeholder="Ex: Desbrota"
                    className="flex-1"
                  />
                  <Button 
                    onClick={() => createTipoMutation.mutate({ nome: novoTipo })}
                    disabled={!novoTipo || createTipoMutation.isPending}
                    className="bg-emerald-600 hover:bg-emerald-700"
                  >
                    <Plus className="w-4 h-4 mr-1" />
                    Adicionar
                  </Button>
                </div>
              </div>

              <div className="space-y-2">
                <Label className="text-sm font-medium">Tipos Personalizados Cadastrados</Label>
                {tiposCustomizados.length === 0 ? (
                  <p className="text-sm text-stone-500 italic">Nenhum tipo personalizado cadastrado.</p>
                ) : (
                  <div className="border rounded-md divide-y max-h-60 overflow-y-auto">
                    {tiposCustomizados.map((tipo) => (
                      <div key={tipo.id} className="flex items-center justify-between p-3 bg-white hover:bg-stone-50">
                        <span className="text-sm text-stone-700 font-medium">{tipo.nome}</span>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => deleteTipoMutation.mutate(tipo.id)}
                          className="h-8 w-8 p-0 text-stone-400 hover:text-red-600 hover:bg-red-50 rounded-full"
                          title="Excluir este tipo"
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
              
              <div className="flex justify-end pt-2">
                <Button variant="outline" onClick={() => setOpenTipoDialog(false)}>
                  Fechar
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <Card className="border-stone-100">
        <CardContent className="pt-4">
          <div className="flex flex-wrap items-center gap-4">
            <div className="flex items-center gap-2">
              <Filter className="w-4 h-4 text-stone-400" />
              <span className="text-sm font-medium text-stone-600">Filtros:</span>
            </div>
            <Select value={filtroTalhao || "todos"} onValueChange={setFiltroTalhao}>
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
            <Select value={filtroStatus || "todos"} onValueChange={setFiltroStatus}>
              <SelectTrigger className="w-40">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todos Status</SelectItem>
                <SelectItem value="programada">Programada</SelectItem>
                <SelectItem value="em_andamento">Em Andamento</SelectItem>
                <SelectItem value="concluida">Concluída</SelectItem>
                <SelectItem value="cancelada">Cancelada</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {atividadesFiltradas.length === 0 ? (
        <EmptyState
          icon={ClipboardList}
          title="Nenhuma atividade cadastrada"
          description="Cadastre suas atividades para acompanhar o manejo dos talhões."
          actionLabel="Cadastrar Atividade"
          onAction={() => setOpen(true)}
        />
      ) : (
        <Card className="border-stone-100 overflow-hidden">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="bg-stone-50">
                  <TableHead>Talhão</TableHead>
                  <TableHead>Tipo</TableHead>
                  <TableHead>Data Prog.</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Custo</TableHead>
                  <TableHead className="w-24 text-right pr-6">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {atividadesFiltradas.map((atividade) => (
                  <TableRow key={atividade.id} className="hover:bg-stone-50">
                    <TableCell className="font-medium">{getTalhaoNome(atividade.talhao_id)}</TableCell>
                    <TableCell>
                      {atividade.tipo === 'outro' ? atividade.tipo_personalizado : getTipoLabel(atividade.tipo)}
                      {atividade.terceirizada && (
                        <Badge variant="outline" className="ml-2 text-xs">Terceirizada</Badge>
                      )}
                    </TableCell>
                    <TableCell>
                      {atividade.data_programada ? format(new Date(atividade.data_programada + 'T12:00:00'), 'dd/MM/yyyy') : '-'}
                    </TableCell>
                    <TableCell>
                      <Badge className={statusLabels[atividade.status]?.color}>
                        {statusLabels[atividade.status]?.label}
                      </Badge>
                    </TableCell>
                    <TableCell className={`text-right font-medium ${atividade.status === 'concluida' ? 'text-emerald-600' : 'text-stone-400'}`}>
                      R$ {(atividade.custo_total || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center justify-end gap-1 pr-4">
                        {atividade.status !== 'concluida' && (
                           <Button 
                             variant="ghost" 
                             size="sm"
                             className="text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50"
                             onClick={() => {
                               updateMutation.mutate({ 
                                 id: atividade.id, 
                                 data: { ...atividade, status: 'concluida', data_realizada: format(new Date(), 'yyyy-MM-dd') } 
                               });
                             }}
                             title="Concluir"
                           >
                             <CheckCircle2 className="w-4 h-4" />
                           </Button>
                        )}
                        <Button 
                          variant="ghost" 
                          size="sm"
                          onClick={() => handleShareWhatsApp(atividade)}
                          title="Enviar no WhatsApp"
                          className="text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50"
                        >
                          <MessageCircle className="w-4 h-4" />
                        </Button>
                        <Button 
                          variant="ghost" 
                          size="sm"
                          onClick={() => handleEdit(atividade)}
                          title="Editar"
                        >
                          <Edit className="w-4 h-4" />
                        </Button>
                        <Button 
                          variant="ghost" 
                          size="sm"
                          onClick={() => handleDuplicate(atividade)}
                          title="Duplicar"
                          className="text-blue-600 hover:text-blue-700 hover:bg-blue-50"
                        >
                          <Copy className="w-4 h-4" />
                        </Button>
                        <Button 
                          variant="ghost" 
                          size="sm"
                          className="text-red-600 hover:text-red-700 hover:bg-red-50"
                          onClick={() => { if(confirm("Deseja excluir?")) deleteMutation.mutate(atividade.id) }}
                          title="Excluir"
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