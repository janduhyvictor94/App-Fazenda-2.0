import React, { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabaseClient';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogDescription } from '@/components/ui/dialog';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Plus, Edit, Trash2, TrendingUp, TrendingDown, Wallet, Clock, ChevronDown, ChevronRight, Users, Filter, CalendarDays, Search } from 'lucide-react';
import StatCard from '@/components/ui/StatCard';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
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

const mesesDoAno = [
  { value: '01', label: 'Janeiro' }, { value: '02', label: 'Fevereiro' },
  { value: '03', label: 'Março' }, { value: '04', label: 'Abril' },
  { value: '05', label: 'Maio' }, { value: '06', label: 'Junho' },
  { value: '07', label: 'Julho' }, { value: '08', label: 'Agosto' },
  { value: '09', label: 'Setembro' }, { value: '10', label: 'Outubro' },
  { value: '11', label: 'Novembro' }, { value: '12', label: 'Dezembro' }
];

const COLORS = ['#10b981', '#3b82f6', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#06b6d4', '#f97316', '#84cc16', '#6b7280'];

export default function Financeiro({ showMessage }) {
  const [open, setOpen] = useState(false);
  const [editingCusto, setEditingCusto] = useState(null);
  const [filtroTalhao, setFiltroTalhao] = useState('todos');
  const [filtroCategoria, setFiltroCategoria] = useState('todos');
  
  // ESTADOS PARA FILTRO DE MÊS/ANO
  const [tipoFiltroData, setTipoFiltroData] = useState('geral'); 
  const [filtroMes, setFiltroMes] = useState(format(new Date(), 'MM'));
  const [filtroAno, setFiltroAno] = useState(format(new Date(), 'yyyy'));

  const [expandedGroups, setExpandedGroups] = useState({});

  const [formData, setFormData] = useState({
    descricao: '',
    categoria: 'outro',
    talhao_id: '',
    valor: '',
    data: format(new Date(), 'yyyy-MM-dd'),
    status_pagamento: 'pago',
    tipo_lancamento: 'despesa',
    observacoes: ''
  });

  const queryClient = useQueryClient();

  // --- QUERIES ---
  const { data: talhoes = [] } = useQuery({
    queryKey: ['talhoes'],
    queryFn: async () => {
      const { data, error } = await supabase.from('talhoes').select('*');
      if (error) throw error;
      return data;
    }
  });

  const { data: custosBrutos = [] } = useQuery({
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

  // --- LÓGICA DE DADOS (Preservada) ---
  const anosDisponiveis = useMemo(() => {
    const anoAtual = new Date().getFullYear();
    const anos = new Set();
    for (let i = anoAtual; i <= 2030; i++) anos.add(i);
    custosBrutos.forEach(c => { if (c.data) anos.add(parseInt(c.data.split('-')[0])); });
    return Array.from(anos).sort((a, b) => b - a); 
  }, [custosBrutos]);

  const custos = useMemo(() => {
    return custosBrutos.map(c => {
      let status = c.status_pagamento;
      let tipo = c.tipo_lancamento;
      
      // Fallback legado
      if (!status && c.observacoes) {
        if (c.observacoes.includes('[S:PG]')) status = 'pago';
        else if (c.observacoes.includes('[S:PD]')) status = 'pendente';
      }
      if (!tipo && c.observacoes) {
        if (c.observacoes.includes('[T:REC]')) tipo = 'receita';
        else tipo = 'despesa';
      }

      let obsLimpa = c.observacoes || '';
      obsLimpa = obsLimpa.replace('[S:PG]', '').replace('[S:PD]', '').replace('[T:REC]', '').replace('[T:DESP]', '').trim();

      return { 
          ...c, 
          status_pagamento: status || 'pendente',
          tipo_lancamento: tipo || 'despesa', 
          observacoes_exibicao: obsLimpa 
      };
    });
  }, [custosBrutos]);

  // --- MUTATIONS ---
  const saveMutation = useMutation({
    mutationFn: async (data) => {
      const cleanData = Object.fromEntries(Object.entries(data).filter(([_, v]) => v !== undefined));
      if (editingCusto) {
        const { data: result, error } = await supabase.from('custos').update(cleanData).eq('id', editingCusto.id).select();
        if (error) throw error; return result;
      }
      const { data: result, error } = await supabase.from('custos').insert([cleanData]).select();
      if (error) throw error; return result;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['custos'] });
      if (showMessage) showMessage(editingCusto ? "Lançamento atualizado" : "Lançamento realizado com sucesso!");
      resetForm();
    },
    onError: (error) => {
      console.error("Erro:", error);
      if (showMessage) showMessage(`Erro: ${error.message}`, "error");
    }
  });

  const deleteMutation = useMutation({
    mutationFn: async (id) => { await supabase.from('custos').delete().eq('id', id); },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['custos'] });
      if (showMessage) showMessage("Lançamento excluído", "error");
    }
  });

  // --- HANDLERS ---
  const resetForm = () => {
    setFormData({
      descricao: '', categoria: 'outro', talhao_id: '', valor: '',
      data: format(new Date(), 'yyyy-MM-dd'), status_pagamento: 'pago',
      tipo_lancamento: 'despesa', observacoes: ''
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
      observacoes: custo.observacoes_exibicao || ''
    });
    setOpen(true);
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    let talhaoIdProcessado = formData.talhao_id;
    if (!talhaoIdProcessado || talhaoIdProcessado === "null" || talhaoIdProcessado === "undefined") talhaoIdProcessado = null;
    let dataProcessada = formData.data || new Date().toISOString().split('T')[0];

    const dataToSave = {
      descricao: formData.descricao,
      categoria: formData.categoria,
      talhao_id: talhaoIdProcessado,
      valor: parseFloat(formData.valor) || 0,
      data: dataProcessada,
      observacoes: formData.observacoes,
      status_pagamento: formData.status_pagamento,
      tipo_lancamento: formData.tipo_lancamento
    };
    saveMutation.mutate(dataToSave);
  };

  // --- FILTROS & VISUALIZAÇÃO ---
  const custosFiltrados = custos.filter(c => {
    if (filtroTalhao !== 'todos' && c.talhao_id !== filtroTalhao) return false;
    if (filtroCategoria !== 'todos' && c.categoria !== filtroCategoria) return false;
    if (tipoFiltroData === 'mensal') {
        const prefixo = `${filtroAno}-${filtroMes}`;
        return c.data.startsWith(prefixo); 
    }
    return true;
  });

  const colheitasFiltradas = colheitas.filter(c => {
      if (tipoFiltroData === 'mensal') {
          const prefixo = `${filtroAno}-${filtroMes}`;
          return c.data && c.data.startsWith(prefixo);
      }
      return true;
  });

  const listaVisual = useMemo(() => {
    const agrupados = [];
    const mapMeses = {};

    custosFiltrados.forEach(custo => {
        if (custo.categoria === 'funcionario') {
            const mesAnoKey = custo.data.substring(0, 7);
            if (!mapMeses[mesAnoKey]) {
                const grupo = {
                    id: `group-${mesAnoKey}`,
                    isGroup: true,
                    dateKey: mesAnoKey,
                    data: custo.data,
                    descricao: `Folha de Pagamento - ${format(new Date(custo.data + 'T12:00:00'), 'MMMM/yyyy', { locale: ptBR })}`,
                    total: 0,
                    itens: []
                };
                mapMeses[mesAnoKey] = grupo;
                agrupados.push(grupo);
            }
            mapMeses[mesAnoKey].itens.push(custo);
            mapMeses[mesAnoKey].total += custo.valor || 0;
        } else {
            agrupados.push(custo);
        }
    });
    return agrupados.sort((a, b) => new Date(b.data) - new Date(a.data));
  }, [custosFiltrados]);

  const toggleGroup = (groupId) => {
    setExpandedGroups(prev => ({ ...prev, [groupId]: !prev[groupId] }));
  };

  // --- TOTAIS ---
  const totalDespesasPagas = custosFiltrados.filter(c => c.tipo_lancamento === 'despesa' && c.status_pagamento === 'pago').reduce((acc, c) => acc + (c.valor || 0), 0);
  const totalDespesasPendentes = custosFiltrados.filter(c => c.tipo_lancamento === 'despesa' && c.status_pagamento === 'pendente').reduce((acc, c) => acc + (c.valor || 0), 0);
  const totalReceitasExtras = custosFiltrados.filter(c => c.tipo_lancamento === 'receita').reduce((acc, c) => acc + (c.valor || 0), 0);
  const totalReceitasColheita = colheitasFiltradas.reduce((acc, c) => acc + (c.valor_total || 0), 0);
  const receitaTotalGeral = totalReceitasColheita + totalReceitasExtras;
  const saldoAtual = receitaTotalGeral - totalDespesasPagas;

  const pieData = Object.entries(
    custosFiltrados.filter(c => c.tipo_lancamento === 'despesa').reduce((acc, c) => {
        const cat = categoriaLabels[c.categoria]?.label || 'Outro';
        acc[cat] = (acc[cat] || 0) + (c.valor || 0);
        return acc;
      }, {})
  ).map(([name, value]) => ({ name, value })).sort((a,b) => b.value - a.value);

  return (
    <div className="space-y-6">
      {/* Header com Filtros Clean */}
      <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-4 bg-white p-4 rounded-[1.5rem] border border-stone-100 shadow-sm">
        <div>
          <h1 className="text-2xl font-bold text-stone-900 tracking-tight">Financeiro</h1>
          <p className="text-stone-500 font-medium">Gestão de caixa e lançamentos</p>
        </div>
        
        <div className="flex flex-wrap items-center gap-3">
            {/* Seletor de Período */}
            <div className="flex items-center gap-2 bg-stone-50 p-1 rounded-xl border border-stone-200">
                <button onClick={() => setTipoFiltroData('geral')} className={`px-3 py-1.5 rounded-lg text-sm font-bold transition-all ${tipoFiltroData === 'geral' ? 'bg-white shadow-sm text-stone-800' : 'text-stone-500 hover:text-stone-700'}`}>Geral</button>
                <button onClick={() => setTipoFiltroData('mensal')} className={`px-3 py-1.5 rounded-lg text-sm font-bold transition-all ${tipoFiltroData === 'mensal' ? 'bg-white shadow-sm text-stone-800' : 'text-stone-500 hover:text-stone-700'}`}>Mensal</button>
            </div>

            {tipoFiltroData === 'mensal' && (
                <div className="flex gap-2 animate-in fade-in slide-in-from-right-4 duration-300">
                    <Select value={filtroMes} onValueChange={setFiltroMes}>
                        <SelectTrigger className="w-32 h-10 rounded-xl border-stone-200"><SelectValue /></SelectTrigger>
                        <SelectContent className="max-h-60">
                            {mesesDoAno.map((m) => (<SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>))}
                        </SelectContent>
                    </Select>
                    <Select value={filtroAno} onValueChange={setFiltroAno}>
                        <SelectTrigger className="w-24 h-10 rounded-xl border-stone-200 font-bold"><SelectValue /></SelectTrigger>
                        <SelectContent>
                            {anosDisponiveis.map((ano) => (<SelectItem key={ano} value={ano.toString()}>{ano}</SelectItem>))}
                        </SelectContent>
                    </Select>
                </div>
            )}

            <Dialog open={open} onOpenChange={setOpen}>
                <DialogTrigger asChild>
                    <Button className="bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl h-10 px-5 shadow-lg shadow-emerald-100 transition-all active:scale-95 ml-2">
                    <Plus className="w-4 h-4 mr-2" /> Novo Lançamento
                    </Button>
                </DialogTrigger>
                <DialogContent className="sm:max-w-lg rounded-[2rem]">
                    <DialogHeader>
                    <DialogTitle>{editingCusto ? 'Editar Lançamento' : 'Novo Lançamento'}</DialogTitle>
                    <DialogDescription>Controle de entradas e saídas.</DialogDescription>
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
                        <Input value={formData.descricao} onChange={(e) => setFormData({...formData, descricao: e.target.value})} placeholder="Ex: Adubo, Energia..." required className="rounded-xl" />
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
                        <Label>Talhão (Opcional)</Label>
                        <Select value={formData.talhao_id || "null"} onValueChange={(v) => setFormData({...formData, talhao_id: v})}>
                            <SelectTrigger className="rounded-xl"><SelectValue placeholder="Geral" /></SelectTrigger>
                            <SelectContent>
                            <SelectItem value="null">Custo Geral / Sede</SelectItem>
                            {talhoes.map(t => <SelectItem key={t.id} value={t.id}>{t.nome}</SelectItem>)}
                            </SelectContent>
                        </Select>
                        </div>
                    </div>
                    <div className="space-y-2">
                        <Label>Observações</Label>
                        <Input value={formData.observacoes} onChange={(e) => setFormData({...formData, observacoes: e.target.value})} placeholder="Detalhes opcionais..." className="rounded-xl" />
                    </div>
                    <div className="flex justify-end gap-3 pt-4">
                        <Button type="button" variant="outline" onClick={resetForm} className="rounded-xl">Cancelar</Button>
                        <Button type="submit" className="bg-stone-900 hover:bg-stone-800 text-white rounded-xl px-8" disabled={saveMutation.isPending}>
                        {editingCusto ? 'Salvar' : 'Lançar'}
                        </Button>
                    </div>
                    </form>
                </DialogContent>
            </Dialog>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard title="Saldo em Caixa" value={`R$ ${saldoAtual.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`} icon={Wallet} color={saldoAtual >= 0 ? "text-emerald-600" : "text-red-600"} />
        <StatCard title="Receitas (Entradas)" value={`R$ ${receitaTotalGeral.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`} icon={TrendingUp} color="text-blue-600" />
        <StatCard title="Despesas (Pagas)" value={`R$ ${totalDespesasPagas.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`} icon={TrendingDown} color="text-red-600" />
        <StatCard title="Contas a Pagar" value={`R$ ${totalDespesasPendentes.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`} icon={Clock} color="text-amber-600" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Gráfico 1/3 */}
        <Card className="lg:col-span-1 border-stone-100 rounded-[2rem] shadow-sm flex flex-col">
          <CardHeader><CardTitle className="text-lg">Despesas por Categoria</CardTitle></CardHeader>
          <CardContent className="flex-1">
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={pieData} innerRadius={60} outerRadius={80} paddingAngle={5} dataKey="value">
                    {pieData.map((entry, index) => <Cell key={index} fill={COLORS[index % COLORS.length]} />)}
                  </Pie>
                  <Tooltip formatter={(v) => `R$ ${v.toLocaleString('pt-BR')}`} />
                  <Legend verticalAlign="bottom" height={36}/>
                </PieChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        {/* Tabela de Lançamentos 2/3 */}
        <Card className="lg:col-span-2 border-stone-100 rounded-[2rem] shadow-sm overflow-hidden flex flex-col">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-lg">Extrato de Lançamentos</CardTitle>
            <div className="flex gap-2">
                <Select value={filtroCategoria} onValueChange={setFiltroCategoria}>
                    <SelectTrigger className="w-36 h-8 text-xs rounded-lg border-stone-200"><SelectValue placeholder="Categoria" /></SelectTrigger>
                    <SelectContent>
                        <SelectItem value="todos">Todas</SelectItem>
                        {Object.entries(categoriaLabels).map(([k, v]) => <SelectItem key={k} value={k}>{v.label}</SelectItem>)}
                    </SelectContent>
                </Select>
            </div>
          </CardHeader>
          <div className="overflow-auto flex-1">
            <Table>
                <TableHeader className="bg-stone-50">
                <TableRow>
                    <TableHead className="pl-6 w-[120px]">Data</TableHead>
                    <TableHead>Descrição</TableHead>
                    <TableHead className="text-right">Valor</TableHead>
                    <TableHead className="text-center w-[100px]">Status</TableHead>
                    <TableHead className="text-right pr-6 w-[100px]">Ações</TableHead>
                </TableRow>
                </TableHeader>
                <TableBody>
                {listaVisual.map((item) => {
                    if (item.isGroup) {
                        const isExpanded = expandedGroups[item.id];
                        return (
                            <React.Fragment key={item.id}>
                                <TableRow 
                                    className="bg-blue-50/30 hover:bg-blue-50/60 cursor-pointer border-b border-blue-100/50 transition-colors" 
                                    onClick={() => toggleGroup(item.id)}
                                >
                                    <TableCell className="pl-6 font-bold text-blue-800 flex items-center gap-2">
                                        {isExpanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                                        {item.dateKey}
                                    </TableCell>
                                    <TableCell>
                                        <div className="font-bold text-blue-900">{item.descricao}</div>
                                        <div className="text-[10px] text-blue-600 font-bold uppercase tracking-wider flex items-center gap-1">
                                            <Users className="w-3 h-3" /> {item.itens.length} lançamentos agrupados
                                        </div>
                                    </TableCell>
                                    <TableCell className="text-right font-black text-blue-700 text-lg">
                                        R$ {item.total.toLocaleString('pt-BR')}
                                    </TableCell>
                                    <TableCell className="text-center">
                                        <Badge variant="secondary" className="bg-white border border-blue-200 text-blue-600 text-[10px]">AGRUPADO</Badge>
                                    </TableCell>
                                    <TableCell className="text-right pr-6"><span className="text-xs text-blue-400">Ver itens</span></TableCell>
                                </TableRow>
                                
                                {isExpanded && item.itens.map(subItem => (
                                    <TableRow key={subItem.id} className="bg-stone-50/30 hover:bg-stone-50 border-l-4 border-l-blue-200">
                                        <TableCell className="pl-10 text-sm text-stone-500">{format(new Date(subItem.data + 'T12:00:00'), 'dd/MM')}</TableCell>
                                        <TableCell className="text-sm font-medium text-stone-700">{subItem.descricao}</TableCell>
                                        <TableCell className="text-right font-medium text-stone-600">R$ {subItem.valor?.toLocaleString('pt-BR')}</TableCell>
                                        <TableCell className="text-center">
                                            <Badge variant="outline" className={subItem.status_pagamento === 'pago' ? "bg-emerald-50 text-emerald-700 border-emerald-100 scale-90" : "bg-amber-50 text-amber-700 border-amber-100 scale-90"}>
                                                {subItem.status_pagamento === 'pago' ? 'PAGO' : 'PENDENTE'}
                                            </Badge>
                                        </TableCell>
                                        <TableCell className="text-right pr-6">
                                            <div className="flex justify-end gap-1">
                                                <Button variant="ghost" size="icon" className="h-6 w-6" onClick={(e) => { e.stopPropagation(); handleEdit(subItem); }}><Edit className="w-3 h-3 text-stone-500" /></Button>
                                                <Button variant="ghost" size="icon" className="h-6 w-6" onClick={(e) => { e.stopPropagation(); deleteMutation.mutate(subItem.id); }}><Trash2 className="w-3 h-3 text-red-400" /></Button>
                                            </div>
                                        </TableCell>
                                    </TableRow>
                                ))}
                            </React.Fragment>
                        );
                    }

                    return (
                    <TableRow key={item.id} className="hover:bg-stone-50 transition-colors">
                        <TableCell className="pl-6 font-medium text-stone-600">{format(new Date(item.data + 'T12:00:00'), 'dd/MM/yy')}</TableCell>
                        <TableCell>
                        <div className="font-medium text-stone-800">{item.descricao}</div>
                        <div className="flex gap-2 items-center mt-0.5">
                            <span className={`text-[10px] px-1.5 py-0.5 rounded-md font-medium uppercase tracking-wider ${categoriaLabels[item.categoria]?.color || 'bg-stone-100 text-stone-500'}`}>
                                {categoriaLabels[item.categoria]?.label || item.categoria}
                            </span>
                            {item.tipo_lancamento === 'receita' && <span className="text-[10px] text-blue-600 font-bold uppercase tracking-wider bg-blue-50 px-1.5 py-0.5 rounded-md">Receita</span>}
                        </div>
                        </TableCell>
                        <TableCell className={`text-right font-bold ${item.tipo_lancamento === 'receita' ? 'text-blue-600' : 'text-red-600'}`}>
                            {item.tipo_lancamento === 'despesa' ? '- ' : '+ '}
                            R$ {item.valor?.toLocaleString('pt-BR')}
                        </TableCell>
                        <TableCell className="text-center">
                        <Badge variant="outline" className={item.status_pagamento === 'pago' ? "bg-emerald-50 text-emerald-700 border-emerald-100" : "bg-amber-50 text-amber-700 border-amber-100"}>
                            {item.status_pagamento === 'pago' ? 'PAGO' : 'PENDENTE'}
                        </Badge>
                        </TableCell>
                        <TableCell className="text-right pr-6">
                        <div className="flex justify-end gap-1">
                            <Button variant="ghost" size="sm" className="h-8 w-8 p-0 text-stone-500 hover:text-stone-800" onClick={() => handleEdit(item)}><Edit className="w-4 h-4" /></Button>
                            <Button variant="ghost" size="sm" className="h-8 w-8 p-0 text-red-400 hover:text-red-600" onClick={() => deleteMutation.mutate(item.id)}><Trash2 className="w-4 h-4" /></Button>
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
    </div>
  );
}