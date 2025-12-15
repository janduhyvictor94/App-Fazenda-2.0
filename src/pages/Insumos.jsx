import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabaseClient'; // Alterado de base44 para supabase
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Plus, Edit, Trash2, Package, AlertTriangle } from 'lucide-react';
import EmptyState from '@/components/ui/EmptyState';
import StatCard from '@/components/ui/StatCard';

const categoriaLabels = {
  fertilizante: { label: 'Fertilizante', color: 'bg-green-100 text-green-700' },
  defensivo: { label: 'Defensivo', color: 'bg-red-100 text-red-700' },
  adubo: { label: 'Adubo', color: 'bg-amber-100 text-amber-700' },
  semente: { label: 'Semente', color: 'bg-purple-100 text-purple-700' },
  equipamento: { label: 'Equipamento', color: 'bg-blue-100 text-blue-700' },
  combustivel: { label: 'Combustível', color: 'bg-orange-100 text-orange-700' },
  outro: { label: 'Outro', color: 'bg-stone-100 text-stone-700' }
};

export default function Insumos() {
  const [open, setOpen] = useState(false);
  const [editingInsumo, setEditingInsumo] = useState(null);
  const [filtroCategoria, setFiltroCategoria] = useState('todos');
  const [formData, setFormData] = useState({
    nome: '',
    categoria: '',
    unidade: 'kg',
    preco_unitario: '',
    estoque_atual: '',
    estoque_minimo: '',
    fornecedor: '',
    observacoes: ''
  });

  const queryClient = useQueryClient();

  const { data: insumos = [], isLoading } = useQuery({
    queryKey: ['insumos'],
    queryFn: async () => {
      const { data, error } = await supabase.from('insumos').select('*');
      if (error) throw error;
      return data;
    }
  });

  const createMutation = useMutation({
    mutationFn: async (data) => {
      const { data: result, error } = await supabase.from('insumos').insert(data).select();
      if (error) throw error;
      return result;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['insumos'] });
      resetForm();
    }
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }) => {
      const { data: result, error } = await supabase.from('insumos').update(data).eq('id', id).select();
      if (error) throw error;
      return result;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['insumos'] });
      resetForm();
    }
  });

  const deleteMutation = useMutation({
    mutationFn: async (id) => {
      const { error } = await supabase.from('insumos').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['insumos'] });
    }
  });

  const resetForm = () => {
    setFormData({
      nome: '',
      categoria: '',
      unidade: 'kg',
      preco_unitario: '',
      estoque_atual: '',
      estoque_minimo: '',
      fornecedor: '',
      observacoes: ''
    });
    setEditingInsumo(null);
    setOpen(false);
  };

  const handleEdit = (insumo) => {
    setEditingInsumo(insumo);
    setFormData({
      nome: insumo.nome || '',
      categoria: insumo.categoria || '',
      unidade: insumo.unidade || 'kg',
      preco_unitario: insumo.preco_unitario || '',
      estoque_atual: insumo.estoque_atual || '',
      estoque_minimo: insumo.estoque_minimo || '',
      fornecedor: insumo.fornecedor || '',
      observacoes: insumo.observacoes || ''
    });
    setOpen(true);
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    const data = {
      ...formData,
      preco_unitario: formData.preco_unitario ? parseFloat(formData.preco_unitario) : null,
      estoque_atual: formData.estoque_atual ? parseFloat(formData.estoque_atual) : null,
      estoque_minimo: formData.estoque_minimo ? parseFloat(formData.estoque_minimo) : null
    };

    if (editingInsumo) {
      updateMutation.mutate({ id: editingInsumo.id, data });
    } else {
      createMutation.mutate(data);
    }
  };

  // Filtros
  const insumosFiltrados = insumos.filter(i => {
    if (filtroCategoria !== 'todos' && i.categoria !== filtroCategoria) return false;
    return true;
  });

  // Stats
  const totalItens = insumos.length;
  const valorEstoque = insumos.reduce((acc, i) => acc + ((i.estoque_atual || 0) * (i.preco_unitario || 0)), 0);
  const estoqueBaixo = insumos.filter(i => i.estoque_minimo && i.estoque_atual && i.estoque_atual <= i.estoque_minimo).length;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-stone-900">Insumos</h1>
          <p className="text-stone-500">Cadastro e controle de insumos</p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button className="bg-purple-600 hover:bg-purple-700">
              <Plus className="w-4 h-4 mr-2" />
              Novo Insumo
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-lg">
            <DialogHeader>
              <DialogTitle>
                {editingInsumo ? 'Editar Insumo' : 'Novo Insumo'}
              </DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label>Nome do Insumo</Label>
                <Input
                  value={formData.nome}
                  onChange={(e) => setFormData({ ...formData, nome: e.target.value })}
                  placeholder="Ex: Ureia, Roundup, etc."
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Categoria</Label>
                  <Select
                    value={formData.categoria}
                    onValueChange={(value) => setFormData({ ...formData, categoria: value })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="fertilizante">Fertilizante</SelectItem>
                      <SelectItem value="defensivo">Defensivo</SelectItem>
                      <SelectItem value="adubo">Adubo</SelectItem>
                      <SelectItem value="semente">Semente</SelectItem>
                      <SelectItem value="equipamento">Equipamento</SelectItem>
                      <SelectItem value="combustivel">Combustível</SelectItem>
                      <SelectItem value="outro">Outro</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Unidade</Label>
                  <Select
                    value={formData.unidade}
                    onValueChange={(value) => setFormData({ ...formData, unidade: value })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="kg">Kg</SelectItem>
                      <SelectItem value="litro">Litro</SelectItem>
                      <SelectItem value="unidade">Unidade</SelectItem>
                      <SelectItem value="saco">Saco</SelectItem>
                      <SelectItem value="tonelada">Tonelada</SelectItem>
                    </SelectContent>
                  </Select>
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
                  <Label>Estoque Atual</Label>
                  <Input
                    type="number"
                    step="0.01"
                    value={formData.estoque_atual}
                    onChange={(e) => setFormData({ ...formData, estoque_atual: e.target.value })}
                    placeholder="0"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Estoque Mínimo</Label>
                  <Input
                    type="number"
                    step="0.01"
                    value={formData.estoque_minimo}
                    onChange={(e) => setFormData({ ...formData, estoque_minimo: e.target.value })}
                    placeholder="0"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label>Fornecedor</Label>
                <Input
                  value={formData.fornecedor}
                  onChange={(e) => setFormData({ ...formData, fornecedor: e.target.value })}
                  placeholder="Nome do fornecedor"
                />
              </div>

              <div className="space-y-2">
                <Label>Observações</Label>
                <Textarea
                  value={formData.observacoes}
                  onChange={(e) => setFormData({ ...formData, observacoes: e.target.value })}
                  placeholder="Observações sobre o insumo..."
                  rows={2}
                />
              </div>

              <div className="flex justify-end gap-3 pt-4">
                <Button type="button" variant="outline" onClick={resetForm}>
                  Cancelar
                </Button>
                <Button 
                  type="submit" 
                  className="bg-purple-600 hover:bg-purple-700"
                  disabled={createMutation.isPending || updateMutation.isPending}
                >
                  {editingInsumo ? 'Salvar' : 'Cadastrar'}
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <StatCard
          title="Total de Insumos"
          value={totalItens}
          icon={Package}
          iconBg="bg-purple-50"
          iconColor="text-purple-600"
        />
        <StatCard
          title="Valor em Estoque"
          value={`R$ ${valorEstoque.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`}
          iconBg="bg-emerald-50"
          iconColor="text-emerald-600"
        />
        <StatCard
          title="Estoque Baixo"
          value={estoqueBaixo}
          subtitle={estoqueBaixo > 0 ? "Precisam reposição" : "Tudo em ordem"}
          icon={AlertTriangle}
          iconBg={estoqueBaixo > 0 ? "bg-red-50" : "bg-emerald-50"}
          iconColor={estoqueBaixo > 0 ? "text-red-600" : "text-emerald-600"}
        />
      </div>

      {/* Filtro */}
      <Card className="border-stone-100">
        <CardContent className="pt-4">
          <div className="flex flex-wrap items-center gap-4">
            <span className="text-sm font-medium text-stone-600">Categoria:</span>
            <Select value={filtroCategoria} onValueChange={setFiltroCategoria}>
              <SelectTrigger className="w-48">
                <SelectValue placeholder="Todas" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todas Categorias</SelectItem>
                {Object.entries(categoriaLabels).map(([key, { label }]) => (
                  <SelectItem key={key} value={key}>{label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Tabela */}
      {insumosFiltrados.length === 0 ? (
        <EmptyState
          icon={Package}
          title="Nenhum insumo cadastrado"
          description="Cadastre seus insumos para controlar o estoque e custos das atividades."
          actionLabel="Cadastrar Insumo"
          onAction={() => setOpen(true)}
        />
      ) : (
        <Card className="border-stone-100 overflow-hidden">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="bg-stone-50">
                  <TableHead>Nome</TableHead>
                  <TableHead>Categoria</TableHead>
                  <TableHead>Unidade</TableHead>
                  <TableHead className="text-right">Preço Unit.</TableHead>
                  <TableHead className="text-right">Estoque</TableHead>
                  <TableHead>Fornecedor</TableHead>
                  <TableHead className="w-24"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {insumosFiltrados.map((insumo) => {
                  const estoqueBaixo = insumo.estoque_minimo && insumo.estoque_atual && insumo.estoque_atual <= insumo.estoque_minimo;
                  return (
                    <TableRow key={insumo.id} className="hover:bg-stone-50">
                      <TableCell className="font-medium">
                        <div className="flex items-center gap-2">
                          {insumo.nome}
                          {estoqueBaixo && (
                            <AlertTriangle className="w-4 h-4 text-red-500" />
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge className={categoriaLabels[insumo.categoria]?.color}>
                          {categoriaLabels[insumo.categoria]?.label || insumo.categoria}
                        </Badge>
                      </TableCell>
                      <TableCell>{insumo.unidade}</TableCell>
                      <TableCell className="text-right">
                        R$ {insumo.preco_unitario?.toFixed(2) || '-'}
                      </TableCell>
                      <TableCell className="text-right">
                        <span className={estoqueBaixo ? 'text-red-600 font-medium' : ''}>
                          {insumo.estoque_atual || 0}
                        </span>
                        {insumo.estoque_minimo && (
                          <span className="text-stone-400 text-sm"> (mín: {insumo.estoque_minimo})</span>
                        )}
                      </TableCell>
                      <TableCell>{insumo.fornecedor || '-'}</TableCell>
                      <TableCell>
                        <div className="flex items-center justify-end gap-1">
                          <Button 
                            variant="ghost" 
                            size="sm"
                            onClick={() => handleEdit(insumo)}
                          >
                            <Edit className="w-4 h-4" />
                          </Button>
                          <Button 
                            variant="ghost" 
                            size="sm"
                            className="text-red-600 hover:text-red-700 hover:bg-red-50"
                            onClick={() => deleteMutation.mutate(insumo.id)}
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        </Card>
      )}
    </div>
  );
}