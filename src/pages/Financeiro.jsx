import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabaseClient';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogDescription } from '@/components/ui/dialog';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Switch } from '@/components/ui/switch';
import { Plus, Edit, Trash2, DollarSign, TrendingUp, TrendingDown, Filter, Wallet, Clock, CheckCircle2 } from 'lucide-react';
import EmptyState from '@/components/ui/EmptyState';
import StatCard from '@/components/ui/StatCard';
import { format } from 'date-fns';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend } from 'recharts';

const categoriaLabels = {
  funcionario: { label: 'Funcionário', color: 'bg-blue-100 text-blue-700' },
  insumo: { label: 'Insumo', color: 'bg-green-100 text-green-700' },
  manutencao: { label: 'Manutenção', color: 'bg-amber-100 text-amber-700' },
  energia: { label: 'Energia', color: 'bg-yellow-100 text-yellow-700' },
  agua: { label: 'Água', color: 'bg-cyan-100 text-cyan-700' },
  combustivel: { label: 'Combustível', color: 'bg-orange-100 text-orange-700' },
  terceirizado: { label: 'Terceirizado', color: 'bg-purple-100 text-purple-700' },
  equipamento: { label: 'Equipamento', color: 'bg-indigo-100 text-indigo-700' },
  administrativo: { label: 'Administrativo', color: 'bg-pink-100 text-pink-700' },
  outro: { label: 'Outro', color: 'bg-stone-100 text-stone-700' }
};

const COLORS = ['#10b981', '#3b82f6', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#06b6d4', '#f97316', '#84cc16', '#6b7280'];

export default function Financeiro({ showMessage }) {
  const [open, setOpen] = useState(false);
  const [editingCusto, setEditingCusto] = useState(null);
  const [filtroTalhao, setFiltroTalhao] = useState('todos');
  const [filtroCategoria, setFiltroCategoria] = useState('todos');
  
  const [formData, setFormData] = useState({
    descricao: '',
    categoria: 'outro',
    talhao_id: '',
    valor: '',
    data: format(new Date(), 'yyyy-MM-dd'),
    status_pagamento: 'pago',
    tipo_lancamento: 'despesa',
    recorrente: false,
    frequencia: 'unico',
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

  const { data: custos = [] } = useQuery({
    queryKey: ['custos'],
    queryFn: async () => {
      const { data, error } = await supabase.from('custos').select('*').order('data', { ascending: false });
      if (error) throw error;
      return data;
    }
  });

  const { data: colheitas = [] } = useQuery({
    queryKey: ['colheitas'],
    queryFn: async () => {
      const { data, error } = await supabase.from('colheitas').select('*');
      if (error) throw error;
      return data;
    }
  });

  const saveMutation = useMutation({
    mutationFn: async (data) => {
      if (editingCusto) {
        return await supabase.from('custos').update(data).eq('id', editingCusto.id);
      }
      return await supabase.from('custos').insert([data]);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['custos'] });
      if (showMessage) showMessage(editingCusto ? "Lançamento atualizado" : "Lançamento realizado com sucesso!");
      resetForm();
    }
  });

  const deleteMutation = useMutation({
    mutationFn: async (id) => {
      await supabase.from('custos').delete().eq('id', id);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['custos'] });
      if (showMessage) showMessage("Lançamento excluído", "error");
    }
  });

  const resetForm = () => {
    setFormData({
      descricao: '', categoria: 'outro', talhao_id: '', valor: '',
      data: format(new Date(), 'yyyy-MM-dd'), status_pagamento: 'pago',
      tipo_lancamento: 'despesa', recorrente: false, frequencia: 'unico', observacoes: ''
    });
    setEditingCusto(null);
    setOpen(false);
  };

  const handleEdit = (custo) => {
    setEditingCusto(custo);
    setFormData({
      descricao: custo.descricao || '',
      categoria: custo.categoria || 'outro',
      talhao_id: custo.talhao_id || '',
      valor: custo.valor || '',
      data: custo.data || '',
      status_pagamento: custo.status_pagamento || 'pago',
      tipo_lancamento: custo.tipo_lancamento || 'despesa',
      recorrente: custo.recorrente || false,
      frequencia: custo.frequencia || 'unico',
      observacoes: custo.observacoes || ''
    });
    setOpen(true);
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    const data = {
      ...formData,
      valor: parseFloat(formData.valor) || 0,
      talhao_id: (formData.talhao_id === "" || formData.talhao_id === "null") ? null : formData.talhao_id
    };
    saveMutation.mutate(data);
  };

  const custosFiltrados = custos.filter(c => {
    if (filtroTalhao !== 'todos' && c.talhao_id !== filtroTalhao) return false;
    if (filtroCategoria !== 'todos' && c.categoria !== filtroCategoria) return false;
    return true;
  });

  const totalPago = custosFiltrados.filter(c => c.status_pagamento === 'pago').reduce((acc, c) => acc + (c.valor || 0), 0);
  const totalPendente = custosFiltrados.filter(c => c.status_pagamento === 'pendente').reduce((acc, c) => acc + (c.valor || 0), 0);
  const totalReceitasColheita = colheitas.reduce((acc, c) => acc + (c.valor_total || 0), 0);
  const saldoAtual = totalReceitasColheita - totalPago;

  const pieData = Object.entries(
    custosFiltrados.reduce((acc, c) => {
      const cat = categoriaLabels[c.categoria]?.label || 'Outro';
      acc[cat] = (acc[cat] || 0) + (c.valor || 0);
      return acc;
    }, {})
  ).map(([name, value]) => ({ name, value }));

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-stone-900">Financeiro</h1>
          <p className="text-stone-500">Gestão de fluxo de caixa e compromissos</p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button className="bg-red-600 hover:bg-red-700 rounded-xl">
              <Plus className="w-4 h-4 mr-2" /> Novo Lançamento
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-lg rounded-[2rem]">
            <DialogHeader>
              <DialogTitle>{editingCusto ? 'Editar Lançamento' : 'Novo Lançamento'}</DialogTitle>
              {/* Adicionado DialogDescription para corrigir o aviso do Radix UI */}
              <DialogDescription>
                Informe os detalhes do lançamento para controle do fluxo de caixa.
              </DialogDescription>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4 pt-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Tipo</Label>
                  <Select value={formData.tipo_lancamento} onValueChange={(v) => setFormData({...formData, tipo_lancamento: v})}>
                    <SelectTrigger className="rounded-xl"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="despesa">Despesa (Saída)</SelectItem>
                      <SelectItem value="receita">Receita (Entrada)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Status</Label>
                  <Select value={formData.status_pagamento} onValueChange={(v) => setFormData({...formData, status_pagamento: v})}>
                    <SelectTrigger className="rounded-xl"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="pago">Pago / Recebido</SelectItem>
                      <SelectItem value="pendente">Pendente / Agendado</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="space-y-2">
                <Label>Descrição</Label>
                <Input value={formData.descricao} onChange={(e) => setFormData({...formData, descricao: e.target.value})} placeholder="Descrição" required className="rounded-xl" />
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
                  <Label>Valor (R$)</Label>
                  <Input type="number" step="0.01" value={formData.valor} onChange={(e) => setFormData({...formData, valor: e.target.value})} placeholder="0,00" required className="rounded-xl" />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Data</Label>
                  <Input type="date" value={formData.data} onChange={(e) => setFormData({...formData, data: e.target.value})} required className="rounded-xl" />
                </div>
                <div className="space-y-2">
                  <Label>Talhão</Label>
                  <Select value={formData.talhao_id || "null"} onValueChange={(v) => setFormData({...formData, talhao_id: v})}>
                    <SelectTrigger className="rounded-xl"><SelectValue placeholder="Geral" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="null">Custo Geral / Sede</SelectItem>
                      {talhoes.map(t => <SelectItem key={t.id} value={t.id}>{t.nome}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="flex justify-end gap-3 pt-4">
                <Button type="button" variant="outline" onClick={resetForm} className="rounded-xl">Cancelar</Button>
                <Button type="submit" className="bg-red-600 hover:bg-red-700 rounded-xl px-8" disabled={saveMutation.isPending}>
                  {editingCusto ? 'Salvar' : 'Lançar'}
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard title="Saldo em Caixa" value={`R$ ${saldoAtual.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`} icon={Wallet} color="text-emerald-600" />
        <StatCard title="Receitas (Colheita)" value={`R$ ${totalReceitasColheita.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`} icon={TrendingUp} color="text-blue-600" />
        <StatCard title="Total Pago" value={`R$ ${totalPago.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`} icon={TrendingDown} color="text-red-600" />
        <StatCard title="Contas a Pagar" value={`R$ ${totalPendente.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`} icon={Clock} color="text-amber-600" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card className="border-stone-100 rounded-[2rem] shadow-sm">
          <CardHeader><CardTitle className="text-lg">Despesas por Categoria</CardTitle></CardHeader>
          <CardContent>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={pieData} innerRadius={60} outerRadius={80} paddingAngle={5} dataKey="value">
                    {pieData.map((entry, index) => <Cell key={index} fill={COLORS[index % COLORS.length]} />)}
                  </Pie>
                  <Tooltip formatter={(v) => `R$ ${v.toLocaleString('pt-BR')}`} />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        <Card className="border-stone-100 rounded-[2rem] shadow-sm overflow-hidden">
          <CardHeader><CardTitle className="text-lg">Últimos Lançamentos</CardTitle></CardHeader>
          <Table>
            <TableHeader className="bg-stone-50">
              <TableRow>
                <TableHead className="pl-6">Data</TableHead>
                <TableHead>Descrição</TableHead>
                <TableHead>Valor</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right pr-6">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {custosFiltrados.slice(0, 5).map((custo) => (
                <TableRow key={custo.id} className="hover:bg-stone-50 transition-colors">
                  <TableCell className="pl-6">{format(new Date(custo.data + 'T12:00:00'), 'dd/MM/yy')}</TableCell>
                  <TableCell>
                    <div className="font-medium text-stone-800">{custo.descricao}</div>
                    <div className="text-[10px] text-stone-400 uppercase">{categoriaLabels[custo.categoria]?.label}</div>
                  </TableCell>
                  <TableCell className="font-bold text-red-600">R$ {custo.valor?.toLocaleString('pt-BR')}</TableCell>
                  <TableCell>
                    <Badge className={custo.status_pagamento === 'pago' ? "bg-emerald-50 text-emerald-700 border-emerald-100" : "bg-amber-50 text-amber-700 border-amber-100"}>
                      {custo.status_pagamento === 'pago' ? 'PAGO' : 'PENDENTE'}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right pr-6">
                    <div className="flex justify-end gap-1">
                      <Button variant="ghost" size="sm" onClick={() => handleEdit(custo)}><Edit className="w-4 h-4" /></Button>
                      <Button variant="ghost" size="sm" className="text-red-400" onClick={() => deleteMutation.mutate(custo.id)}><Trash2 className="w-4 h-4" /></Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>
      </div>
    </div>
  );
}