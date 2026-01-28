import React, { useState, useMemo } from 'react';
import { createPortal } from 'react-dom';
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
import { Plus, Edit, Trash2, Users, Phone, Calendar, Briefcase, User, Calculator, TrendingUp, CalendarRange, Printer, FileText, Lock } from 'lucide-react';
import EmptyState from '@/components/ui/EmptyState';
import StatCard from '@/components/ui/StatCard';
import { format, addMonths, startOfMonth, isWeekend, isBefore, differenceInMonths, setDate, isSameMonth, parseISO, startOfDay, endOfDay, isAfter, isValid } from 'date-fns';
import { ptBR } from 'date-fns/locale';

const statusLabels = {
  ativo: { label: 'Ativo', color: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
  inativo: { label: 'Inativo', color: 'bg-stone-50 text-stone-700 border-stone-200' },
  ferias: { label: 'Férias', color: 'bg-blue-50 text-blue-700 border-blue-200' }
};

// --- CSS DE IMPRESSÃO ---
const printStyles = `
  @media print {
    @page { size: A4; margin: 1.5cm; }
    body > *:not(#print-portal-root) { display: none !important; }
    #print-portal-root { 
      display: block !important; position: absolute; top: 0; left: 0; width: 100%; 
      height: auto; z-index: 99999; background: white; font-family: sans-serif; color: black; font-size: 12px; 
    }
    .print-header { border-bottom: 2px solid #333; padding-bottom: 15px; margin-bottom: 25px; display: flex; justify-content: space-between; align-items: flex-end; }
    .print-title { font-size: 22px; font-weight: bold; margin: 0; text-transform: uppercase; }
    .print-section-title { font-size: 16px; font-weight: bold; margin-top: 30px; margin-bottom: 10px; border-bottom: 1px solid #ccc; }
    .print-table { width: 100%; border-collapse: collapse; margin-bottom: 20px; }
    .print-table th { border-bottom: 2px solid #000; text-align: left; padding: 8px 5px; font-weight: bold; font-size: 11px; }
    .print-table td { border-bottom: 1px solid #eee; padding: 8px 5px; }
    .print-total-row td { border-top: 2px solid #000; font-weight: bold; background-color: #f9f9f9 !important; }
    tr { page-break-inside: avoid; }
  }
  #print-portal-root { display: none; }
`;

// --- FUNÇÕES AUXILIARES ---
const safeFormatDate = (dateString) => {
    if (!dateString) return '--/--/----';
    try {
        const date = parseISO(dateString);
        if (!isValid(date)) return '--/--/----';
        return format(date, 'dd/MM/yyyy');
    } catch { return '--/--/----'; }
};

const getSalarioNaData = (historico, salarioAtual, dataReferencia) => {
  if (!historico || !Array.isArray(historico) || historico.length === 0) return salarioAtual;
  const historicoOrdenado = [...historico].sort((a, b) => new Date(b.data_vigencia) - new Date(a.data_vigencia));
  const registroVigente = historicoOrdenado.find(h => {
    const dataVigencia = new Date(h.data_vigencia + 'T12:00:00');
    return isBefore(dataVigencia, dataReferencia) || isSameMonth(dataVigencia, dataReferencia);
  });
  return registroVigente ? parseFloat(registroVigente.valor) : salarioAtual;
};

const getQuintoDiaUtil = (date) => {
  let d = startOfMonth(addMonths(date, 1));
  let diasUteis = 0;
  while (diasUteis < 5) {
    if (!isWeekend(d)) diasUteis++;
    if (diasUteis < 5) d = setDate(d, d.getDate() + 1);
  }
  return d;
};

const calcularFolha = (funcionario) => {
  if (!funcionario.data_admissao || !funcionario.salario) return [];
  const admissao = new Date(funcionario.data_admissao + 'T12:00:00');
  const hoje = new Date();
  const limiteFuturo = addMonths(hoje, 60);
  let eventos = [];
  let cursor = new Date(admissao);
  cursor.setDate(1); 

  while (isBefore(cursor, limiteFuturo)) {
    const salarioVigente = getSalarioNaData(funcionario.historico_salarial, funcionario.salario, cursor);
    const dataPagamentoSalario = getQuintoDiaUtil(cursor);
    
    eventos.push({
      id: `salario-${format(cursor, 'yyyy-MM')}`, tipo: 'Salário Mensal',
      referencia: format(cursor, 'MMMM/yyyy', { locale: ptBR }),
      data_pagamento: dataPagamentoSalario, valor: salarioVigente,
      detalhe: `Base: R$ ${salarioVigente.toLocaleString('pt-BR')}`
    });

    if (cursor.getMonth() === 11) {
      const anoCursor = cursor.getFullYear();
      const dataDecimo = new Date(anoCursor, 11, 20); 
      let mesesTrabalhados = 12;
      if (anoCursor === admissao.getFullYear()) {
        mesesTrabalhados = 12 - admissao.getMonth();
        if (admissao.getDate() > 15) mesesTrabalhados -= 1; 
        if (mesesTrabalhados < 0) mesesTrabalhados = 0;
      }
      const valorDecimo = (salarioVigente / 12) * mesesTrabalhados;
      if (valorDecimo > 0) {
        eventos.push({
          id: `13-${anoCursor}`, tipo: '13º Salário',
          referencia: `Exercício ${anoCursor}`, data_pagamento: dataDecimo,
          valor: valorDecimo, detalhe: `Prop. ${mesesTrabalhados}/12 avos`
        });
      }
    }

    const mesesDeCasa = differenceInMonths(cursor, admissao);
    if (mesesDeCasa > 0 && mesesDeCasa % 12 === 0) {
       const dataPagamentoFerias = addMonths(cursor, 1);
       const bonusFerias = salarioVigente * (1/3); 
       const totalFerias = salarioVigente + bonusFerias;
       eventos.push({
         id: `ferias-${format(cursor, 'yyyy-MM')}`, tipo: 'Férias (1 Ano)',
         referencia: `Período ${format(addMonths(cursor, -12), 'MM/yy')} a ${format(cursor, 'MM/yy')}`,
         data_pagamento: dataPagamentoFerias, valor: totalFerias, detalhe: `Salário + 1/3`
       });
    }
    cursor = addMonths(cursor, 1);
  }
  return eventos.sort((a, b) => a.data_pagamento - b.data_pagamento);
};

export default function Funcionarios() {
  const [open, setOpen] = useState(false);
  const [folhaOpen, setFolhaOpen] = useState(false);
  const [reajusteOpen, setReajusteOpen] = useState(false);
  const [relatorioGeralOpen, setRelatorioGeralOpen] = useState(false);
  
  const [editingFuncionario, setEditingFuncionario] = useState(null);
  const [selectedFuncionario, setSelectedFuncionario] = useState(null);
  
  const currentYear = new Date().getFullYear();
  const [filtroInicio, setFiltroInicio] = useState(`${currentYear}-01-01`);
  const [filtroFim, setFiltroFim] = useState(`${currentYear}-12-31`);

  const [modoImpressao, setModoImpressao] = useState(null);

  const [formData, setFormData] = useState({
    nome: '', cargo: '', salario: '', data_admissao: '',
    data_inicio_contabil: '', // NOVO CAMPO
    status: 'ativo', telefone: '', talhao_principal: '', observacoes: ''
  });

  const [reajusteData, setReajusteData] = useState({
    novo_salario: '',
    data_vigencia: format(new Date(), 'yyyy-MM-dd')
  });

  const queryClient = useQueryClient();

  const { data: talhoes = [] } = useQuery({
    queryKey: ['talhoes'],
    queryFn: async () => { const { data } = await supabase.from('talhoes').select('*'); return data || []; }
  });

  const { data: funcionarios = [] } = useQuery({
    queryKey: ['funcionarios'],
    queryFn: async () => { const { data } = await supabase.from('funcionarios').select('*'); return data || []; }
  });

  const { data: todosCustosFuncionarios = [] } = useQuery({
    queryKey: ['todos_custos_funcionarios'],
    queryFn: async () => {
        const { data, error } = await supabase.from('custos').select('*').eq('categoria', 'funcionario');
        if (error) throw error; return data || [];
    }
  });

  // --- MUTAÇÕES ---
  const createMutation = useMutation({
    mutationFn: async (data) => {
      const payload = { ...data };
      payload.talhao_id = (payload.talhao_principal && payload.talhao_principal !== 'none') ? payload.talhao_principal : null;
      delete payload.talhao_principal; 
      
      // Trata data contabil vazia como null
      if (!payload.data_inicio_contabil) payload.data_inicio_contabil = null;

      payload.historico_salarial = [{ valor: data.salario, data_vigencia: data.data_admissao }];
      
      const { error } = await supabase.from('funcionarios').insert([payload]);
      if (error) throw error;
    },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['funcionarios'] }); resetForm(); }
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }) => {
      const payload = { ...data };
      payload.talhao_id = (payload.talhao_principal && payload.talhao_principal !== 'none') ? payload.talhao_principal : null;
      delete payload.talhao_principal; 

      if (!payload.data_inicio_contabil) payload.data_inicio_contabil = null;

      const { error } = await supabase.from('funcionarios').update(payload).eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['funcionarios'] }); resetForm(); }
  });

  const reajusteMutation = useMutation({
    mutationFn: async () => {
        if (!selectedFuncionario || !reajusteData.novo_salario) return;
        const historicoAtual = selectedFuncionario.historico_salarial || [];
        const payload = {
            salario: parseFloat(reajusteData.novo_salario),
            historico_salarial: [...historicoAtual, { valor: parseFloat(reajusteData.novo_salario), data_vigencia: reajusteData.data_vigencia }]
        };
        const { error } = await supabase.from('funcionarios').update(payload).eq('id', selectedFuncionario.id);
        if (error) throw error;
    },
    onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: ['funcionarios'] });
        setReajusteOpen(false);
        const updatedFunc = { ...selectedFuncionario, salario: parseFloat(reajusteData.novo_salario) };
        setSelectedFuncionario(updatedFunc);
        alert("Salário reajustado com sucesso!");
    }
  });

  const deleteMutation = useMutation({
    mutationFn: async (id) => {
      const { data: func } = await supabase.from('funcionarios').select('nome').eq('id', id).single();
      if (func?.nome) await supabase.from('custos').delete().eq('categoria', 'funcionario').ilike('descricao', `%${func.nome}%`);
      const { error } = await supabase.from('funcionarios').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => { 
        queryClient.invalidateQueries({ queryKey: ['funcionarios'] }); 
        queryClient.invalidateQueries({ queryKey: ['custos'] }); 
        queryClient.invalidateQueries({ queryKey: ['todos_custos_funcionarios'] });
    }
  });

  const lancarCustoMutation = useMutation({
    mutationFn: async ({ evento, statusInicial }) => {
      const payload = {
        descricao: `Folha: ${evento.tipo} - ${selectedFuncionario.nome}`,
        categoria: 'funcionario', valor: parseFloat(evento.valor.toFixed(2)),
        data: format(evento.data_pagamento, 'yyyy-MM-dd'), status_pagamento: statusInicial, tipo_lancamento: 'despesa',
        observacoes: `Ref: ${evento.referencia}. ${evento.detalhe}`, 
        talhao_id: selectedFuncionario.talhao_id || null 
      };
      const { error } = await supabase.from('custos').insert([payload]);
      if (error) throw error;
    },
    onSuccess: () => { 
        queryClient.invalidateQueries({ queryKey: ['todos_custos_funcionarios'] }); 
        queryClient.invalidateQueries({ queryKey: ['custos'] });
    }
  });

  const atualizarStatusCustoMutation = useMutation({
    mutationFn: async ({ id, novoStatus }) => {
      const { error } = await supabase.from('custos').update({ status_pagamento: novoStatus }).eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => { 
        queryClient.invalidateQueries({ queryKey: ['todos_custos_funcionarios'] });
        queryClient.invalidateQueries({ queryKey: ['custos'] });
    }
  });

  const resetForm = () => {
    setFormData({ 
        nome: '', cargo: '', salario: '', data_admissao: '', data_inicio_contabil: '',
        status: 'ativo', telefone: '', talhao_principal: '', observacoes: '' 
    });
    setEditingFuncionario(null);
    setOpen(false);
  };

  const handleEdit = (funcionario) => {
    setEditingFuncionario(funcionario);
    setFormData({ 
        ...funcionario, 
        talhao_principal: funcionario.talhao_id || "none",
        data_inicio_contabil: funcionario.data_inicio_contabil || ''
    });
    setOpen(true);
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    const data = { ...formData, salario: formData.salario ? parseFloat(formData.salario) : null };
    if (editingFuncionario) updateMutation.mutate({ id: editingFuncionario.id, data });
    else createMutation.mutate(data);
  };

  const handlePrint = (mode) => {
    setModoImpressao(mode);
    setTimeout(() => { window.print(); }, 500); 
  };

  const eventosFolhaIndividual = useMemo(() => {
    if (!selectedFuncionario) return [];
    const calculados = calcularFolha(selectedFuncionario);
    const hoje = new Date();
    
    // Data de corte para contabilização
    const dataCorte = selectedFuncionario.data_inicio_contabil ? parseISO(selectedFuncionario.data_inicio_contabil) : null;

    const eventosComStatus = calculados.map(evento => {
        const custo = todosCustosFuncionarios.find(c => {
            const dataCusto = parseISO(c.data);
            return isSameMonth(dataCusto, evento.data_pagamento) && 
                   c.descricao.includes(selectedFuncionario.nome) && 
                   c.descricao.includes(evento.tipo);
        });

        let status = 'provisionado';
        
        // Se a data do evento for ANTERIOR à data de contabilização, marca como ignorado
        if (dataCorte && isBefore(evento.data_pagamento, dataCorte)) {
            status = 'ignorado'; // Histórico antigo
        } else if (custo) {
            status = custo.status_pagamento === 'pago' ? 'pago' : 'pendente_financeiro';
        } else if (isBefore(evento.data_pagamento, hoje)) {
            status = 'pendente_lancamento';
        }

        return { ...evento, status, custoId: custo?.id };
    });

    return eventosComStatus.filter(evento => {
        if (!filtroInicio && !filtroFim) return true;
        const dataEvt = startOfDay(evento.data_pagamento);
        const inicio = filtroInicio ? startOfDay(parseISO(filtroInicio)) : null;
        const fim = filtroFim ? endOfDay(parseISO(filtroFim)) : null;
        if (inicio && isBefore(dataEvt, inicio)) return false;
        if (fim && isAfter(dataEvt, fim)) return false;
        return true;
    });
  }, [selectedFuncionario, todosCustosFuncionarios, filtroInicio, filtroFim]);

  const relatorioGeral = useMemo(() => {
    if (!funcionarios.length) return [];
    let todosEventos = [];
    funcionarios.filter(f => f.status === 'ativo').forEach(func => {
        const calculados = calcularFolha(func);
        const dataCorte = func.data_inicio_contabil ? parseISO(func.data_inicio_contabil) : null;

        const filtrados = calculados.filter(evento => {
            const dataEvt = startOfDay(evento.data_pagamento);
            const inicio = filtroInicio ? startOfDay(parseISO(filtroInicio)) : null;
            const fim = filtroFim ? endOfDay(parseISO(filtroFim)) : null;
            if (inicio && isBefore(dataEvt, inicio)) return false;
            if (fim && isAfter(dataEvt, fim)) return false;
            return true;
        });
        filtrados.forEach(evt => {
            const custo = todosCustosFuncionarios.find(c => {
                const dataCusto = parseISO(c.data);
                return isSameMonth(dataCusto, evt.data_pagamento) && c.descricao.includes(func.nome) && c.descricao.includes(evt.tipo);
            });
            
            // Verifica se é histórico antigo
            const isAntigo = dataCorte && isBefore(evt.data_pagamento, dataCorte);
            
            const status = isAntigo ? 'HISTÓRICO' : (custo ? (custo.status_pagamento === 'pago' ? 'PAGO' : 'PENDENTE') : 'A PAGAR');
            todosEventos.push({ funcionario: func.nome, cargo: func.cargo, ...evt, status });
        });
    });
    return todosEventos.sort((a, b) => a.data_pagamento - b.data_pagamento || a.funcionario.localeCompare(b.funcionario));
  }, [funcionarios, todosCustosFuncionarios, filtroInicio, filtroFim]);

  const totalGeralPeriodo = relatorioGeral.filter(e => e.status !== 'HISTÓRICO').reduce((acc, curr) => acc + curr.valor, 0);
  const custoTotalPeriodoInd = eventosFolhaIndividual.filter(e => e.status !== 'ignorado').reduce((acc, e) => acc + e.valor, 0);
  
  // Totais Cards (Ignorando históricos)
  const eventosValidosInd = eventosFolhaIndividual.filter(e => e.status !== 'ignorado');
  const totalSalariosInd = eventosValidosInd.filter(e => e.tipo === 'Salário Mensal').reduce((acc, e) => acc + e.valor, 0);
  const totalFeriasInd = eventosValidosInd.filter(e => e.tipo.includes('Férias')).reduce((acc, e) => acc + e.valor, 0);
  const totalDecimoInd = eventosValidosInd.filter(e => e.tipo.includes('13º')).reduce((acc, e) => acc + e.valor, 0);
  
  const totalFuncionarios = funcionarios.length;
  const funcionariosAtivos = funcionarios.filter(f => f.status === 'ativo').length;
  const totalFolhaBase = funcionarios.filter(f => f.status === 'ativo').reduce((acc, f) => acc + (f.salario || 0), 0);

  return (
    <div className="space-y-6">
      <style>{printStyles}</style>
      {createPortal(
        <div id="print-portal-root">
            <div className="print-header">
                <div><h1 className="print-title">Fazenda Cassiano's</h1><p className="print-subtitle">Relatório de Folha de Pagamento</p></div>
                <div style={{textAlign: 'right'}}><p><strong>Período:</strong> {safeFormatDate(filtroInicio)} a {safeFormatDate(filtroFim)}</p><p><strong>Emissão:</strong> {format(new Date(), 'dd/MM/yyyy HH:mm')}</p></div>
            </div>
            {modoImpressao === 'individual' && selectedFuncionario && (
                <div>
                    <div className="print-section-title">{selectedFuncionario.nome} - {selectedFuncionario.cargo}</div>
                    <table className="print-table">
                        <thead><tr><th style={{width: '15%'}}>Vencimento</th><th style={{width: '20%'}}>Competência</th><th style={{width: '35%'}}>Evento</th><th style={{textAlign: 'right', width: '15%'}}>Valor</th><th style={{textAlign: 'center', width: '15%'}}>Status</th></tr></thead>
                        <tbody>
                            {eventosFolhaIndividual.map((evt, idx) => (<tr key={idx}><td>{format(evt.data_pagamento, 'dd/MM/yyyy')}</td><td style={{textTransform: 'capitalize'}}>{evt.referencia}</td><td>{evt.tipo} <span style={{fontSize: '10px', color: '#666'}}>({evt.detalhe})</span></td><td style={{textAlign: 'right'}}>R$ {evt.valor.toLocaleString('pt-BR', {minimumFractionDigits: 2})}</td><td style={{textAlign: 'center'}}>{evt.status === 'ignorado' ? 'HISTÓRICO' : (evt.status === 'pago' ? 'PAGO' : evt.status === 'pendente_financeiro' ? 'PENDENTE' : 'A PAGAR')}</td></tr>))}
                            <tr className="print-total-row"><td colSpan={3}>TOTAL DO PERÍODO</td><td style={{textAlign: 'right'}}>R$ {custoTotalPeriodoInd.toLocaleString('pt-BR', {minimumFractionDigits: 2})}</td><td></td></tr>
                        </tbody>
                    </table>
                </div>
            )}
            {modoImpressao === 'geral' && (
                <div>
                    <div className="print-section-title">Resumo Geral - {funcionariosAtivos} Funcionários Ativos</div>
                    <table className="print-table">
                        <thead><tr><th style={{width: '12%'}}>Data Prevista</th><th style={{width: '25%'}}>Funcionário</th><th style={{width: '25%'}}>Evento</th><th style={{width: '18%'}}>Competência</th><th style={{textAlign: 'right', width: '12%'}}>Valor</th><th style={{textAlign: 'center', width: '8%'}}>Status</th></tr></thead>
                        <tbody>
                            {relatorioGeral.length === 0 ? (<tr><td colSpan={6} style={{textAlign: 'center', padding: '20px', fontStyle: 'italic'}}>Nenhum lançamento encontrado para o período selecionado.</td></tr>) : (relatorioGeral.map((evt, idx) => (<tr key={idx}><td>{format(evt.data_pagamento, 'dd/MM/yyyy')}</td><td>{evt.funcionario}</td><td>{evt.tipo}</td><td style={{textTransform: 'capitalize'}}>{evt.referencia}</td><td style={{textAlign: 'right'}}>R$ {evt.valor.toLocaleString('pt-BR', {minimumFractionDigits: 2})}</td><td style={{textAlign: 'center', fontSize: '10px'}}>{evt.status}</td></tr>)))}
                            <tr className="print-total-row"><td colSpan={4}>TOTAL GERAL DO PERÍODO (Exceto Histórico)</td><td style={{textAlign: 'right'}}>R$ {totalGeralPeriodo.toLocaleString('pt-BR', {minimumFractionDigits: 2})}</td><td></td></tr>
                        </tbody>
                    </table>
                </div>
            )}
        </div>, document.body
      )}

      <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-4 bg-white p-4 rounded-[1.5rem] border border-stone-100 shadow-sm no-print">
        <div><h1 className="text-2xl font-bold text-stone-900 tracking-tight">Funcionários</h1><p className="text-stone-500 font-medium">Gestão de equipe e folha inteligente</p></div>
        <div className="flex gap-2">
            <Button variant="outline" className="rounded-xl border-stone-200 text-stone-600 hover:bg-stone-50" onClick={() => setRelatorioGeralOpen(true)}><FileText className="w-4 h-4 mr-2" /> Relatório Geral (Todos)</Button>
            <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild><Button className="bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl h-10 px-5 shadow-lg shadow-emerald-100 transition-all active:scale-95 ml-2"><Plus className="w-4 h-4 mr-2" /> Novo Funcionário</Button></DialogTrigger>
            <DialogContent className="sm:max-w-lg rounded-[2rem]">
                <DialogHeader>
                    <DialogTitle>{editingFuncionario ? 'Editar' : 'Novo'} Funcionário</DialogTitle>
                    <DialogDescription>Insira os dados do funcionário abaixo.</DialogDescription>
                </DialogHeader>
                <form onSubmit={handleSubmit} className="space-y-4 pt-4">
                <div className="space-y-2"><Label>Nome</Label><Input value={formData.nome} onChange={(e) => setFormData({ ...formData, nome: e.target.value })} className="rounded-xl" required /></div>
                <div className="grid grid-cols-2 gap-4"><div className="space-y-2"><Label>Cargo</Label><Input value={formData.cargo} onChange={(e) => setFormData({ ...formData, cargo: e.target.value })} className="rounded-xl" required /></div><div className="space-y-2"><Label>Salário (R$)</Label><Input type="number" step="0.01" value={formData.salario} onChange={(e) => setFormData({ ...formData, salario: e.target.value })} className="rounded-xl" required /></div></div>
                
                {/* LINHA DE DATAS: ADMISSÃO E CONTABILIDADE */}
                <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2"><Label>Admissão</Label><Input type="date" value={formData.data_admissao} onChange={(e) => setFormData({ ...formData, data_admissao: e.target.value })} className="rounded-xl" required /></div>
                    <div className="space-y-2">
                        <Label className="flex items-center gap-1">Início Contabilização <span className="text-stone-400 font-normal text-xs">(Opcional)</span></Label>
                        <Input type="date" value={formData.data_inicio_contabil} onChange={(e) => setFormData({ ...formData, data_inicio_contabil: e.target.value })} className="rounded-xl" placeholder="Para Dashboard" />
                    </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2"><Label>Telefone</Label><Input value={formData.telefone} onChange={(e) => setFormData({ ...formData, telefone: e.target.value })} className="rounded-xl" /></div>
                    <div className="space-y-2"><Label>Talhão</Label><Select value={formData.talhao_principal || "none"} onValueChange={(v) => setFormData({ ...formData, talhao_principal: v === "none" ? null : v })}><SelectTrigger className="rounded-xl"><SelectValue placeholder="Selecione" /></SelectTrigger><SelectContent><SelectItem value="none">Nenhum (Rateio Geral)</SelectItem>{talhoes.map((t) => <SelectItem key={t.id} value={t.id}>{t.nome}</SelectItem>)}</SelectContent></Select></div>
                </div>
                
                <div className="space-y-2">
                    <Label>Status</Label>
                    <Select value={formData.status} onValueChange={(v) => setFormData({ ...formData, status: v })}><SelectTrigger className="rounded-xl"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="ativo">Ativo</SelectItem><SelectItem value="inativo">Inativo</SelectItem><SelectItem value="ferias">Férias</SelectItem></SelectContent></Select>
                </div>

                <div className="flex justify-end gap-3 pt-4"><Button type="button" variant="outline" onClick={resetForm} className="rounded-xl">Cancelar</Button><Button type="submit" className="bg-emerald-600 hover:bg-emerald-700 rounded-xl px-8" disabled={createMutation.isPending || updateMutation.isPending}>Salvar</Button></div>
                </form>
            </DialogContent>
            </Dialog>
        </div>
        
        {/* Outros Dialogs omitidos por brevidade (sem mudanças funcionais neles, apenas mantidos) */}
        <Dialog open={relatorioGeralOpen} onOpenChange={setRelatorioGeralOpen}>
            <DialogContent className="sm:max-w-md rounded-[2rem]">
                <DialogHeader><DialogTitle>Imprimir Relatório Geral</DialogTitle><DialogDescription>Selecione o período para gerar a folha de todos os funcionários.</DialogDescription></DialogHeader>
                <div className="space-y-4 py-4"><div className="grid grid-cols-2 gap-4"><div className="space-y-2"><Label>Data Início</Label><Input type="date" value={filtroInicio} onChange={(e) => setFiltroInicio(e.target.value)} className="rounded-xl" /></div><div className="space-y-2"><Label>Data Fim</Label><Input type="date" value={filtroFim} onChange={(e) => setFiltroFim(e.target.value)} className="rounded-xl" /></div></div><div className="bg-blue-50 p-4 rounded-xl text-xs text-blue-700">O relatório incluirá todos os eventos previstos ou pagos dentro deste intervalo.</div></div>
                <DialogFooter><Button variant="outline" onClick={() => setRelatorioGeralOpen(false)} className="rounded-xl">Cancelar</Button><Button onClick={() => { handlePrint('geral'); setRelatorioGeralOpen(false); }} className="bg-stone-800 text-white rounded-xl hover:bg-stone-900"><Printer className="w-4 h-4 mr-2" /> Gerar Impressão</Button></DialogFooter>
            </DialogContent>
        </Dialog>

        <Dialog open={folhaOpen} onOpenChange={setFolhaOpen}>
          <DialogContent className="max-w-6xl max-h-[90vh] overflow-y-auto rounded-[2rem]">
            <DialogHeader className="pb-4 border-b border-stone-100">
              <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                  <div><DialogTitle className="text-2xl font-bold flex items-center gap-2 text-stone-800"><div className="p-2 bg-blue-50 text-blue-600 rounded-xl"><Calculator className="w-6 h-6" /></div>Gestão de Folha - {selectedFuncionario?.nome}</DialogTitle><DialogDescription className="mt-1">Use o filtro abaixo para visualizar o custo exato de cada período.</DialogDescription></div>
                  <div className="flex gap-2"><Button size="sm" variant="outline" className="rounded-xl border-emerald-200 text-emerald-700 hover:bg-emerald-50" onClick={() => setReajusteOpen(true)}><TrendingUp className="w-4 h-4 mr-2" /> Reajustar</Button><Button size="sm" className="rounded-xl bg-stone-800 text-white hover:bg-stone-900" onClick={() => handlePrint('individual')}><Printer className="w-4 h-4 mr-2" /> Imprimir Extrato</Button></div>
              </div>
            </DialogHeader>
            {selectedFuncionario && (
              <div className="space-y-6 pt-2">
                <div className="bg-stone-50 p-4 rounded-2xl border border-stone-200 flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div className="flex items-center gap-2 text-stone-600"><CalendarRange className="w-5 h-5 text-stone-400" /><span className="text-sm font-bold uppercase tracking-wide">Período de Apuração:</span></div>
                    <div className="flex flex-wrap items-center gap-3"><div className="flex items-center gap-2 bg-white px-3 py-1.5 rounded-xl border border-stone-200 shadow-sm"><span className="text-xs text-stone-400 font-bold">DE</span><Input type="date" value={filtroInicio} onChange={(e) => setFiltroInicio(e.target.value)} className="h-8 w-32 border-none p-0 text-sm font-semibold text-stone-700 focus-visible:ring-0" /></div><div className="flex items-center gap-2 bg-white px-3 py-1.5 rounded-xl border border-stone-200 shadow-sm"><span className="text-xs text-stone-400 font-bold">ATÉ</span><Input type="date" value={filtroFim} onChange={(e) => setFiltroFim(e.target.value)} className="h-8 w-32 border-none p-0 text-sm font-semibold text-stone-700 focus-visible:ring-0" /></div></div>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
                    <div className="bg-emerald-50 p-5 rounded-2xl border border-emerald-100 relative overflow-hidden group"><p className="text-[10px] font-bold text-emerald-600 uppercase tracking-widest mb-1">Total Salários</p><p className="text-xl font-black text-emerald-700">R$ {totalSalariosInd.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</p><p className="text-[10px] text-emerald-600/60 mt-1 font-medium">No período selecionado</p></div>
                    <div className="bg-amber-50 p-5 rounded-2xl border border-amber-100 relative overflow-hidden group"><p className="text-[10px] font-bold text-amber-600 uppercase tracking-widest mb-1">Total 13º Salário</p><p className="text-xl font-black text-amber-700">R$ {totalDecimoInd.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</p><p className="text-[10px] text-amber-600/60 mt-1 font-medium">No período selecionado</p></div>
                    <div className="bg-blue-50 p-5 rounded-2xl border border-blue-100 relative overflow-hidden group"><p className="text-[10px] font-bold text-blue-600 uppercase tracking-widest mb-1">Total Férias</p><p className="text-xl font-black text-blue-700">R$ {totalFeriasInd.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</p><p className="text-[10px] text-blue-600/60 mt-1 font-medium">No período selecionado</p></div>
                    <div className="bg-stone-800 p-5 rounded-2xl border border-stone-700 relative overflow-hidden shadow-lg group"><div className="absolute right-0 top-0 p-3 opacity-10"><Calculator className="w-12 h-12 text-white" /></div><p className="text-[10px] font-bold text-stone-400 uppercase tracking-widest mb-1">Custo Total</p><p className="text-xl font-black text-white">R$ {custoTotalPeriodoInd.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</p><p className="text-[10px] text-stone-400 mt-1 font-medium">Soma de todos os encargos</p></div>
                </div>
                <div className="rounded-[2rem] border border-stone-100 overflow-hidden shadow-sm">
                  <Table>
                    <TableHeader className="bg-stone-50"><TableRow><TableHead className="pl-6">Competência</TableHead><TableHead>Tipo</TableHead><TableHead>Vencimento</TableHead><TableHead>Detalhes</TableHead><TableHead className="text-right">Valor</TableHead><TableHead className="text-center">Status</TableHead><TableHead className="text-right pr-6 no-print">Ação</TableHead></TableRow></TableHeader>
                    <TableBody>
                      {eventosFolhaIndividual.map((evento, index) => (
                        <TableRow key={index} className="hover:bg-stone-50 transition-colors">
                          <TableCell className="pl-6 font-medium text-stone-700 capitalize">{evento.referencia}</TableCell>
                          <TableCell><Badge variant="outline" className="bg-white border-stone-200 text-stone-600 font-medium">{evento.tipo}</Badge></TableCell>
                          <TableCell className="text-stone-600 text-sm">{format(evento.data_pagamento, 'dd/MM/yyyy')}</TableCell>
                          <TableCell className="text-xs text-stone-500 max-w-[200px] truncate" title={evento.detalhe}>{evento.detalhe}</TableCell>
                          <TableCell className="text-right font-bold text-stone-800">R$ {evento.valor.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</TableCell>
                          <TableCell className="text-center">
                            {evento.status === 'ignorado' && <Badge variant="outline" className="bg-stone-100 text-stone-400 border-stone-200">HISTÓRICO</Badge>}
                            {evento.status === 'pago' && <Badge className="bg-emerald-100 text-emerald-700 border-emerald-200 border">PAGO</Badge>}
                            {evento.status === 'pendente_financeiro' && <Badge className="bg-amber-100 text-amber-700 border-amber-200 border">PENDENTE</Badge>}
                            {evento.status === 'pendente_lancamento' && <Badge className="bg-red-50 text-red-600 border-red-200 border">A LANÇAR</Badge>}
                            {evento.status === 'provisionado' && <Badge variant="outline" className="text-stone-400 border-stone-200">FUTURO</Badge>}
                          </TableCell>
                          <TableCell className="text-right pr-6 no-print">
                            {evento.status === 'ignorado' ? (
                                <span className="text-xs text-stone-300 italic flex justify-end items-center gap-1"><Lock className="w-3 h-3"/> Bloqueado</span>
                            ) : (
                                (evento.status === 'pago' || evento.status === 'pendente_financeiro') ? (
                                    <div className="flex justify-end"><Select defaultValue={evento.status === 'pago' ? 'pago' : 'pendente'} onValueChange={(valor) => atualizarStatusCustoMutation.mutate({ id: evento.custoId, novoStatus: valor })}><SelectTrigger className="h-8 w-[110px] text-xs font-bold border-stone-200 bg-white shadow-sm"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="pago" className="text-emerald-700 font-bold">Pago</SelectItem><SelectItem value="pendente" className="text-amber-700 font-bold">Pendente</SelectItem></SelectContent></Select></div>
                                ) : (
                                    <div className="flex justify-end gap-2"><Button size="sm" variant="outline" className="h-8 text-xs font-bold text-amber-600 border-amber-200 hover:bg-amber-50 rounded-lg" onClick={() => { if(confirm(`Lançar como PENDENTE?`)) lancarCustoMutation.mutate({ evento, statusInicial: 'pendente' }); }}>Pendente</Button><Button size="sm" className="h-8 text-xs font-bold bg-emerald-600 hover:bg-emerald-700 rounded-lg" onClick={() => { if(confirm(`Lançar como PAGO?`)) lancarCustoMutation.mutate({ evento, statusInicial: 'pago' }); }}>Pago</Button></div>
                                )
                            )}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </div>
            )}
          </DialogContent>
        </Dialog>
        <Dialog open={reajusteOpen} onOpenChange={setReajusteOpen}>
            <DialogContent className="sm:max-w-sm rounded-[2rem] no-print">
                <DialogHeader><DialogTitle>Reajustar Salário</DialogTitle><DialogDescription>Informe o novo valor do salário.</DialogDescription></DialogHeader>
                <div className="space-y-4 py-4"><div className="space-y-2"><Label>Novo Valor</Label><Input type="number" step="0.01" value={reajusteData.novo_salario} onChange={(e) => setReajusteData({...reajusteData, novo_salario: e.target.value})} className="rounded-xl"/></div><div className="space-y-2"><Label>Data Vigência</Label><Input type="date" value={reajusteData.data_vigencia} onChange={(e) => setReajusteData({...reajusteData, data_vigencia: e.target.value})} className="rounded-xl"/></div></div>
                <DialogFooter><Button variant="outline" onClick={() => setReajusteOpen(false)} className="rounded-xl">Cancelar</Button><Button onClick={() => reajusteMutation.mutate()} className="bg-emerald-600 hover:bg-emerald-700 rounded-xl">Confirmar</Button></DialogFooter>
            </DialogContent>
        </Dialog>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 no-print">
        <StatCard title="Equipe Total" value={totalFuncionarios} icon={Users} />
        <StatCard title="Ativos Hoje" value={funcionariosAtivos} icon={User} color="text-emerald-600" />
        <StatCard title="Folha Base Mensal" value={`R$ ${totalFolhaBase.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`} icon={Briefcase} color="text-amber-600" />
      </div>
      {funcionarios.length === 0 ? (
        <EmptyState icon={Users} title="Nenhum funcionário" onAction={() => setOpen(true)} actionLabel="Cadastrar" />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 no-print">
          {funcionarios.map((funcionario) => (
            <Card key={funcionario.id} className="border-stone-100 rounded-[2rem] shadow-sm hover:shadow-lg transition-all bg-white overflow-hidden border border-stone-100">
              <CardHeader className="pb-3 bg-stone-50/50 border-b border-stone-50">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-4">
                    <div className="w-14 h-14 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-2xl flex items-center justify-center shadow-lg shadow-blue-200 transition-transform group-hover:scale-105"><span className="text-xl font-bold text-white">{funcionario.nome?.charAt(0).toUpperCase()}</span></div>
                    <div><CardTitle className="text-xl font-bold text-stone-800">{funcionario.nome}</CardTitle><p className="text-sm font-semibold text-stone-400 uppercase tracking-wider">{funcionario.cargo}</p></div>
                  </div>
                  <Badge variant="outline" className={`rounded-full border ${statusLabels[funcionario.status]?.color}`}>{statusLabels[funcionario.status]?.label}</Badge>
                </div>
              </CardHeader>
              <CardContent className="space-y-4 pt-4">
                <div className="grid grid-cols-1 gap-2 bg-stone-50 p-4 rounded-2xl border border-stone-100">
                  <div className="flex items-center gap-2 text-sm font-medium text-stone-600"><Phone className="w-4 h-4 text-stone-400" /> {funcionario.telefone || '-'}</div>
                  <div className="flex items-center gap-2 text-sm font-medium text-stone-600"><Calendar className="w-4 h-4 text-stone-400" /> Adm: {funcionario.data_admissao ? format(new Date(funcionario.data_admissao + 'T12:00:00'), 'dd/MM/yyyy') : '-'}</div>
                  <div className="flex items-center gap-2 text-sm font-bold text-emerald-600"><Briefcase className="w-4 h-4" /> Atual: R$ {funcionario.salario?.toLocaleString('pt-BR') || '0,00'}</div>
                </div>
                <Button variant="outline" className="w-full rounded-xl border-blue-200 text-blue-700 hover:bg-blue-50 hover:text-blue-800 font-bold" onClick={() => { setSelectedFuncionario(funcionario); setFolhaOpen(true); }}><Calculator className="w-4 h-4 mr-2" /> Folha & Financeiro</Button>
                <div className="flex gap-2"><Button variant="secondary" size="sm" className="flex-1 rounded-xl font-bold hover:bg-stone-100 transition-colors" onClick={() => handleEdit(funcionario)}><Edit className="w-4 h-4 mr-2" /> Editar</Button><Button variant="ghost" size="sm" className="rounded-xl text-red-400 hover:bg-red-50 hover:text-red-600" onClick={() => { if(confirm("Tem certeza que deseja excluir este funcionário? Isso removerá também seus lançamentos financeiros.")) deleteMutation.mutate(funcionario.id); }}><Trash2 className="w-4 h-4" /></Button></div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}