import React, { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabaseClient';
import StatCard from '@/components/ui/StatCard';
import PageSkeleton from '@/components/ui/PageSkeleton';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { 
  LayoutDashboard, Map, Wheat, TrendingUp, 
  DollarSign, PieChart, Activity, Wallet, Sprout, Calendar, ArrowRight, Tractor, CheckCircle2, BarChart2, X, Copy, FileText 
} from 'lucide-react';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, 
  ComposedChart, Cell, Legend, Line 
} from 'recharts';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { format, subMonths, startOfMonth, endOfMonth, eachMonthOfInterval, isAfter, parseISO, isBefore } from 'date-fns';
import { ptBR } from 'date-fns/locale';

const COLORS = ['#10b981', '#3b82f6', '#f59e0b', '#ef4444', '#8b5cf6'];

// --- FUNÇÕES DE CONVERSÃO DE NÚMEROS E ÁREA ---
const parseNumber = (val) => {
  if (val === undefined || val === null || val === '') return 0;
  const parsed = Number(String(val).replace(',', '.'));
  return isNaN(parsed) ? 0 : parsed;
};

const getAreaTalhao = (t) => {
    if (!t) return 0;
    return parseNumber(t.area_hectares) || parseNumber(t.tamanho_ha) || parseNumber(t.area) || parseNumber(t.tamanho) || parseNumber(t.hectares) || 0;
};

export default function Dashboard() {
  
  // --- ESTADOS DE FILTRO NOVO ---
  const [filterType, setFilterType] = useState('geral'); // 'geral', 'periodo', 'safra'
  const [dateStart, setDateStart] = useState('');
  const [dateEnd, setDateEnd] = useState('');
  const [selectedSafra, setSelectedSafra] = useState('nenhuma');

  // Estado para o Modal de Detalhes Financeiros (Drill Down)
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [detailsData, setDetailsData] = useState({ 
    title: '', type: '', financialItems: [], groupedOperational: {}, total: 0 
  });

  // Estado para o Modal de Detalhes da Atividade
  const [activityModalOpen, setActivityModalOpen] = useState(false);
  const [selectedActivity, setSelectedActivity] = useState(null);

  // --- 1. QUERIES (HOOKS) ---
  const { data: talhoes = [], isLoading: l1 } = useQuery({
    queryKey: ['talhoes'],
    queryFn: async () => { const { data } = await supabase.from('talhoes').select('*'); return data || []; }
  });

  const { data: colheitas = [], isLoading: l2 } = useQuery({
    queryKey: ['colheitas'],
    queryFn: async () => { const { data } = await supabase.from('colheitas').select('*'); return data || []; }
  });

  const { data: custos = [], isLoading: l3 } = useQuery({
    queryKey: ['custos'],
    queryFn: async () => { const { data } = await supabase.from('custos').select('*'); return data || []; }
  });

  const { data: atividades = [], isLoading: l4 } = useQuery({
    queryKey: ['atividades'],
    queryFn: async () => { const { data } = await supabase.from('atividades').select('*'); return data || []; }
  });

  const { data: funcionarios = [], isLoading: l5 } = useQuery({
    queryKey: ['funcionarios'],
    queryFn: async () => { const { data } = await supabase.from('funcionarios').select('*'); return data || []; }
  });

  const { data: safras = [], isLoading: l6 } = useQuery({
    queryKey: ['safras'],
    queryFn: async () => { const { data } = await supabase.from('safras').select('*').order('data_inicio', { ascending: false }); return data || []; }
  });

  // --- FUNÇÕES AUXILIARES ---
  const shouldIgnoreCost = (custo) => {
    if (custo.categoria !== 'funcionario') return false;
    const funcionario = funcionarios.find(f => custo.descricao && custo.descricao.includes(f.nome));
    if (funcionario && funcionario.data_inicio_contabil) {
        const dataCusto = parseISO(custo.data);
        const dataInicioContabil = parseISO(funcionario.data_inicio_contabil);
        return isBefore(dataCusto, dataInicioContabil);
    }
    return false;
  };

  const getTalhaoNome = (id) => talhoes.find(t => t.id === id)?.nome || '-';

  // --- LÓGICA DE FILTRAGEM (CÉREBRO DO RATEIO) ---
  const filteredData = useMemo(() => {
    let fColheitas = colheitas;
    let fCustos = custos;
    let fAtividades = atividades;
    let areaAnalise = 0;

    if (filterType === 'periodo' && dateStart && dateEnd) {
        fColheitas = colheitas.filter(c => c.data && c.data >= dateStart && c.data <= dateEnd);
        fCustos = custos.filter(c => c.data && c.data >= dateStart && c.data <= dateEnd);
        fAtividades = atividades.filter(a => a.data_programada && a.data_programada >= dateStart && a.data_programada <= dateEnd);
        areaAnalise = talhoes.reduce((acc, t) => acc + getAreaTalhao(t), 0);
    } 
    else if (filterType === 'safra' && selectedSafra && selectedSafra !== 'nenhuma') {
        const safra = safras.find(s => s.id === selectedSafra);
        if (safra) {
            const start = safra.data_inicio || '2000-01-01';
            const end = safra.data_fim || '2099-12-31';
            const talhaoId = String(safra.talhao_id);

            // Calcula proporção para o rateio
            const talhaoSafra = talhoes.find(t => String(t.id) === talhaoId);
            const areaTalhao = getAreaTalhao(talhaoSafra);
            const areaTotalFazenda = talhoes.reduce((acc, t) => acc + getAreaTalhao(t), 0);
            const proporcaoArea = areaTotalFazenda > 0 ? (areaTalhao / areaTotalFazenda) : 0;
            areaAnalise = areaTalhao;

            // 1. Custos Diretos (Insumos Diretos)
            const custosDiretos = custos.filter(c => 
                String(c.talhao_id) === talhaoId && c.data && c.data >= start && c.data <= end
            );

            // 2. Custos Globais (Folha e Gerais Rateados)
            const custosGlobais = custos.filter(c => {
                const isGlobal = !c.talhao_id || String(c.talhao_id).trim() === '' || String(c.talhao_id).toLowerCase() === 'geral' || String(c.talhao_id).toLowerCase() === 'todos' || c.talhao_id === 'null';
                return isGlobal && c.data && c.data >= start && c.data <= end;
            }).map(c => ({
                ...c,
                valor: parseNumber(c.valor) * proporcaoArea, // Multiplica pelo peso do talhão
                isRateio: true
            }));

            // Junta todos os custos
            fCustos = [...custosDiretos, ...custosGlobais];

            fColheitas = colheitas.filter(c => String(c.talhao_id) === talhaoId && c.data && c.data >= start && c.data <= end);
            fAtividades = atividades.filter(a => String(a.talhao_id) === talhaoId && a.data_programada && a.data_programada >= start && a.data_programada <= end);
        }
    } else {
        areaAnalise = talhoes.reduce((acc, t) => acc + getAreaTalhao(t), 0);
    }

    return { colheitas: fColheitas, custos: fCustos, atividades: fAtividades, areaAnalise };
  }, [colheitas, custos, atividades, safras, talhoes, filterType, dateStart, dateEnd, selectedSafra]);


  const generateActivityRecommendationText = (activity) => {
    if (!activity) return '';
    const talhaoNome = getTalhaoNome(activity.talhao_id);
    const data = format(parseISO(activity.data_programada), 'dd/MM/yyyy');
    const tipo = activity.tipo === 'outro' ? activity.tipo_personalizado : activity.tipo;

    let text = `🚜 *ATIVIDADE PROGRAMADA*\n\n`;
    text += `📍 *Local:* ${talhaoNome}\n`;
    text += `🔧 *Serviço:* ${tipo}\n`;
    text += `📅 *Data:* ${data}\n`;

    if (activity.terceirizada) text += `👷 *Obs:* Serviço Terceirizado\n`;
    if (activity.responsavel) text += `👤 *Responsável:* ${activity.responsavel}\n`;

    if (activity.insumos_utilizados && activity.insumos_utilizados.length > 0) {
        text += `\n📦 *INSUMOS:*\n`;
        activity.insumos_utilizados.forEach(i => {
            text += `   ▪ ${i.nome}: ${i.quantidade} ${i.unidade}`;
            if (i.metodo_aplicacao) text += ` [${i.metodo_aplicacao}]`;
            text += `\n`;
        });
    }

    if (activity.observacoes) {
        text += `\n📝 *OBSERVAÇÕES:*\n${activity.observacoes}`;
    }

    return text;
  };

  const copyToClipboard = (text) => {
      navigator.clipboard.writeText(text);
      alert("Texto de recomendação copiado!");
  };

  // --- HANDLERS PARA O DRILL DOWN (MODAIS) ---
  const handleChartClick = (data, type) => {
    if (!data || !data.payload) return;
    const mesReferencia = data.payload.rawDate;
    const nomeMes = data.payload.name; 
    let financialItems = [];
    let groupedOperational = {};
    let totalGeral = 0;

    // Usando os dados filtrados com rateio aplicado
    if (type === 'receita') {
        financialItems = filteredData.colheitas
            .filter(c => c.data && c.data.startsWith(mesReferencia))
            .map(c => {
                const talhao = talhoes.find(t => t.id === c.talhao_id);
                return {
                    id: c.id,
                    data: c.data,
                    descricao: `Colheita: ${c.cultura || 'Diversos'}`,
                    detalhe: `Talhão: ${talhao?.nome || 'N/A'} - ${c.quantidade_kg}kg`,
                    valor: c.valor_total || 0,
                    isPositive: true
                };
            });
    } else {
        financialItems = filteredData.custos
            .filter(c => c.data && c.data.startsWith(mesReferencia) && c.tipo_lancamento === 'despesa' && c.status_pagamento === 'pago' && !shouldIgnoreCost(c))
            .map(c => ({
                id: `fin-${c.id}`,
                data: c.data,
                descricao: c.descricao || 'Despesa Financeira',
                // Identifica no Modal se o custo é direto ou de rateio
                detalhe: c.isRateio ? `${c.categoria ? c.categoria.toUpperCase() : 'GERAL'} (RATEIO)` : (c.categoria ? c.categoria.toUpperCase() : 'DIRETO'),
                valor: parseNumber(c.valor),
                isPositive: false
            }));

        const operacionaisRaw = filteredData.atividades
            .filter(a => a.data_programada && a.data_programada.startsWith(mesReferencia) && a.status === 'concluida');

        operacionaisRaw.forEach(ativ => {
            const talhao = talhoes.find(t => t.id === ativ.talhao_id);
            const nomeTalhao = talhao ? talhao.nome : 'Sem Talhão Definido';
            if (!groupedOperational[nomeTalhao]) { groupedOperational[nomeTalhao] = { total: 0, items: [] }; }
            groupedOperational[nomeTalhao].items.push({
                id: `op-${ativ.id}`,
                data: ativ.data_programada,
                descricao: ativ.tipo,
                detalhe: 'Atividade Operacional',
                valor: parseNumber(ativ.custo_total),
                isPositive: false
            });
            groupedOperational[nomeTalhao].total += parseNumber(ativ.custo_total);
        });
    }

    const totalFinanceiro = financialItems.reduce((acc, i) => acc + i.valor, 0);
    const totalOperacional = Object.values(groupedOperational).reduce((acc, group) => acc + group.total, 0);
    totalGeral = totalFinanceiro + totalOperacional;

    setDetailsData({
        title: `Detalhes de ${type === 'receita' ? 'Receita' : 'Despesa'} - ${nomeMes}`,
        type: type,
        financialItems,
        groupedOperational,
        total: totalGeral
    });
    setDetailsOpen(true);
  };

  const handleActivityClick = (activity) => {
      setSelectedActivity(activity);
      setActivityModalOpen(true);
  };

  // --- 2. DADOS PARA GRÁFICOS (Usando os dados com Rateio) ---
  const dadosFinanceiroMisto = useMemo(() => {
    const hoje = new Date();
    const meses = eachMonthOfInterval({ start: subMonths(hoje, 11), end: hoje });
    return meses.map(mes => {
      const mesStr = format(mes, 'yyyy-MM');
      const label = format(mes, 'MMM', { locale: ptBR }).toUpperCase();
      
      const rec = filteredData.colheitas
        .filter(c => c.data && c.data.startsWith(mesStr))
        .reduce((acc, c) => acc + parseNumber(c.valor_total), 0);
      
      const despFin = filteredData.custos
        .filter(c => c.data && c.data.startsWith(mesStr) && c.tipo_lancamento === 'despesa' && c.status_pagamento === 'pago' && !shouldIgnoreCost(c))
        .reduce((acc, c) => acc + parseNumber(c.valor), 0);
      
      const despAtiv = filteredData.atividades
        .filter(a => a.data_programada && a.data_programada.startsWith(mesStr) && a.status === 'concluida')
        .reduce((acc, a) => acc + parseNumber(a.custo_total), 0);
      
      return { name: label, rawDate: mesStr, Receita: rec, Despesa: despFin + despAtiv };
    });
  }, [filteredData, funcionarios]);

  const dadosProducaoCultura = useMemo(() => {
      const porCultura = {};
      filteredData.colheitas.forEach(c => {
          const talhao = talhoes.find(t => t.id === c.talhao_id);
          const cultura = talhao?.cultura || 'Outros';
          porCultura[cultura] = (porCultura[cultura] || 0) + parseNumber(c.quantidade_kg);
      });
      return Object.entries(porCultura).map(([name, value]) => ({ name, value: value / 1000 })).sort((a, b) => b.value - a.value);
  }, [filteredData, talhoes]);

  const proximasAtividades = useMemo(() => {
      const hoje = new Date();
      return filteredData.atividades
        .filter(a => (a.status === 'pendente' || a.status === 'programada') && a.data_programada && isAfter(parseISO(a.data_programada), subMonths(hoje, 1))) 
        .sort((a, b) => new Date(a.data_programada) - new Date(b.data_programada))
        .slice(0, 5);
  }, [filteredData]);

  // --- 3. CÁLCULOS RIGOROSOS ---
  const areaTotalExibida = filteredData.areaAnalise;
  const totalColheitaTon = filteredData.colheitas.reduce((acc, c) => acc + (parseNumber(c.quantidade_kg) / 1000), 0);
  const receitaTotal = filteredData.colheitas.reduce((acc, c) => acc + parseNumber(c.valor_total), 0);
  
  // Agora os Custos puxam tudo (Insumos, Folha Rateada, Gerais Rateados)
  const custosFinanceirosPagos = filteredData.custos.filter(c => c.tipo_lancamento === 'despesa' && c.status_pagamento === 'pago' && !shouldIgnoreCost(c));
  const totalFinanceiroPago = custosFinanceirosPagos.reduce((acc, c) => acc + parseNumber(c.valor), 0);
  
  const atividadesConcluidas = filteredData.atividades.filter(a => a.status === 'concluida');
  const totalCustoAtividades = atividadesConcluidas.reduce((acc, a) => acc + parseNumber(a.custo_total), 0);
  
  const custoTotalGlobal = totalFinanceiroPago + totalCustoAtividades;
  const lucroReal = receitaTotal - custoTotalGlobal;
  const produtividadeMedia = areaTotalExibida > 0 ? (totalColheitaTon / areaTotalExibida) : 0;

  if (l1 || l2 || l3 || l4 || l5 || l6) return <PageSkeleton />;

  return (
    <div className="space-y-6 animate-in fade-in duration-700">
      
      {/* MODAL DE DETALHES DE ATIVIDADE */}
      <Dialog open={activityModalOpen} onOpenChange={setActivityModalOpen}>
        <DialogContent className="sm:max-w-md rounded-[2rem]">
            <DialogHeader>
                <DialogTitle className="flex items-center gap-2"><Tractor className="w-5 h-5 text-emerald-600" /> Detalhes da Atividade</DialogTitle>
                <DialogDescription>Informações completas e recomendação.</DialogDescription>
            </DialogHeader>
            
            {selectedActivity && (
                <div className="space-y-4">
                    <div className="bg-stone-100 p-4 rounded-xl border border-stone-200 overflow-y-auto max-h-[300px]">
                        <pre className="whitespace-pre-wrap text-sm font-mono text-stone-800">
                            {generateActivityRecommendationText(selectedActivity)}
                        </pre>
                    </div>
                    
                    <Button onClick={() => copyToClipboard(generateActivityRecommendationText(selectedActivity))} className="w-full rounded-xl bg-emerald-600 hover:bg-emerald-700">
                        <Copy className="w-4 h-4 mr-2" /> Copiar Recomendação
                    </Button>
                </div>
            )}
        </DialogContent>
      </Dialog>

      {/* MODAL DE DETALHES FINANCEIROS (DRILL DOWN) */}
      <Dialog open={detailsOpen} onOpenChange={setDetailsOpen}>
        <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto rounded-[2rem]">
            <DialogHeader>
                <DialogTitle className="flex items-center gap-2 text-xl">
                    {detailsData.type === 'receita' ? <TrendingUp className="text-emerald-600"/> : <DollarSign className="text-red-600"/>}
                    {detailsData.title}
                </DialogTitle>
                <DialogDescription>Detalhamento dos registros por categoria e talhão.</DialogDescription>
            </DialogHeader>
            <div className="mt-4 space-y-6">
                <Table>
                    <TableHeader className="bg-stone-50">
                        <TableRow>
                            <TableHead className="w-[100px]">Data</TableHead>
                            <TableHead>Descrição</TableHead>
                            <TableHead>Categoria</TableHead>
                            <TableHead className="text-right">Valor</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {detailsData.financialItems.length > 0 && (
                            <>
                                <TableRow className="bg-stone-100 hover:bg-stone-100"><TableCell colSpan={4} className="font-bold text-stone-700 text-xs uppercase tracking-wide py-2">Despesas Gerais / Financeiras / Insumos</TableCell></TableRow>
                                {detailsData.financialItems.map((item, idx) => (
                                    <TableRow key={`fin-${idx}`}>
                                        <TableCell className="text-xs font-medium text-stone-500">{format(parseISO(item.data), 'dd/MM')}</TableCell>
                                        <TableCell className="font-medium text-stone-800">{item.descricao}</TableCell>
                                        <TableCell className="text-xs text-stone-500 capitalize">{item.detalhe}</TableCell>
                                        <TableCell className={`text-right font-bold ${item.isPositive ? 'text-emerald-600' : 'text-red-600'}`}>R$ {item.valor.toLocaleString('pt-BR', {minimumFractionDigits: 2})}</TableCell>
                                    </TableRow>
                                ))}
                            </>
                        )}
                        {Object.entries(detailsData.groupedOperational).map(([talhao, data]) => (
                            <React.Fragment key={talhao}>
                                <TableRow className="bg-stone-100 hover:bg-stone-100 border-t-2 border-stone-200">
                                    <TableCell colSpan={3} className="font-bold text-stone-800 py-3"><div className="flex items-center gap-2"><Map className="w-4 h-4 text-stone-500" />{talhao}</div></TableCell>
                                    <TableCell className="text-right font-bold text-stone-800"><span className="text-xs font-normal text-stone-500 mr-2">Subtotal:</span>R$ {data.total.toLocaleString('pt-BR', {minimumFractionDigits: 2})}</TableCell>
                                </TableRow>
                                {data.items.map((item, idx) => (
                                    <TableRow key={`op-${talhao}-${idx}`} className="hover:bg-stone-50/50">
                                        <TableCell className="text-xs font-medium text-stone-500 pl-6">{format(parseISO(item.data), 'dd/MM')}</TableCell>
                                        <TableCell className="font-medium text-stone-700 pl-6 border-l-2 border-stone-200">{item.descricao}</TableCell>
                                        <TableCell className="text-xs text-stone-400">Atividade Operacional</TableCell>
                                        <TableCell className="text-right font-medium text-red-600/80">R$ {item.valor.toLocaleString('pt-BR', {minimumFractionDigits: 2})}</TableCell>
                                    </TableRow>
                                ))}
                            </React.Fragment>
                        ))}
                        {detailsData.financialItems.length === 0 && Object.keys(detailsData.groupedOperational).length === 0 && (
                            <TableRow><TableCell colSpan={4} className="text-center py-8 text-stone-400">Nenhum registro encontrado.</TableCell></TableRow>
                        )}
                        <TableRow className="bg-stone-800 hover:bg-stone-800 font-bold border-t-4 border-white">
                            <TableCell colSpan={3} className="text-right uppercase text-xs text-white">Total Geral do Mês</TableCell>
                            <TableCell className="text-right text-lg text-white">R$ {detailsData.total.toLocaleString('pt-BR', {minimumFractionDigits: 2})}</TableCell>
                        </TableRow>
                    </TableBody>
                </Table>
            </div>
        </DialogContent>
      </Dialog>

      {/* Header + BARRA DE FILTROS */}
      <div className="flex flex-col gap-4 bg-white p-6 rounded-[2rem] border border-stone-100 shadow-sm">
        
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center w-full">
            <div>
            <h1 className="text-2xl font-bold text-stone-900 tracking-tight">Visão Geral da Fazenda</h1>
            <p className="text-stone-500 font-medium">Indicadores consolidados (Regime de Caixa / Realizado)</p>
            </div>
            <div className="flex items-center gap-3 mt-4 md:mt-0">
                <div className="bg-emerald-50 text-emerald-800 px-4 py-2 rounded-xl font-bold text-xs border border-emerald-100 flex items-center gap-2"><div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></div>Online</div>
                <div className="bg-stone-50 text-stone-600 px-4 py-2 rounded-xl font-bold text-xs border border-stone-200">{new Date().toLocaleDateString('pt-BR')}</div>
            </div>
        </div>

        {/* CONTROLES DE FILTRO */}
        <div className="flex flex-col sm:flex-row items-center gap-3 pt-4 border-t border-stone-100 mt-2">
            <Select value={filterType} onValueChange={setFilterType}>
                <SelectTrigger className="w-full sm:w-[220px] rounded-xl bg-stone-50 font-bold border-stone-200">
                    <SelectValue placeholder="Filtrar dados..." />
                </SelectTrigger>
                <SelectContent>
                    <SelectItem value="geral">Visão Geral (Tudo)</SelectItem>
                    <SelectItem value="periodo">Período Específico</SelectItem>
                    <SelectItem value="safra">Por Safra (Gestão)</SelectItem>
                </SelectContent>
            </Select>

            {filterType === 'periodo' && (
                <div className="flex items-center gap-2 w-full sm:w-auto bg-stone-50 p-1 px-3 rounded-xl border border-stone-200">
                    <Input type="date" value={dateStart} onChange={e => setDateStart(e.target.value)} className="h-8 border-none bg-transparent shadow-none" />
                    <span className="text-stone-400 font-medium">até</span>
                    <Input type="date" value={dateEnd} onChange={e => setDateEnd(e.target.value)} className="h-8 border-none bg-transparent shadow-none" />
                </div>
            )}

            {filterType === 'safra' && (
                <Select value={selectedSafra} onValueChange={setSelectedSafra}>
                    <SelectTrigger className="w-full sm:w-[280px] rounded-xl bg-stone-50 font-bold border-stone-200">
                        <SelectValue placeholder="Escolha a Safra..." />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value="nenhuma">Selecione...</SelectItem>
                        {safras.map(s => (
                            <SelectItem key={s.id} value={s.id}>{s.nome}</SelectItem>
                        ))}
                    </SelectContent>
                </Select>
            )}
        </div>

      </div>

      {/* KPI CARDS - Linha 1 (Físico) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
        <StatCard title="Área Analisada" value={`${areaTotalExibida.toFixed(2)} ha`} icon={Map} color="text-stone-600" />
        <StatCard title="Produtividade Média" value={`${produtividadeMedia.toFixed(1)} ton/ha`} icon={Sprout} color="text-purple-600" />
        <StatCard title="Colheita Total" value={`${totalColheitaTon.toFixed(1)} ton`} icon={Wheat} color="text-amber-600" />
        <StatCard title="Próximas Atividades" value={`${filteredData.atividades.filter(a => a.status === 'pendente' || a.status === 'programada').length}`} icon={Tractor} color="text-blue-600" />
      </div>

      {/* KPI CARDS - Linha 2 (Financeiro - CAIXA REALIZADO) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard title="Receita Total" value={`R$ ${receitaTotal.toLocaleString('pt-BR', {maximumFractionDigits: 0})}`} icon={TrendingUp} color="text-emerald-600" />
        <StatCard title="Custo Total (Global)" value={`R$ ${custoTotalGlobal.toLocaleString('pt-BR', {maximumFractionDigits: 0})}`} icon={DollarSign} color="text-red-600" />
        <StatCard title="Lucro/Prejuízo Real" value={`R$ ${lucroReal.toLocaleString('pt-BR', {maximumFractionDigits: 0})}`} icon={Activity} color={lucroReal >= 0 ? "text-emerald-600" : "text-red-600"} />
        <StatCard title="Custo p/ Hectare" value={`R$ ${(areaTotalExibida > 0 ? custoTotalGlobal / areaTotalExibida : 0).toLocaleString('pt-BR', {maximumFractionDigits: 0})}`} icon={Wallet} color="text-stone-600" />
      </div>

      {/* GRÁFICOS E LISTAS */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        
        {/* Gráfico 1: Performance Financeira */}
        <div className="xl:col-span-2 bg-white p-6 rounded-[2rem] border border-stone-100 shadow-sm flex flex-col">
          <div className="flex justify-between items-center mb-6">
            <h3 className="text-lg font-bold text-stone-800 flex items-center gap-2"><BarChart2 className="w-5 h-5 text-emerald-600" /> Performance Financeira Mensal</h3>
            <div className="flex gap-4 text-xs font-medium">
                <div className="flex items-center gap-1"><div className="w-3 h-3 rounded-full bg-emerald-500"></div> Receita</div>
                <div className="flex items-center gap-1"><div className="w-3 h-3 rounded-full bg-red-500"></div> Despesa</div>
            </div>
          </div>
          <div className="h-80 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={dadosFinanceiroMisto} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
                <CartesianGrid vertical={false} stroke="#f3f4f6" strokeDasharray="3 3" />
                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{fill: '#9ca3af', fontSize: 12}} dy={10} />
                <YAxis axisLine={false} tickLine={false} tick={{fill: '#9ca3af', fontSize: 12}} tickFormatter={(v) => `R$${v/1000}k`} />
                <Tooltip contentStyle={{borderRadius: '12px', border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)'}} formatter={(value, name) => [`R$ ${value.toLocaleString('pt-BR')}`, name]} cursor={{fill: 'transparent'}} />
                <Bar dataKey="Receita" fill="#10b981" radius={[4, 4, 0, 0]} barSize={20} cursor="pointer" onClick={(data) => handleChartClick(data, 'receita')} />
                <Bar dataKey="Despesa" fill="#ef4444" radius={[4, 4, 0, 0]} barSize={20} cursor="pointer" onClick={(data) => handleChartClick(data, 'despesa')} />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
          <p className="text-center text-xs text-stone-400 mt-2 italic">Clique nas barras para ver detalhes do mês.</p>
        </div>

        {/* Coluna Direita: Produção + Atividades */}
        <div className="space-y-6">
            
            {/* Gráfico 2: Produção por Cultura */}
            <div className="bg-white p-6 rounded-[2rem] border border-stone-100 shadow-sm">
                <h3 className="text-lg font-bold text-stone-800 mb-4 flex items-center gap-2"><Wheat className="w-5 h-5 text-amber-600" /> Produção por Cultura</h3>
                <div className="h-48 w-full">
                    <ResponsiveContainer width="100%" height="100%">
                        <BarChart layout="vertical" data={dadosProducaoCultura} margin={{top: 0, right: 30, left: 0, bottom: 0}}>
                            <CartesianGrid strokeDasharray="3 3" horizontal={true} vertical={false} stroke="#f3f4f6" />
                            <XAxis type="number" hide />
                            <YAxis dataKey="name" type="category" axisLine={false} tickLine={false} width={80} tick={{fill: '#4b5563', fontSize: 13, fontWeight: 500}} />
                            <Tooltip cursor={{fill: '#f9fafb'}} formatter={(value) => [`${value.toFixed(1)} ton`, 'Produção']} contentStyle={{borderRadius: '8px'}} />
                            <Bar dataKey="value" radius={[0, 4, 4, 0]} barSize={24}>
                                {dadosProducaoCultura.map((entry, index) => (<Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />))}
                            </Bar>
                        </BarChart>
                    </ResponsiveContainer>
                </div>
            </div>

            {/* Lista: Próximas Atividades */}
            <div className="bg-white p-6 rounded-[2rem] border border-stone-100 shadow-sm flex-1">
                <div className="flex justify-between items-center mb-4">
                    <h3 className="text-lg font-bold text-stone-800 flex items-center gap-2"><Calendar className="w-5 h-5 text-blue-600" /> Próximas Atividades</h3>
                </div>
                
                <div className="space-y-3">
                    {proximasAtividades.length === 0 ? (
                        <div className="text-center py-8 text-stone-400 text-sm"><CheckCircle2 className="w-8 h-8 mx-auto mb-2 opacity-50" /> Nenhuma atividade pendente próxima.</div>
                    ) : (
                        proximasAtividades.map(ativ => (
                            <div 
                                key={ativ.id} 
                                onClick={() => handleActivityClick(ativ)}
                                className="flex items-center justify-between p-3 bg-stone-50 rounded-xl border border-stone-100 hover:bg-stone-100 transition-colors cursor-pointer group"
                            >
                                <div>
                                    <p className="font-bold text-stone-700 text-sm group-hover:text-blue-600 transition-colors capitalize">
                                        {ativ.tipo === 'outro' ? ativ.tipo_personalizado : ativ.tipo}
                                    </p>
                                    <div className="flex items-center gap-2 mt-1">
                                        <Badge variant="outline" className="h-5 px-1.5 text-[10px] bg-white border-stone-200 text-stone-600 font-medium">
                                            {getTalhaoNome(ativ.talhao_id)}
                                        </Badge>
                                        <p className="text-xs text-stone-500 flex items-center gap-1">
                                            <Calendar className="w-3 h-3" /> {format(parseISO(ativ.data_programada), 'dd/MM/yyyy')}
                                        </p>
                                    </div>
                                </div>
                                <ArrowRight className="w-4 h-4 text-stone-300 group-hover:text-blue-400 transition-colors" />
                            </div>
                        ))
                    )}
                </div>
            </div>

        </div>
      </div>
    </div>
  );
}