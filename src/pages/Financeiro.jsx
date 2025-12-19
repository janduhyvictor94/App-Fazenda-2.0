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
import { Plus, Edit, Trash2, DollarSign, TrendingUp, TrendingDown, Filter, Wallet } from 'lucide-react';
import EmptyState from '@/components/ui/EmptyState';
import StatCard from '@/components/ui/StatCard';
import { format } from 'date-fns';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend } from 'recharts';

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

export default function Financeiro() {
  const [open, setOpen] = useState(false);
  const [editingCusto, setEditingCusto] = useState(null);
  const [filtroTalhao, setFiltroTalhao] = useState('todos');
  const [filtroCategoria, setFiltroCategoria] = useState('todos');
  const [dataInicio, setDataInicio] = useState('');
  const [dataFim, setDataFim] = useState('');
  const [formData, setFormData] = useState({
    descricao: '',
    categoria: '',
    talhao_id: '',
    valor: '',
    data: format(new Date(), 'yyyy-MM-dd'),
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

  const { data: funcionarios = [] } = useQuery({
    queryKey: ['funcionarios'],
    queryFn: async () => {
      const { data, error } = await supabase.from('funcionarios').select('*');
      if (error) throw error;
      return data;
    }
  });

  const createMutation = useMutation({
    mutationFn: async (data) => {
      const { data: result, error } = await supabase.from('custos').insert(data).select();
      if (error) throw error;
      return result;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['custos'] });
      resetForm();
    }
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }) => {
      const { data: result, error } = await supabase.from('custos').update(data).eq('id', id).select();
      if (error) throw error;
      return result;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['custos'] });
      resetForm();
    }
  });

  const deleteMutation = useMutation({
    mutationFn: async (id) => {
      const { error } = await supabase.from('custos').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['custos'] });
    }
  });

  const resetForm = () => {
    setFormData({
      descricao: '',
      categoria: '',
      talhao_id: '',
      valor: '',
      data: format(new Date(), 'yyyy-MM-dd'),
      recorrente: false,
      frequencia: 'unico',
      observacoes: ''
    });
    setEditingCusto(null);
    setOpen(false);
  };

  const handleEdit = (custo) => {
    setEditingCusto(custo);
    setFormData({
      descricao: custo.descricao || '',
      categoria: custo.categoria || '',
      talhao_id: custo.talhao_id || '',
      valor: custo.valor || '',
      data: custo.data || '',
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
      valor: formData.valor ? parseFloat(formData.valor) : 0,
      talhao_id: (formData.talhao_id === "" || formData.talhao_id === "null") ? null : formData.talhao_id
    };

    if (editingCusto) {
      updateMutation.mutate({ id: editingCusto.id, data });
    } else {
      createMutation.mutate(data);
    }
  };

  const custosFiltrados = custos.filter(c => {
    if (filtroTalhao !== 'todos' && c.talhao_id !== filtroTalhao && filtroTalhao !== 'geral') return false;
    if (filtroTalhao === 'geral' && c.talhao_id) return false;
    if (filtroCategoria !== 'todos' && c.categoria !== filtroCategoria) return false;
    
    if (dataInicio && c.data) {
      const dataCusto = new Date(c.data);
      const dataInicioDate = new Date(dataInicio);
      if (dataCusto < dataInicioDate) return false;
    }
    if (dataFim && c.data) {
      const dataCusto = new Date(c.data);
      const dataFimDate = new Date(dataFim);
      if (dataCusto > dataFimDate) return false;
    }
    
    return true;
  });

  const totalCustos = custosFiltrados.reduce((acc, c) => acc + (c.valor || 0), 0);
  const totalReceitas = colheitas.reduce((acc, c) => acc + (c.valor_total || 0), 0);
  const lucro = totalReceitas - custos.reduce((acc, c) => acc + (c.valor || 0), 0);
  const salariosMensais = funcionarios.filter(f => f.status === 'ativo').reduce((acc, f) => acc + (f.salario || 0), 0);

  const custoPorCategoria = custosFiltrados.reduce((acc, c) => {
    const cat = categoriaLabels[c.categoria]?.label || 'Outro';
    acc[cat] = (acc[cat] || 0) + (c.valor || 0);
    return acc;
  }, {});

  const pieData = Object.entries(custoPorCategoria).map(([name, value]) => ({ name, value }));

  const custoPorTalhaoData = custos.reduce((acc, c) => {
    const talhaoNome = c.talhao_id ? (talhoes.find(t => t.id === c.talhao_id)?.nome || 'Desconhecido') : 'Geral';
    acc[talhaoNome] = (acc[talhaoNome] || 0) + (c.valor || 0);
    return acc;
  }, {});

  const barData = Object.entries(custoPorTalhaoData).map(([name, value]) => ({ name, valor: value }));

  const getTalhaoNome = (id) => talhoes.find(t => t.id === id)?.nome || 'Geral';

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-stone-900">Financeiro</h1>
          <p className="text-stone-500">Controle de custos e receitas</p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button className="bg-red-600 hover:bg-red-700">
              <Plus className="w-4 h-4 mr-2" />
              Lançar Custo
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-lg">
            <DialogHeader>
              <DialogTitle>{editingCusto ? 'Editar Custo' : 'Novo Custo'}</DialogTitle>
              <DialogDescription className="sr-only">
                Registre os dados financeiros e a categoria da despesa.
              </DialogDescription>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label>Descrição</Label>
                <Input
                  value={formData.descricao || ""}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  placeholder="Descrição do custo"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Categoria</Label>
                  <Select
                    value={formData.categoria || ""}
                    onValueChange={(value) => setFormData({ ...formData, categoria: value })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione" />
                    </SelectTrigger>
                    <SelectContent>
                      {Object.entries(categoriaLabels).map(([key, { label }]) => (
                        <SelectItem key={key} value={key}>{label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Talhão (opcional)</Label>
                  <Select
                    value={formData.talhao_id || "null"}
                    onValueChange={(value) => setFormData({ ...formData, talhao_id: value })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Geral" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="null">Custo Geral</SelectItem>
                      {talhoes.map((t) => (
                        <SelectItem key={t.id} value={t.id}>{t.nome}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Valor</Label>
                  <Input
                    type="number"
                    step="0.01"
                    value={formData.valor || ""}
                    onChange={(e) => setFormData({ ...formData, valor: e.target.value })}
                    placeholder="R$ 0,00"
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label>Data</Label>
                  <Input
                    type="date"
                    value={formData.data || ""}
                    onChange={(e) => setFormData({ ...formData, data: e.target.value })}
                    required
                  />
                </div>
              </div>

              <div className="p-4 bg-stone-50 rounded-xl space-y-4">
                <div className="flex items-center justify-between">
                  <Label className="text-base">Custo Recorrente</Label>
                  <Switch
                    checked={formData.recorrente}
                    onCheckedChange={(checked) => setFormData({ ...formData, recorrente: checked })}
                  />
                </div>
                {formData.recorrente && (
                  <div className="space-y-2">
                    <Label>Frequência</Label>
                    <Select
                      value={formData.frequencia || ""}
                      onValueChange={(value) => setFormData({ ...formData, frequencia: value })}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="semanal">Semanal</SelectItem>
                        <SelectItem value="mensal">Mensal</SelectItem>
                        <SelectItem value="anual">Anual</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                )}
              </div>

              <div className="space-y-2">
                <Label>Observações</Label>
                <Textarea
                  value={formData.observacoes || ""}
                  onChange={(e) => setFormData({ ...formData, observacoes: e.target.value })}
                  placeholder="Observações..."
                  rows={2}
                />
              </div>

              <div className="flex justify-end gap-3 pt-4">
                <Button type="button" variant="outline" onClick={resetForm}>
                  Cancelar
                </Button>
                <Button 
                  type="submit" 
                  className="bg-red-600 hover:bg-red-700"
                  disabled={createMutation.isPending || updateMutation.isPending}
                >
                  {editingCusto ? 'Salvar' : 'Lançar'}
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          title="Receita Total"
          value={`R$ ${totalReceitas.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`}
          icon={TrendingUp}
          iconBg="bg-emerald-50"
          iconColor="text-emerald-600"
        />
        <StatCard
          title="Custos Totais"
          value={`R$ ${custos.reduce((acc, c) => acc + (c.valor || 0), 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`}
          icon={TrendingDown}
          iconBg="bg-red-50"
          iconColor="text-red-600"
        />
        <StatCard
          title="Lucro/Prejuízo"
          value={`R$ ${lucro.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`}
          icon={Wallet}
          iconBg={lucro >= 0 ? "bg-emerald-50" : "bg-red-50"}
          iconColor={lucro >= 0 ? "text-emerald-600" : "text-red-600"}
        />
        <StatCard
          title="Folha Mensal"
          value={`R$ ${salariosMensais.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`}
          subtitle="Funcionários ativos"
          icon={DollarSign}
          iconBg="bg-blue-50"
          iconColor="text-blue-600"
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card className="border-stone-100">
          <CardHeader>
            <CardTitle className="text-lg">Custos por Categoria</CardTitle>
          </CardHeader>
          <CardContent>
            {pieData.length > 0 ? (
              <ResponsiveContainer width="100%" height={250}>
                <PieChart>
                  <Pie data={pieData} cx="50%" cy="50%" innerRadius={50} outerRadius={90} paddingAngle={2} dataKey="value">
                    {pieData.map((entry, index) => <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />)}
                  </Pie>
                  <Tooltip formatter={(value) => [`R$ ${value.toLocaleString('pt-BR')}`, 'Valor']} />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            ) : <div className="h-64 flex items-center justify-center text-stone-400">Nenhum custo registrado</div>}
          </CardContent>
        </Card>

        <Card className="border-stone-100">
          <CardHeader>
            <CardTitle className="text-lg">Custos por Talhão</CardTitle>
          </CardHeader>
          <CardContent>
            {barData.length > 0 ? (
              <ResponsiveContainer width="100%" height={250}>
                <BarChart data={barData}>
                  <XAxis dataKey="name" />
                  <YAxis />
                  <Tooltip formatter={(value) => [`R$ ${value.toLocaleString('pt-BR')}`, 'Custo']} />
                  <Bar dataKey="valor" fill="#ef4444" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            ) : <div className="h-64 flex items-center justify-center text-stone-400">Nenhum custo registrado</div>}
          </CardContent>
        </Card>
      </div>

      <Card className="border-stone-100">
        <CardContent className="pt-4">
          <div className="flex flex-wrap items-center gap-4">
            <div className="flex items-center gap-2"><Filter className="w-4 h-4 text-stone-400" /><span className="text-sm font-medium text-stone-600">Filtros:</span></div>
            <Select value={filtroTalhao || "todos"} onValueChange={setFiltroTalhao}>
              <SelectTrigger className="w-40"><SelectValue placeholder="Talhão" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todos</SelectItem>
                <SelectItem value="geral">Custos Gerais</SelectItem>
                {talhoes.map((t) => <SelectItem key={t.id} value={t.id}>{t.nome}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={filtroCategoria || "todos"} onValueChange={setFiltroCategoria}>
              <SelectTrigger className="w-40"><SelectValue placeholder="Categoria" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todas</SelectItem>
                {Object.entries(categoriaLabels).map(([key, { label }]) => <SelectItem key={key} value={key}>{label}</SelectItem>)}
              </SelectContent>
            </Select>
            <div className="flex items-center gap-2"><Label className="text-sm text-stone-600">De:</Label><Input type="date" value={dataInicio || ""} onChange={(e) => setDataInicio(e.target.value)} min="2020-01-01" max="2040-12-31" className="w-36" /></div>
            <div className="flex items-center gap-2"><Label className="text-sm text-stone-600">Até:</Label><Input type="date" value={dataFim || ""} onChange={(e) => setDataFim(e.target.value)} min="2020-01-01" max="2040-12-31" className="w-36" /></div>
          </div>
        </CardContent>
      </Card>

      {custosFiltrados.length === 0 ? <EmptyState icon={DollarSign} title="Nenhum custo registrado" description="Lance seus custos para ter controle financeiro completo." actionLabel="Lançar Custo" onAction={() => setOpen(true)} /> : (
        <Card className="border-stone-100 overflow-hidden">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="bg-stone-50">
                  <TableHead>Data</TableHead><TableHead>Descrição</TableHead><TableHead>Categoria</TableHead><TableHead>Talhão</TableHead><TableHead className="text-right">Valor</TableHead><TableHead className="w-24"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {custosFiltrados.map((custo) => (
                  <TableRow key={custo.id} className="hover:bg-stone-50">
                    <TableCell>{custo.data ? format(new Date(custo.data), 'dd/MM/yyyy') : '-'}</TableCell>
                    <TableCell className="font-medium">{custo.descricao}{custo.recorrente && <Badge variant="outline" className="ml-2 text-xs">{custo.frequencia}</Badge>}</TableCell>
                    <TableCell><Badge className={categoriaLabels[custo.categoria]?.color}>{categoriaLabels[custo.categoria]?.label || custo.categoria}</Badge></TableCell>
                    <TableCell>{getTalhaoNome(custo.talhao_id)}</TableCell>
                    <TableCell className="text-right font-medium text-red-600">R$ {(custo.valor || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</TableCell>
                    <TableCell>
                      <div className="flex items-center justify-end gap-1">
                        <Button variant="ghost" size="sm" onClick={() => handleEdit(custo)}><Edit className="w-4 h-4" /></Button>
                        <Button variant="ghost" size="sm" className="text-red-600 hover:text-red-700 hover:bg-red-50" onClick={() => deleteMutation.mutate(custo.id)}><Trash2 className="w-4 h-4" /></Button>
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