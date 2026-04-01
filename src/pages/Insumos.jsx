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
  semente: { label: 'Semente', color: 'bg-emerald-100 text-emerald-700 border-emerald-200' },
  ferramenta: { label: 'Ferramenta', color: 'bg-stone-100 text-stone-700 border-stone-200' },
  outro: { label: 'Outro', color: 'bg-blue-100 text-blue-700 border-blue-200' }
};

export default function Insumos() {
  const [open, setOpen] = useState(false);
  const [editingInsumo, setEditingInsumo] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [filtroCategoria, setFiltroCategoria] = useState('todos');

  const [formData, setFormData] = useState({
    nome: '',
    categoria: '',
    unidade: '',
    estoque_atual: '',
    estoque_minimo: '',
    preco_unitario: '',
    tamanho_embalagem: '1', // NOVO CAMPO
    observacoes: ''
  });

  const queryClient = useQueryClient();

  const { data: insumos = [] } = useQuery({
    queryKey: ['insumos'],
    queryFn: async () => {
      const { data, error } = await supabase.from('insumos').select('*').order('nome');
      if (error) throw error; return data;
    }
  });

  const createMutation = useMutation({
    mutationFn: async (data) => {
      const { data: result, error } = await supabase.from('insumos').insert(data).select();
      if (error) throw error; return result;
    },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['insumos'] }); resetForm(); }
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }) => {
      const { data: result, error } = await supabase.from('insumos').update(data).eq('id', id).select();
      if (error) throw error; return result;
    },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['insumos'] }); resetForm(); }
  });

  const deleteMutation = useMutation({
    mutationFn: async (id) => {
      const { error } = await supabase.from('insumos').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['insumos'] }); }
  });

  const resetForm = () => {
    setFormData({ nome: '', categoria: '', unidade: '', estoque_atual: '', estoque_minimo: '', preco_unitario: '', tamanho_embalagem: '1', observacoes: '' });
    setEditingInsumo(null);
    setOpen(false);
  };

  const handleEdit = (insumo) => {
    setEditingInsumo(insumo);
    setFormData({
      nome: insumo.nome || '',
      categoria: insumo.categoria || '',
      unidade: insumo.unidade || '',
      estoque_atual: insumo.estoque_atual || '',
      estoque_minimo: insumo.estoque_minimo || '',
      preco_unitario: insumo.preco_unitario || '',
      tamanho_embalagem: insumo.tamanho_embalagem || '1',
      observacoes: insumo.observacoes || ''
    });
    setOpen(true);
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    const payload = {
      ...formData,
      estoque_atual: formData.estoque_atual ? parseFloat(formData.estoque_atual) : 0,
      estoque_minimo: formData.estoque_minimo ? parseFloat(formData.estoque_minimo) : null,
      preco_unitario: formData.preco_unitario ? parseFloat(formData.preco_unitario) : null,
      tamanho_embalagem: formData.tamanho_embalagem ? parseFloat(formData.tamanho_embalagem) : 1
    };

    if (editingInsumo) updateMutation.mutate({ id: editingInsumo.id, data: payload });
    else createMutation.mutate(payload);
  };

  const insumosFiltrados = insumos.filter(insumo => {
    const matchBusca = insumo.nome.toLowerCase().includes(searchTerm.toLowerCase());
    const matchCat = filtroCategoria === 'todos' || insumo.categoria === filtroCategoria;
    return matchBusca && matchCat;
  });

  const insumosBaixoEstoque = insumos.filter(i => i.estoque_minimo && i.estoque_atual <= i.estoque_minimo).length;
  const valorTotalEstoque = insumos.reduce((acc, i) => acc + (i.estoque_atual * (i.preco_unitario || 0)), 0);

  return (
    <div className="space-y-6">
      <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-4 bg-white p-4 rounded-[1.5rem] border border-stone-100 shadow-sm">
        <div>
          <h1 className="text-2xl font-bold text-stone-900 tracking-tight">Estoque de Insumos</h1>
          <p className="text-stone-500 font-medium">Controle de produtos e materiais</p>
        </div>
        
        <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild><Button className="bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl h-10 px-5 shadow-lg shadow-emerald-100 transition-all active:scale-95 ml-2"><Plus className="w-4 h-4 mr-2" /> Novo Insumo</Button></DialogTrigger>
            <DialogContent className="sm:max-w-md max-h-[90vh] overflow-y-auto rounded-[2rem]">
                <DialogHeader><DialogTitle>{editingInsumo ? 'Editar Insumo' : 'Novo Insumo'}</DialogTitle><DialogDescription>Preencha os dados do produto.</DialogDescription></DialogHeader>
                <form onSubmit={handleSubmit} className="space-y-4 pt-2">
                    <div className="space-y-2"><Label>Nome do Insumo</Label><Input value={formData.nome} onChange={(e) => setFormData({ ...formData, nome: e.target.value })} required className="rounded-xl" placeholder="Ex: Adubo NPK" /></div>
                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2"><Label>Categoria</Label><Select value={formData.categoria} onValueChange={(value) => setFormData({ ...formData, categoria: value })}><SelectTrigger className="rounded-xl"><SelectValue placeholder="Selecione" /></SelectTrigger><SelectContent><SelectItem value="fertilizante">Fertilizante</SelectItem><SelectItem value="defensivo">Defensivo</SelectItem><SelectItem value="adubo">Adubo</SelectItem><SelectItem value="semente">Semente</SelectItem><SelectItem value="ferramenta">Ferramenta</SelectItem><SelectItem value="outro">Outro</SelectItem></SelectContent></Select></div>
                        <div className="space-y-2"><Label>Unidade de Medida</Label><Select value={formData.unidade} onValueChange={(value) => setFormData({ ...formData, unidade: value })}><SelectTrigger className="rounded-xl"><SelectValue placeholder="Selecione" /></SelectTrigger><SelectContent><SelectItem value="kg">Quilograma (kg)</SelectItem><SelectItem value="L">Litro (L)</SelectItem><SelectItem value="g">Grama (g)</SelectItem><SelectItem value="ml">Mililitro (ml)</SelectItem><SelectItem value="un">Unidade (un)</SelectItem></SelectContent></Select></div>
                    </div>
                    
                    <div className="p-4 bg-stone-50 rounded-xl space-y-4 border border-stone-100">
                        <Label className="text-stone-700 font-bold text-sm block border-b border-stone-200 pb-2">Informações de Compra (Por Embalagem)</Label>
                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label className="text-xs">Preço da Embalagem</Label>
                                <Input type="number" step="0.01" value={formData.preco_unitario} onChange={(e) => setFormData({ ...formData, preco_unitario: e.target.value })} className="rounded-xl bg-white" placeholder="R$" />
                            </div>
                            <div className="space-y-2">
                                <Label className="text-xs">Tamanho Emb. (kg/L)</Label>
                                <Input type="number" step="0.01" value={formData.tamanho_embalagem} onChange={(e) => setFormData({ ...formData, tamanho_embalagem: e.target.value })} className="rounded-xl bg-white" placeholder="Ex: 25" />
                                <p className="text-[10px] text-stone-500">Qtd que vem em 1 unidade de compra.</p>
                            </div>
                        </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2"><Label>Estoque Atual</Label><Input type="number" step="0.01" value={formData.estoque_atual} onChange={(e) => setFormData({ ...formData, estoque_atual: e.target.value })} className="rounded-xl" /></div>
                        <div className="space-y-2"><Label>Estoque Mínimo</Label><Input type="number" step="0.01" value={formData.estoque_minimo} onChange={(e) => setFormData({ ...formData, estoque_minimo: e.target.value })} className="rounded-xl" /></div>
                    </div>
                    <div className="space-y-2"><Label>Observações</Label><Textarea value={formData.observacoes} onChange={(e) => setFormData({ ...formData, observacoes: e.target.value })} rows={2} className="rounded-xl" /></div>
                    <div className="flex justify-end gap-3 pt-2"><Button type="button" variant="outline" onClick={resetForm} className="rounded-xl">Cancelar</Button><Button type="submit" className="bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl px-6">Salvar</Button></div>
                </form>
            </DialogContent>
        </Dialog>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <StatCard title="Total de Insumos" value={insumos.length} icon={Package} color="text-blue-600" />
        <StatCard title="Estoque Baixo" value={insumosBaixoEstoque} icon={AlertTriangle} color={insumosBaixoEstoque > 0 ? "text-red-600" : "text-emerald-600"} />
        <StatCard title="Valor em Estoque" value={`R$ ${valorTotalEstoque.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`} icon={Archive} color="text-stone-600" />
      </div>

      <Card className="border-stone-100 rounded-[2rem] shadow-sm">
        <CardContent className="pt-6 pb-6">
            <div className="flex flex-wrap items-center gap-4">
                <div className="relative flex-1 min-w-[200px]">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-stone-400" />
                    <Input placeholder="Buscar insumo..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="pl-9 rounded-xl bg-stone-50 border-stone-200" />
                </div>
                <Select value={filtroCategoria} onValueChange={setFiltroCategoria}>
                    <SelectTrigger className="w-48 rounded-xl bg-stone-50 border-stone-200"><SelectValue placeholder="Categoria" /></SelectTrigger>
                    <SelectContent>
                        <SelectItem value="todos">Todas Categorias</SelectItem>
                        {Object.entries(categoriaLabels).map(([key, { label }]) => (<SelectItem key={key} value={key}>{label}</SelectItem>))}
                    </SelectContent>
                </Select>
            </div>
        </CardContent>
      </Card>

      {insumosFiltrados.length === 0 ? (
        <EmptyState icon={Package} title="Nenhum insumo encontrado" description="Adicione insumos para controlar o estoque." actionLabel="Novo Insumo" onAction={() => setOpen(true)} />
      ) : (
        <Card className="border-stone-100 rounded-[2rem] shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
            <Table>
                <TableHeader className="bg-stone-50">
                <TableRow>
                    <TableHead className="pl-6">Produto</TableHead>
                    <TableHead>Categoria</TableHead>
                    <TableHead className="text-right">Preço Ref. (Emb.)</TableHead>
                    <TableHead className="text-right">Estoque</TableHead>
                    <TableHead className="text-right pr-6 w-[120px]">Ações</TableHead>
                </TableRow>
                </TableHeader>
                <TableBody>
                {insumosFiltrados.map((insumo) => {
                    const isBaixo = insumo.estoque_minimo && insumo.estoque_atual <= insumo.estoque_minimo;
                    return (
                    <TableRow key={insumo.id} className="hover:bg-stone-50 transition-colors">
                        <TableCell className="pl-6 font-bold text-stone-700">
                            {insumo.nome}
                            {insumo.tamanho_embalagem && <div className="text-[10px] text-stone-400 font-normal">Emb: {insumo.tamanho_embalagem} {insumo.unidade}</div>}
                        </TableCell>
                        <TableCell><Badge className={categoriaLabels[insumo.categoria]?.color + ' border'}>{categoriaLabels[insumo.categoria]?.label || insumo.categoria}</Badge></TableCell>
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