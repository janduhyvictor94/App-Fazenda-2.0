import React, { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabaseClient';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Plus, Sprout, Calendar, ArrowRight, DollarSign, TrendingUp, PieChart as PieIcon, BarChart3, Scale, Leaf, ArrowLeft, Trash2, CheckCircle2, Tractor, Wallet, Users, Zap, Edit, MoreVertical } from 'lucide-react';
import EmptyState from '@/components/ui/EmptyState';
import StatCard from '@/components/ui/StatCard';
import PageSkeleton from '@/components/ui/PageSkeleton';
import { format, parseISO, differenceInDays, isWithinInterval, startOfDay, endOfDay } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend, BarChart, Bar, XAxis, YAxis, CartesianGrid } from 'recharts';

export default function Safras() {
  const [view, setView] = useState('list'); // 'list' ou 'detail'
  const [selectedSafra, setSelectedSafra] = useState(null);
  
  // Estados de Criação
  const [createOpen, setCreateOpen] = useState(false);
  const [formData, setFormData] = useState({
    nome: '',
    talhao_id: '',
    data_inicio: format(new Date(), 'yyyy-MM-dd'),
    data_fim: '',
    status: 'ativo'
  });

  // Estados de Edição
  const [editOpen, setEditOpen] = useState(false);
  const [editingSafra, setEditingSafra] = useState(null);
  const [editFormData, setEditFormData] = useState({
    nome: '',
    talhao_id: '',
    data_inicio: '',
    data_fim: '',
    status: ''
  });

  const queryClient = useQueryClient();

  // --- QUERIES ---
  const { data: talhoes = [] } = useQuery({
    queryKey: ['talhoes'],
    queryFn: async () => { const { data } = await supabase.from('talhoes').select('*'); return data || []; }
  });

  const { data: safras = [], isLoading: loadingSafras } = useQuery({
    queryKey: ['safras'],
    queryFn: async () => { 
        const { data, error } = await supabase.from('safras').select(`*, talhoes ( nome, area_hectares )`).order('data_inicio', { ascending: false });
        if(error) throw error; return data || []; 
    }
  });

  const { data: custos = [] } = useQuery({
    queryKey: ['custos'],
    queryFn: async () => { const { data } = await supabase.from('custos').select('*'); return data || []; }
  });

  const { data: colheitas = [] } = useQuery({
    queryKey: ['colheitas'],
    queryFn: async () => { const { data } = await supabase.from('colheitas').select('*'); return data || []; }
  });

  const { data: atividades = [] } = useQuery({
    queryKey: ['atividades'],
    queryFn: async () => { const { data } = await supabase.from('atividades').select('*'); return data || []; }
  });

  // --- MUTAÇÕES ---
  const createMutation = useMutation({
    mutationFn: async (newSafra) => {
        const { error } = await supabase.from('safras').insert([newSafra]);
        if(error) throw error;
    },
    onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: ['safras'] });
        setCreateOpen(false);
        setFormData({ nome: '', talhao_id: '', data_inicio: format(new Date(), 'yyyy-MM-dd'), data_fim: '', status: 'ativo' });
    }
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }) => {
        const { error } = await supabase.from('safras').update(data).eq('id', id);
        if(error) throw error;
    },
    onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: ['safras'] });
        setEditOpen(false);
        setEditingSafra(null);
    }
  });

  const deleteMutation = useMutation({
    mutationFn: async (id) => {
        const { error } = await supabase.from('safras').delete().eq('id', id);
        if(error) throw error;
    },
    onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: ['safras'] });
        if (view === 'detail') setView('list');
    }
  });

  const finalizarMutation = useMutation({
    mutationFn: async (safra) => {
        const { error } = await supabase.from('safras').update({ status: 'concluido', data_fim: format(new Date(), 'yyyy-MM-dd') }).eq('id', safra.id);
        if(error) throw error;
    },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['safras'] }); }
  });

  // --- LÓGICA DE CÁLCULO ---
  const safraAnalysis = useMemo(() => {
    if (!selectedSafra) return null;

    const dataInicio = parseISO(selectedSafra.data_inicio);
    const dataFim = selectedSafra.data_fim ? parseISO(selectedSafra.data_fim) : new Date(); 
    
    const isInPeriod = (dateString) => {
        if (!dateString) return false;
        const d = parseISO(dateString);
        return isWithinInterval(d, { start: startOfDay(dataInicio), end: endOfDay(dataFim) });
    };

    // Receitas
    const receitas = colheitas.filter(c => c.talhao_id === selectedSafra.talhao_id && isInPeriod(c.data));
    const totalReceita = receitas.reduce((acc, c) => acc + (c.valor_total || 0), 0);
    const totalProducaoTon = receitas.reduce((acc, c) => acc + ((c.quantidade_kg || 0) / 1000), 0);

    // Custos Diretos
    const custosDiretosFin = custos.filter(c => c.talhao_id === selectedSafra.talhao_id && c.tipo_lancamento === 'despesa' && c.status_pagamento === 'pago' && isInPeriod(c.data));
    const totalCustoDiretoFin = custosDiretosFin.reduce((acc, c) => acc + (c.valor || 0), 0);

    // Atividades
    const atividadesSafra = atividades.filter(a => a.talhao_id === selectedSafra.talhao_id && a.status === 'concluida' && isInPeriod(a.data_programada));
    const totalCustoAtividades = atividadesSafra.reduce((acc, a) => acc + (a.custo_total || 0), 0);

    // Rateio
    const areaTotalFazenda = talhoes.reduce((acc, t) => acc + (Number(t.area_hectares) || 0), 0);
    const areaTalhao = selectedSafra.talhoes?.area_hectares || 0;
    const fatorRateio = areaTotalFazenda > 0 ? (areaTalhao / areaTotalFazenda) : 0;

    const custosSemTalhao = custos.filter(c => !c.talhao_id && c.tipo_lancamento === 'despesa' && c.status_pagamento === 'pago' && isInPeriod(c.data));
    const folhaGeral = custosSemTalhao.filter(c => c.categoria === 'funcionario');
    const totalFolhaGeral = folhaGeral.reduce((acc, c) => acc + (c.valor || 0), 0);
    const custoFolhaRateio = totalFolhaGeral * fatorRateio;

    const outrosGerais = custosSemTalhao.filter(c => c.categoria !== 'funcionario');
    const totalOutrosGerais = outrosGerais.reduce((acc, c) => acc + (c.valor || 0), 0);
    const custoGeralRateio = totalOutrosGerais * fatorRateio;

    const custoTotalSafra = totalCustoDiretoFin + totalCustoAtividades + custoFolhaRateio + custoGeralRateio;
    const lucro = totalReceita - custoTotalSafra;
    const custoPorHa = areaTalhao > 0 ? custoTotalSafra / areaTalhao : 0;
    const lucroPorHa = areaTalhao > 0 ? lucro / areaTalhao : 0;

    const composicaoCusto = [
        { name: 'Atividades (Operacional)', value: totalCustoAtividades },
        { name: 'Insumos Diretos', value: totalCustoDiretoFin },
        { name: 'Folha (Rateio)', value: custoFolhaRateio },
        { name: 'Geral (Rateio)', value: custoGeralRateio }
    ];

    const graficoBarras = [
        { name: 'Receita', valor: totalReceita, fill: '#10b981' },
        { name: 'Custo Total', valor: custoTotalSafra, fill: '#ef4444' },
        { name: 'Lucro', valor: lucro, fill: lucro >= 0 ? '#3b82f6' : '#f59e0b' }
    ];

    return {
        totalReceita, totalProducaoTon, totalCustoDiretoFin, totalCustoAtividades,
        custoFolhaRateio, custoGeralRateio, custoTotalSafra, lucro, custoPorHa, lucroPorHa,
        areaTalhao, composicaoCusto, graficoBarras, diasCiclo: differenceInDays(dataFim, dataInicio)
    };
  }, [selectedSafra, custos, colheitas, talhoes, atividades]);

  // --- HANDLERS ---
  const handleCreate = (e) => {
      e.preventDefault();
      const payload = { ...formData, talhao_id: formData.talhao_id, data_fim: formData.data_fim || null };
      createMutation.mutate(payload);
  };

  const handleEdit = (safra) => {
      setEditingSafra(safra);
      setEditFormData({
          nome: safra.nome,
          talhao_id: safra.talhao_id,
          data_inicio: safra.data_inicio,
          data_fim: safra.data_fim || '',
          status: safra.status
      });
      setEditOpen(true);
  };

  const handleUpdate = (e) => {
      e.preventDefault();
      const payload = { ...editFormData, data_fim: editFormData.data_fim || null };
      updateMutation.mutate({ id: editingSafra.id, data: payload });
  };

  const handleDelete = (id) => {
      if(confirm("Tem certeza que deseja excluir esta safra? Todos os registros vinculados serão perdidos visualmente neste relatório.")) {
          deleteMutation.mutate(id);
      }
  };

  if (loadingSafras) return <PageSkeleton />;

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      
      {/* VIEW: LISTA DE SAFRAS */}
      {view === 'list' && (
          <>
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-white p-6 rounded-[2rem] border border-stone-100 shadow-sm">
                <div>
                    <h1 className="text-2xl font-bold text-stone-900 flex items-center gap-2">
                        <Sprout className="w-6 h-6 text-emerald-600" />
                        Gestão de Safras
                    </h1>
                    <p className="text-stone-500 font-medium">Controle de ciclos produtivos por talhão</p>
                </div>
                
                <Dialog open={createOpen} onOpenChange={setCreateOpen}>
                    <DialogTrigger asChild>
                        <Button className="bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl shadow-lg shadow-emerald-100">
                            <Plus className="w-4 h-4 mr-2" /> Iniciar Nova Safra
                        </Button>
                    </DialogTrigger>
                    <DialogContent className="sm:max-w-md rounded-[2rem]">
                        <DialogHeader><DialogTitle>Nova Safra</DialogTitle><DialogDescription>Inicie um novo ciclo produtivo.</DialogDescription></DialogHeader>
                        <form onSubmit={handleCreate} className="space-y-4 py-4">
                            <div className="space-y-2"><Label>Identificação</Label><Input placeholder="Ex: Manga Palmer 2025/2026" value={formData.nome} onChange={e => setFormData({...formData, nome: e.target.value})} className="rounded-xl" required /></div>
                            <div className="space-y-2"><Label>Talhão</Label><Select onValueChange={v => setFormData({...formData, talhao_id: v})} required><SelectTrigger className="rounded-xl"><SelectValue placeholder="Selecione" /></SelectTrigger><SelectContent>{talhoes.map(t => <SelectItem key={t.id} value={t.id}>{t.nome}</SelectItem>)}</SelectContent></Select></div>
                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-2"><Label>Início</Label><Input type="date" value={formData.data_inicio} onChange={e => setFormData({...formData, data_inicio: e.target.value})} className="rounded-xl" required /></div>
                                <div className="space-y-2"><Label>Fim (Opcional)</Label><Input type="date" value={formData.data_fim} onChange={e => setFormData({...formData, data_fim: e.target.value})} className="rounded-xl" /></div>
                            </div>
                            <DialogFooter><Button type="submit" className="bg-emerald-600 hover:bg-emerald-700 rounded-xl w-full">Iniciar</Button></DialogFooter>
                        </form>
                    </DialogContent>
                </Dialog>
            </div>

            {/* DIALOG DE EDIÇÃO */}
            <Dialog open={editOpen} onOpenChange={setEditOpen}>
                <DialogContent className="sm:max-w-md rounded-[2rem]">
                    <DialogHeader><DialogTitle>Editar Safra</DialogTitle><DialogDescription>Altere os dados do ciclo.</DialogDescription></DialogHeader>
                    <form onSubmit={handleUpdate} className="space-y-4 py-4">
                        <div className="space-y-2"><Label>Identificação</Label><Input value={editFormData.nome} onChange={e => setEditFormData({...editFormData, nome: e.target.value})} className="rounded-xl" required /></div>
                        <div className="space-y-2"><Label>Status</Label><Select value={editFormData.status} onValueChange={v => setEditFormData({...editFormData, status: v})}><SelectTrigger className="rounded-xl"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="ativo">Ativo</SelectItem><SelectItem value="concluido">Concluído</SelectItem></SelectContent></Select></div>
                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2"><Label>Início</Label><Input type="date" value={editFormData.data_inicio} onChange={e => setEditFormData({...editFormData, data_inicio: e.target.value})} className="rounded-xl" required /></div>
                            <div className="space-y-2"><Label>Fim</Label><Input type="date" value={editFormData.data_fim} onChange={e => setEditFormData({...editFormData, data_fim: e.target.value})} className="rounded-xl" /></div>
                        </div>
                        <DialogFooter><Button type="submit" className="bg-emerald-600 hover:bg-emerald-700 rounded-xl w-full">Salvar Alterações</Button></DialogFooter>
                    </form>
                </DialogContent>
            </Dialog>

            {safras.length === 0 ? (
                <EmptyState icon={Sprout} title="Nenhuma safra iniciada" actionLabel="Iniciar Safra" onAction={() => setCreateOpen(true)} />
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {safras.map(safra => (
                        <Card key={safra.id} 
                              className="group cursor-pointer hover:shadow-xl transition-all duration-300 border-stone-100 rounded-[2rem] overflow-hidden bg-white relative"
                              onClick={() => { setSelectedSafra(safra); setView('detail'); }}
                        >
                            <div className={`h-2 w-full ${safra.status === 'ativo' ? 'bg-emerald-500' : 'bg-stone-300'}`} />
                            
                            {/* BOTÕES DE AÇÃO (EDITAR / EXCLUIR) */}
                            <div className="absolute top-4 right-4 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                <Button size="icon" variant="secondary" className="h-8 w-8 rounded-lg bg-white shadow-sm border border-stone-100 hover:bg-stone-50" 
                                    onClick={(e) => { e.stopPropagation(); handleEdit(safra); }}>
                                    <Edit className="w-4 h-4 text-stone-600" />
                                </Button>
                                <Button size="icon" variant="secondary" className="h-8 w-8 rounded-lg bg-white shadow-sm border border-stone-100 hover:bg-red-50" 
                                    onClick={(e) => { e.stopPropagation(); handleDelete(safra.id); }}>
                                    <Trash2 className="w-4 h-4 text-red-500" />
                                </Button>
                            </div>

                            <CardHeader className="pb-2">
                                <div className="flex justify-between items-start">
                                    <div>
                                        <Badge variant="secondary" className="mb-2 bg-stone-100 text-stone-600 font-bold rounded-lg uppercase text-[10px] tracking-wider">
                                            {safra.talhoes?.nome}
                                        </Badge>
                                        <CardTitle className="text-lg font-bold text-stone-800 group-hover:text-emerald-700 transition-colors">
                                            {safra.nome}
                                        </CardTitle>
                                    </div>
                                </div>
                            </CardHeader>
                            <CardContent>
                                <div className="space-y-3">
                                    <div className="flex items-center text-sm text-stone-500">
                                        <Calendar className="w-4 h-4 mr-2 text-stone-400" />
                                        {format(parseISO(safra.data_inicio), 'dd/MMM/yy', { locale: ptBR })} 
                                        <ArrowRight className="w-3 h-3 mx-2" /> 
                                        {safra.data_fim ? format(parseISO(safra.data_fim), 'dd/MMM/yy', { locale: ptBR }) : <span className="text-emerald-600 font-bold">Em andamento</span>}
                                    </div>
                                    <div className="flex items-center justify-between pt-2 border-t border-stone-100">
                                        <span className="text-xs font-bold text-stone-400 uppercase tracking-wider">Área</span>
                                        <span className="font-bold text-stone-700">{safra.talhoes?.area_hectares} ha</span>
                                    </div>
                                </div>
                            </CardContent>
                        </Card>
                    ))}
                </div>
            )}
          </>
      )}

      {/* VIEW: DETALHES DA SAFRA */}
      {view === 'detail' && selectedSafra && safraAnalysis && (
          <div className="space-y-6">
              <div className="flex items-center justify-between bg-white p-4 rounded-[1.5rem] border border-stone-100 shadow-sm sticky top-4 z-10">
                  <div className="flex items-center gap-4">
                      <Button variant="ghost" size="icon" onClick={() => setView('list')} className="rounded-xl hover:bg-stone-100">
                          <ArrowLeft className="w-6 h-6 text-stone-600" />
                      </Button>
                      <div>
                          <h1 className="text-xl font-bold text-stone-900">{selectedSafra.nome}</h1>
                          <div className="flex items-center gap-2 text-sm text-stone-500">
                              <span className="font-medium text-emerald-700">{selectedSafra.talhoes?.nome}</span> • 
                              <span>{format(parseISO(selectedSafra.data_inicio), 'dd/MM/yyyy')} até {selectedSafra.data_fim ? format(parseISO(selectedSafra.data_fim), 'dd/MM/yyyy') : 'Hoje'}</span>
                          </div>
                      </div>
                  </div>
                  <div className="flex gap-2">
                      {selectedSafra.status === 'ativo' && (
                          <Button variant="outline" className="rounded-xl border-emerald-200 text-emerald-700 hover:bg-emerald-50" onClick={() => { if(confirm("Deseja encerrar este ciclo?")) finalizarMutation.mutate(selectedSafra) }}>
                              <CheckCircle2 className="w-4 h-4 mr-2" /> Encerrar Safra
                          </Button>
                      )}
                      <Button variant="outline" className="rounded-xl" onClick={() => window.print()}>Imprimir</Button>
                  </div>
              </div>

              <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                  <StatCard title="Custo Total Real" value={`R$ ${safraAnalysis.custoTotalSafra.toLocaleString('pt-BR', {maximumFractionDigits: 2})}`} icon={DollarSign} color="text-red-600" />
                  <StatCard title="Receita Obtida" value={`R$ ${safraAnalysis.totalReceita.toLocaleString('pt-BR', {maximumFractionDigits: 2})}`} icon={TrendingUp} color="text-emerald-600" />
                  <StatCard title="Lucro Líquido" value={`R$ ${safraAnalysis.lucro.toLocaleString('pt-BR', {maximumFractionDigits: 2})}`} icon={Scale} color={safraAnalysis.lucro >= 0 ? "text-emerald-600" : "text-red-600"} />
                  <StatCard title="Custo por Hectare" value={`R$ ${safraAnalysis.custoPorHa.toLocaleString('pt-BR', {maximumFractionDigits: 2})}`} icon={PieIcon} color="text-purple-600" />
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                  <Card className="lg:col-span-1 border-stone-100 rounded-[2rem] shadow-sm">
                      <CardHeader><CardTitle className="text-lg">Composição Detalhada</CardTitle></CardHeader>
                      <CardContent>
                          <div className="h-64">
                              <ResponsiveContainer width="100%" height="100%">
                                  <PieChart>
                                      <Pie data={safraAnalysis.composicaoCusto} innerRadius={60} outerRadius={80} paddingAngle={5} dataKey="value">
                                          {safraAnalysis.composicaoCusto.map((_, index) => <Cell key={index} fill={['#3b82f6', '#10b981', '#f59e0b', '#a855f7'][index % 4]} />)}
                                      </Pie>
                                      <Tooltip formatter={(v) => `R$ ${v.toLocaleString('pt-BR', {maximumFractionDigits: 2})}`} />
                                      <Legend verticalAlign="bottom" />
                                  </PieChart>
                              </ResponsiveContainer>
                          </div>
                          <div className="mt-4 space-y-3">
                              <div className="flex justify-between items-center text-sm p-3 bg-blue-50 rounded-xl border border-blue-100">
                                  <div className="flex items-center gap-2">
                                      <Tractor className="w-4 h-4 text-blue-600" />
                                      <span className="font-medium text-blue-800">Atividades (Op.)</span>
                                  </div>
                                  <span className="font-bold text-blue-900">R$ {safraAnalysis.totalCustoAtividades.toLocaleString('pt-BR')}</span>
                              </div>
                              <div className="flex justify-between items-center text-sm p-3 bg-emerald-50 rounded-xl border border-emerald-100">
                                  <div className="flex items-center gap-2">
                                      <Wallet className="w-4 h-4 text-emerald-600" />
                                      <span className="font-medium text-emerald-800">Insumos Diretos</span>
                                  </div>
                                  <span className="font-bold text-emerald-900">R$ {safraAnalysis.totalCustoDiretoFin.toLocaleString('pt-BR')}</span>
                              </div>
                              <div className="flex justify-between items-center text-sm p-3 bg-amber-50 rounded-xl border border-amber-100">
                                  <div className="flex items-center gap-2">
                                      <Users className="w-4 h-4 text-amber-600" />
                                      <span className="font-medium text-amber-800">Folha (Rateio)</span>
                                  </div>
                                  <span className="font-bold text-amber-900">R$ {safraAnalysis.custoFolhaRateio.toLocaleString('pt-BR', {maximumFractionDigits: 2})}</span>
                              </div>
                              <div className="flex justify-between items-center text-sm p-3 bg-purple-50 rounded-xl border border-purple-100">
                                  <div className="flex items-center gap-2">
                                      <Zap className="w-4 h-4 text-purple-600" />
                                      <span className="font-medium text-purple-800">Gerais (Rateio)</span>
                                  </div>
                                  <span className="font-bold text-purple-900">R$ {safraAnalysis.custoGeralRateio.toLocaleString('pt-BR', {maximumFractionDigits: 2})}</span>
                              </div>
                          </div>
                      </CardContent>
                  </Card>

                  <Card className="lg:col-span-2 border-stone-100 rounded-[2rem] shadow-sm">
                      <CardHeader><CardTitle className="text-lg">Balanço Financeiro da Safra</CardTitle></CardHeader>
                      <CardContent>
                          <div className="h-80">
                              <ResponsiveContainer width="100%" height="100%">
                                  <BarChart data={safraAnalysis.graficoBarras} margin={{top: 20, right: 30, left: 20, bottom: 5}}>
                                      <CartesianGrid strokeDasharray="3 3" vertical={false} />
                                      <XAxis dataKey="name" axisLine={false} tickLine={false} />
                                      <YAxis axisLine={false} tickLine={false} tickFormatter={(v) => `R$${v/1000}k`} />
                                      <Tooltip cursor={{fill: '#f3f4f6'}} formatter={(v) => `R$ ${v.toLocaleString('pt-BR')}`} />
                                      <Bar dataKey="valor" radius={[8, 8, 0, 0]} barSize={60} />
                                  </BarChart>
                              </ResponsiveContainer>
                          </div>
                      </CardContent>
                  </Card>
              </div>

              <Card className="border-stone-100 rounded-[2rem] shadow-sm overflow-hidden">
                  <CardHeader><CardTitle>Resumo Executivo</CardTitle></CardHeader>
                  <Table>
                      <TableBody>
                          <TableRow>
                              <TableCell className="font-medium pl-6">Duração do Ciclo</TableCell>
                              <TableCell className="text-right pr-6">{safraAnalysis.diasCiclo} dias</TableCell>
                          </TableRow>
                          <TableRow>
                              <TableCell className="font-medium pl-6">Produção Total</TableCell>
                              <TableCell className="text-right pr-6">{safraAnalysis.totalProducaoTon.toFixed(2)} toneladas</TableCell>
                          </TableRow>
                          <TableRow>
                              <TableCell className="font-medium pl-6">Produtividade Estimada</TableCell>
                              <TableCell className="text-right pr-6">{(safraAnalysis.totalProducaoTon / safraAnalysis.areaTalhao).toFixed(2)} ton/ha</TableCell>
                          </TableRow>
                          <TableRow>
                              <TableCell className="font-medium pl-6">Lucro por Hectare</TableCell>
                              <TableCell className={`text-right pr-6 font-bold ${safraAnalysis.lucroPorHa >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                                  R$ {safraAnalysis.lucroPorHa.toLocaleString('pt-BR', {maximumFractionDigits: 2})}
                              </TableCell>
                          </TableRow>
                      </TableBody>
                  </Table>
              </Card>
          </div>
      )}
    </div>
  );
}