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
import { Plus, Edit, Trash2, Package, AlertTriangle, Search, History, Archive } from 'lucide-react';
import EmptyState from '@/components/ui/EmptyState';
import StatCard from '@/components/ui/StatCard';

const categoriaLabels = {
  fertilizante: { label: 'Fertilizante', color: 'bg-green-100 text-green-700 border-green-200' },
  defensivo: { label: 'Defensivo', color: 'bg-red-100 text-red-700 border-red-200' },
  adubo: { label: 'Adubo', color: 'bg-amber-100 text-amber-700 border-amber-200' },
  semente: { label: 'Semente', color: 'bg-purple-100 text-purple-700 border-purple-200' },
  outro: { label: 'Outro', color: 'bg-stone-100 text-stone-700 border-stone-200' }
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
      // Remover campos vazios ou undefined para evitar erro no supabase se a coluna for not null ou tiver default
      const cleanData = Object.fromEntries(Object.entries(data).filter(([_, v]) => v !== undefined && v !== ''));
      
      if (editingInsumo) {
        const { error } = await supabase.from('insumos').update(cleanData).eq('id', editingInsumo.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('insumos').insert([cleanData]);
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
      {/* Header Padronizado */}
      <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-4 bg-white p-4 rounded-[1.5rem] border border-stone-100 shadow-sm">
        <div>
          <h1 className="text-2xl font-bold text-stone-900 tracking-tight">Insumos e Estoque</h1>
          <p className="text-stone-500 font-medium">Controle de materiais e inventário</p>
        </div>
        
        <div className="flex items-center gap-3">
            <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-stone-400" />
                <Input 
                  placeholder="Buscar insumo..." 
                  className="pl-10 rounded-xl bg-stone-50 border-stone-200 w-64 focus:bg-white transition-colors"
                  value={busca}
                  onChange={(e) => setBusca(e.target.value)}
                />
            </div>

            <Dialog open={open} onOpenChange={setOpen}>
                <DialogTrigger asChild>
                    <Button className="bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl h-10 px-5 shadow-lg shadow-emerald-100 transition-all active:scale-95 ml-2">
                    <Plus className="w-4 h-4 mr-2" /> Novo Insumo
                    </Button>
                </DialogTrigger>
                <DialogContent className="sm:max-w-lg rounded-[2rem]">
                    <DialogHeader>
                    <DialogTitle>{editingInsumo ? 'Editar Insumo' : 'Cadastrar Novo Insumo'}</DialogTitle>
                    <DialogDescription>
                        Gestão de estoque para planejamento de atividades.
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
                                <Label>Preço Unit. (R$)</Label>
                                <Input type="number" step="0.01" value={formData.preco_unitario} onChange={(e) => setFormData({...formData, preco_unitario: e.target.value})} placeholder="0,00" className="rounded-xl" />
                            </div>
                        </div>

                        <div className="space-y-2">
                            <Label>Fornecedor</Label>
                            <Input value={formData.fornecedor} onChange={(e) => setFormData({...formData, fornecedor: e.target.value})} placeholder="Empresa/Vendedor" className="rounded-xl" />
                        </div>

                        <div className="space-y-2">
                             <Label>Observações</Label>
                             <Textarea value={formData.observacoes} onChange={(e) => setFormData({...formData, observacoes: e.target.value})} placeholder="Detalhes..." rows={2} className="rounded-xl" />
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
      </div>

      {/* KPI Cards Padronizados */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <StatCard title="Total de Itens" value={insumos.length} icon={Package} color="text-blue-600" />
        <StatCard title="Estoque Crítico" value={itensAbaixoMinimo} icon={AlertTriangle} color="text-red-600" />
        <StatCard title="Valor em Estoque" value={`R$ ${totalPatrimonio.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`} icon={History} color="text-emerald-600" />
      </div>

      {/* Tabela Padronizada */}
      {insumosFiltrados.length === 0 ? (
        <EmptyState 
            icon={Archive} 
            title="Nenhum insumo encontrado" 
            description={busca ? "Tente buscar por outro termo." : "Cadastre os insumos para controlar seu estoque."}
            actionLabel={busca ? "Limpar Busca" : "Novo Insumo"}
            onAction={busca ? () => setBusca('') : () => setOpen(true)}
        />
      ) : (
        <Card className="border-stone-100 rounded-[2rem] shadow-sm overflow-hidden flex flex-col">
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
                            {isBaixo && <Badge variant="destructive" className="text-[9px] h-4 bg-red-500 hover:bg-red-600">CRÍTICO</Badge>}
                        </div>
                        <div className="text-[10px] text-stone-400 uppercase tracking-tight">{insumo.fornecedor || 'Fornecedor N/A'}</div>
                        </TableCell>
                        <TableCell>
                        <Badge className={`${categoriaLabels[insumo.categoria]?.color || 'bg-stone-100 text-stone-600 border-stone-200'} border`}>
                            {categoriaLabels[insumo.categoria]?.label || insumo.categoria}
                        </Badge>
                        </TableCell>
                        <TableCell className="text-right font-medium text-stone-600">R$ {insumo.preco_unitario?.toFixed(2)}</TableCell>
                        <TableCell className="text-right">
                        <div className={isBaixo ? "text-red-600 font-bold" : "text-stone-700 font-bold"}>
                            {insumo.estoque_atual} {insumo.unidade}
                        </div>
                        {insumo.estoque_minimo && (
                            <div className="text-[10px] text-stone-400">mín: {insumo.estoque_minimo}</div>
                        )}
                        </TableCell>
                        <TableCell className="text-right pr-6">
                        <div className="flex justify-end gap-1">
                            <Button variant="ghost" size="icon" className="h-8 w-8 text-stone-400 hover:text-stone-700 hover:bg-stone-100 rounded-lg" onClick={() => handleEdit(insumo)}><Edit className="w-4 h-4" /></Button>
                            <Button variant="ghost" size="icon" className="h-8 w-8 text-red-300 hover:text-red-500 hover:bg-red-50 rounded-lg" onClick={() => { if(confirm("Remover do estoque?")) deleteMutation.mutate(insumo.id) }}><Trash2 className="w-4 h-4" /></Button>
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