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
import { Plus, Edit, Trash2, Package, AlertTriangle, Search, History } from 'lucide-react';
import EmptyState from '@/components/ui/EmptyState';
import StatCard from '@/components/ui/StatCard';

const categoriaLabels = {
  fertilizante: { label: 'Fertilizante', color: 'bg-green-100 text-green-700' },
  defensivo: { label: 'Defensivo', color: 'bg-red-100 text-red-700' },
  adubo: { label: 'Adubo', color: 'bg-amber-100 text-amber-700' },
  semente: { label: 'Semente', color: 'bg-purple-100 text-purple-700' },
  outro: { label: 'Outro', color: 'bg-stone-100 text-stone-700' }
};

export default function Insumos({ showMessage }) {
  const [open, setOpen] = useState(false);
  const [editingInsumo, setEditingInsumo] = useState(null);
  const [busca, setBusca] = useState('');
  const [formData, setFormData] = useState({
    nome: '',
    categoria: 'outro',
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
      const { data, error } = await supabase.from('insumos').select('*').order('nome');
      if (error) throw error;
      return data;
    }
  });

  const saveMutation = useMutation({
    mutationFn: async (data) => {
      if (editingInsumo) {
        const { error } = await supabase.from('insumos').update(data).eq('id', editingInsumo.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('insumos').insert([data]);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['insumos'] });
      if (showMessage) showMessage(editingInsumo ? "Insumo atualizado" : "Novo insumo cadastrado com sucesso!");
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
      if (showMessage) showMessage("Insumo removido do inventário", "error");
    }
  });

  const resetForm = () => {
    setFormData({
      nome: '', categoria: 'outro', unidade: 'kg', preco_unitario: '',
      estoque_atual: '', estoque_minimo: '', fornecedor: '', observacoes: ''
    });
    setEditingInsumo(null);
    setOpen(false);
  };

  const handleEdit = (insumo) => {
    setEditingInsumo(insumo);
    setFormData({
      nome: insumo.nome || '',
      categoria: insumo.categoria || 'outro',
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
      preco_unitario: parseFloat(formData.preco_unitario) || 0,
      estoque_atual: parseFloat(formData.estoque_atual) || 0,
      estoque_minimo: formData.estoque_minimo ? parseFloat(formData.estoque_minimo) : null
    };
    saveMutation.mutate(data);
  };

  const insumosFiltrados = insumos.filter(i => 
    i.nome.toLowerCase().includes(busca.toLowerCase()) ||
    i.categoria.toLowerCase().includes(busca.toLowerCase())
  );

  const totalPatrimonio = insumos.reduce((acc, i) => acc + ((i.estoque_atual || 0) * (i.preco_unitario || 0)), 0);
  const itensAbaixoMinimo = insumos.filter(i => i.estoque_minimo && i.estoque_atual <= i.estoque_minimo).length;

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-stone-900">Insumos e Estoque</h1>
          <p className="text-stone-500">Controle de materiais e inventário agrícola</p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button className="bg-emerald-600 hover:bg-emerald-700 rounded-xl">
              <Plus className="w-4 h-4 mr-2" /> Novo Insumo
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-lg rounded-[2rem]">
            <DialogHeader>
              <DialogTitle>{editingInsumo ? 'Editar Insumo' : 'Cadastrar Novo Insumo'}</DialogTitle>
              <DialogDescription>
                Mantenha seu estoque atualizado para garantir o planejamento das atividades.
              </DialogDescription>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4 pt-4">
              <div className="space-y-2">
                <Label>Nome do Produto</Label>
                <Input value={formData.nome} onChange={(e) => setFormData({...formData, nome: e.target.value})} placeholder="Ex: Glifosato 480" required className="rounded-xl" />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Categoria</Label>
                  <Select value={formData.categoria} onValueChange={(v) => setFormData({...formData, categoria: v})}>
                    <SelectTrigger className="rounded-xl"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {Object.entries(categoriaLabels).map(([key, { label }]) => (
                        <SelectItem key={key} value={key}>{label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Unidade de Medida</Label>
                  <Select value={formData.unidade} onValueChange={(v) => setFormData({...formData, unidade: v})}>
                    <SelectTrigger className="rounded-xl"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="kg">Quilograma (kg)</SelectItem>
                      <SelectItem value="L">Litro (L)</SelectItem>
                      <SelectItem value="un">Unidade (un)</SelectItem>
                      <SelectItem value="sc">Saca (sc)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label>Estoque Atual</Label>
                  <Input type="number" step="0.01" value={formData.estoque_atual} onChange={(e) => setFormData({...formData, estoque_atual: e.target.value})} required className="rounded-xl" />
                </div>
                <div className="space-y-2">
                  <Label>Estoque Mínimo</Label>
                  <Input type="number" step="0.01" value={formData.estoque_minimo} onChange={(e) => setFormData({...formData, estoque_minimo: e.target.value})} className="rounded-xl" />
                </div>
                <div className="space-y-2">
                  <Label>Preço Unit.</Label>
                  <Input type="number" step="0.01" value={formData.preco_unitario} onChange={(e) => setFormData({...formData, preco_unitario: e.target.value})} placeholder="R$" className="rounded-xl" />
                </div>
              </div>

              <div className="space-y-2">
                <Label>Fornecedor</Label>
                <Input value={formData.fornecedor} onChange={(e) => setFormData({...formData, fornecedor: e.target.value})} placeholder="Nome da empresa/vendedor" className="rounded-xl" />
              </div>

              <div className="flex justify-end gap-3 pt-4">
                <Button type="button" variant="outline" onClick={resetForm} className="rounded-xl">Cancelar</Button>
                <Button type="submit" className="bg-emerald-600 hover:bg-emerald-700 rounded-xl px-8" disabled={saveMutation.isPending}>
                  {editingInsumo ? 'Salvar' : 'Cadastrar'}
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <StatCard title="Total de Itens" value={insumos.length} icon={Package} color="text-blue-600" />
        <StatCard title="Abaixo do Mínimo" value={itensAbaixoMinimo} icon={AlertTriangle} color="text-red-600" />
        <StatCard title="Valor em Estoque" value={`R$ ${totalPatrimonio.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`} icon={History} color="text-emerald-600" />
      </div>

      <Card className="border-stone-100 rounded-2xl shadow-sm">
        <div className="p-4 border-b border-stone-100">
          <div className="relative max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-stone-400" />
            <Input 
              placeholder="Buscar insumo ou categoria..." 
              className="pl-10 rounded-xl"
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
            />
          </div>
        </div>
        <div className="overflow-x-auto">
          <Table>
            <TableHeader className="bg-stone-50">
              <TableRow>
                <TableHead className="pl-6">Insumo</TableHead>
                <TableHead>Categoria</TableHead>
                <TableHead className="text-right">Preço Unit.</TableHead>
                <TableHead className="text-right">Estoque</TableHead>
                <TableHead className="text-right pr-6">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {insumosFiltrados.map((insumo) => {
                const isBaixo = insumo.estoque_minimo && insumo.estoque_atual <= insumo.estoque_minimo;
                return (
                  <TableRow key={insumo.id} className="hover:bg-stone-50 transition-colors">
                    <TableCell className="pl-6">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-stone-800">{insumo.nome}</span>
                        {isBaixo && <Badge variant="destructive" className="text-[9px] h-4">CRÍTICO</Badge>}
                      </div>
                      <div className="text-[10px] text-stone-400 uppercase tracking-tight">{insumo.fornecedor || 'Sem fornecedor'}</div>
                    </TableCell>
                    <TableCell>
                      <Badge className={categoriaLabels[insumo.categoria]?.color}>
                        {categoriaLabels[insumo.categoria]?.label}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right font-medium">R$ {insumo.preco_unitario?.toFixed(2)}</TableCell>
                    <TableCell className="text-right">
                      <div className={isBaixo ? "text-red-600 font-bold" : "text-stone-700 font-medium"}>
                        {insumo.estoque_atual} {insumo.unidade}
                      </div>
                      {insumo.estoque_minimo && (
                        <div className="text-[10px] text-stone-400">mín: {insumo.estoque_minimo}</div>
                      )}
                    </TableCell>
                    <TableCell className="text-right pr-6">
                      <div className="flex justify-end gap-1">
                        <Button variant="ghost" size="sm" onClick={() => handleEdit(insumo)}><Edit className="w-4 h-4" /></Button>
                        <Button variant="ghost" size="sm" className="text-red-400" onClick={() => { if(confirm("Remover do estoque?")) deleteMutation.mutate(insumo.id) }}><Trash2 className="w-4 h-4" /></Button>
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      </Card>
    </div>
  );
}