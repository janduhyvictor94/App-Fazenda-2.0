import React, { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabaseClient';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Plus, Edit, Trash2, Users, Phone, Calendar, Briefcase, User, Calculator, ArrowRight, TrendingUp, DollarSign, CheckCircle2, Clock, AlertCircle } from 'lucide-react';
import EmptyState from '@/components/ui/EmptyState';
import StatCard from '@/components/ui/StatCard';
import { format, addMonths, startOfMonth, isWeekend, isBefore, differenceInMonths, setDate, isAfter, isSameMonth, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';

const statusLabels = {
  ativo: { label: 'Ativo', color: 'bg-emerald-50 text-emerald-700 border-emerald-100' },
  inativo: { label: 'Inativo', color: 'bg-stone-50 text-stone-700 border-stone-100' },
  ferias: { label: 'Férias', color: 'bg-blue-50 text-blue-700 border-blue-100' }
};

// --- LÓGICA DE CÁLCULO ---

const getSalarioNaData = (historico, salarioAtual, dataReferencia) => {
  if (!historico || !Array.isArray(historico) || historico.length === 0) {
    return salarioAtual;
  }
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
  const limiteFuturo = addMonths(hoje, 12); 
  
  let eventos = [];
  let cursor = new Date(admissao);
  cursor.setDate(1); 

  while (isBefore(cursor, limiteFuturo)) {
    const salarioVigente = getSalarioNaData(funcionario.historico_salarial, funcionario.salario, cursor);
    const dataPagamentoSalario = getQuintoDiaUtil(cursor);
    
    const idLogicoSalario = `salario-${format(cursor, 'yyyy-MM')}`;

    eventos.push({
      id: idLogicoSalario,
      tipo: 'Salário Mensal',
      referencia: format(cursor, 'MMMM/yyyy', { locale: ptBR }),
      data_pagamento: dataPagamentoSalario,
      valor: salarioVigente,
      detalhe: `Base: R$ ${salarioVigente.toLocaleString('pt-BR')}`
    });

    if (cursor.getMonth() === 11) {
      const anoCursor = cursor.getFullYear();
      const dataDecimo = new Date(anoCursor, 11, 10);
      let mesesTrabalhados = 12;
      if (anoCursor === admissao.getFullYear()) {
        mesesTrabalhados = 12 - admissao.getMonth();
        if (admissao.getDate() > 15) mesesTrabalhados -= 1; 
        if (mesesTrabalhados < 0) mesesTrabalhados = 0;
      }
      const valorDecimo = (salarioVigente / 12) * mesesTrabalhados;
      
      if (valorDecimo > 0) {
        eventos.push({
          id: `13-${anoCursor}`,
          tipo: '13º Salário',
          referencia: `Exercício ${anoCursor}`,
          data_pagamento: dataDecimo,
          valor: valorDecimo,
          detalhe: `Prop. ${mesesTrabalhados}/12`
        });
      }
    }

    const mesesDeCasa = differenceInMonths(cursor, admissao);
    if (mesesDeCasa > 0 && mesesDeCasa % 12 === 0) {
       const dataPagamentoFerias = addMonths(cursor, 1);
       const salarioFerias = getSalarioNaData(funcionario.historico_salarial, funcionario.salario, dataPagamentoFerias);
       const bonusFerias = salarioFerias * 0.30; 
       const totalFerias = salarioFerias + bonusFerias;

       eventos.push({
         id: `ferias-${format(cursor, 'yyyy-MM')}`,
         tipo: 'Férias (1 Ano)',
         referencia: `Período ${format(addMonths(cursor, -12), 'MM/yy')} a ${format(cursor, 'MM/yy')}`,
         data_pagamento: dataPagamentoFerias,
         valor: totalFerias,
         detalhe: `Salário + 30%`
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
  
  const [editingFuncionario, setEditingFuncionario] = useState(null);
  const [selectedFuncionario, setSelectedFuncionario] = useState(null);
  
  const [formData, setFormData] = useState({
    nome: '',
    cargo: '',
    salario: '',
    data_admissao: '',
    status: 'ativo',
    telefone: '',
    talhao_principal: '',
    observacoes: ''
  });

  const [reajusteData, setReajusteData] = useState({
    novo_salario: '',
    data_vigencia: format(new Date(), 'yyyy-MM-dd')
  });

  const queryClient = useQueryClient();

  const { data: talhoes = [] } = useQuery({
    queryKey: ['talhoes'],
    queryFn: async () => {
      const { data } = await supabase.from('talhoes').select('*');
      return data || [];
    }
  });

  const { data: funcionarios = [] } = useQuery({
    queryKey: ['funcionarios'],
    queryFn: async () => {
      const { data } = await supabase.from('funcionarios').select('*');
      return data || [];
    }
  });

  const { data: custosFuncionario = [] } = useQuery({
    queryKey: ['custos_funcionario', selectedFuncionario?.id],
    enabled: !!selectedFuncionario,
    queryFn: async () => {
        const { data, error } = await supabase
            .from('custos')
            .select('*')
            .eq('categoria', 'funcionario')
            .ilike('descricao', `%${selectedFuncionario.nome}%`);
        
        if (error) throw error;
        return data || [];
    }
  });

  // --- MUTAÇÕES ---
  const createMutation = useMutation({
    mutationFn: async (data) => {
      const payload = {
        ...data,
        historico_salarial: [{
            valor: data.salario,
            data_vigencia: data.data_admissao
        }]
      };
      const { error } = await supabase.from('funcionarios').insert([payload]);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['funcionarios'] });
      resetForm();
    }
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }) => {
      const { error } = await supabase.from('funcionarios').update(data).eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['funcionarios'] });
      resetForm();
    }
  });

  const reajusteMutation = useMutation({
    mutationFn: async () => {
        if (!selectedFuncionario || !reajusteData.novo_salario) return;
        
        const historicoAtual = selectedFuncionario.historico_salarial || [];
        const novoRegistro = {
            valor: parseFloat(reajusteData.novo_salario),
            data_vigencia: reajusteData.data_vigencia
        };

        const payload = {
            salario: parseFloat(reajusteData.novo_salario),
            historico_salarial: [...historicoAtual, novoRegistro]
        };

        const { error } = await supabase
            .from('funcionarios')
            .update(payload)
            .eq('id', selectedFuncionario.id);
            
        if (error) throw error;
    },
    onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: ['funcionarios'] });
        setReajusteOpen(false);
        const updatedFunc = {
            ...selectedFuncionario,
            salario: parseFloat(reajusteData.novo_salario),
            historico_salarial: [...(selectedFuncionario.historico_salarial || []), {
                valor: parseFloat(reajusteData.novo_salario),
                data_vigencia: reajusteData.data_vigencia
            }]
        };
        setSelectedFuncionario(updatedFunc);
        alert("Salário reajustado com sucesso!");
    }
  });

  // *** MUTAÇÃO DE EXCLUSÃO COM INTEGRAÇÃO FINANCEIRA ***
  const deleteMutation = useMutation({
    mutationFn: async (id) => {
      // 1. Busca os dados do funcionário para pegar o nome
      const { data: func, error: fetchError } = await supabase
        .from('funcionarios')
        .select('nome')
        .eq('id', id)
        .single();
      
      if (fetchError) throw fetchError;

      // 2. Apaga os custos associados no Financeiro
      // Procura custos da categoria 'funcionario' que tenham o nome na descrição
      if (func && func.nome) {
        const { error: deleteCustosError } = await supabase
            .from('custos')
            .delete()
            .eq('categoria', 'funcionario')
            .ilike('descricao', `%${func.nome}%`);
            
        if (deleteCustosError) console.error("Erro ao apagar custos:", deleteCustosError);
      }

      // 3. Apaga o funcionário
      const { error } = await supabase.from('funcionarios').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: ['funcionarios'] });
        // Também invalida custos para atualizar dashboard se necessário
        queryClient.invalidateQueries({ queryKey: ['custos'] }); 
        alert("Funcionário e seus lançamentos financeiros foram removidos.");
    },
    onError: (error) => {
        alert(`Erro ao excluir: ${error.message}`);
    }
  });

  const lancarCustoMutation = useMutation({
    mutationFn: async ({ evento, statusInicial }) => {
      if (!selectedFuncionario) return;
      
      const payload = {
        descricao: `Folha: ${evento.tipo} - ${selectedFuncionario.nome}`,
        categoria: 'funcionario',
        valor: parseFloat(evento.valor.toFixed(2)),
        data: format(evento.data_pagamento, 'yyyy-MM-dd'),
        status_pagamento: statusInicial,
        tipo_lancamento: 'despesa',
        observacoes: `Ref: ${evento.referencia}. ${evento.detalhe}`,
        talhao_id: selectedFuncionario.talhao_principal || null 
      };

      const { error } = await supabase.from('custos').insert([payload]);
      
      if (error) {
        console.error("Erro detalhado Supabase:", error);
        throw new Error(error.message || "Erro desconhecido ao lançar");
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['custos_funcionario'] });
    },
    onError: (error) => {
        alert(`Não foi possível lançar no financeiro.\nErro: ${error.message}`);
    }
  });

  // --- HANDLERS ---
  const resetForm = () => {
    setFormData({ nome: '', cargo: '', salario: '', data_admissao: '', status: 'ativo', telefone: '', talhao_principal: '', observacoes: '' });
    setEditingFuncionario(null);
    setOpen(false);
  };

  const handleEdit = (funcionario) => {
    setEditingFuncionario(funcionario);
    setFormData({
      nome: funcionario.nome || '',
      cargo: funcionario.cargo || '',
      salario: funcionario.salario || '',
      data_admissao: funcionario.data_admissao || '',
      status: funcionario.status || 'ativo',
      telefone: funcionario.telefone || '',
      talhao_principal: funcionario.talhao_principal || '',
      observacoes: funcionario.observacoes || ''
    });
    setOpen(true);
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    let data = {
      ...formData,
      salario: formData.salario ? parseFloat(formData.salario) : null,
      talhao_principal: formData.talhao_principal || null
    };

    if (editingFuncionario) {
      if (editingFuncionario.salario !== data.salario) {
         let historico = editingFuncionario.historico_salarial ? [...editingFuncionario.historico_salarial] : [];
         if (historico.length === 0) {
            historico.push({ valor: data.salario, data_vigencia: data.data_admissao });
         } else {
            const indexAdmissao = historico.findIndex(h => h.data_vigencia === editingFuncionario.data_admissao);
            if (indexAdmissao !== -1) {
                historico[indexAdmissao].valor = data.salario;
                historico[indexAdmissao].data_vigencia = data.data_admissao;
            } else {
                if (historico.length === 1) {
                    historico[0].valor = data.salario;
                    historico[0].data_vigencia = data.data_admissao;
                } else {
                    const indexValorAntigo = historico.findIndex(h => parseFloat(h.valor) === parseFloat(editingFuncionario.salario));
                    if (indexValorAntigo !== -1) historico[indexValorAntigo].valor = data.salario;
                    else historico.push({ valor: data.salario, data_vigencia: data.data_admissao });
                }
            }
         }
         data.historico_salarial = historico;
      } else {
          if (editingFuncionario.data_admissao !== data.data_admissao) {
               let historico = editingFuncionario.historico_salarial ? [...editingFuncionario.historico_salarial] : [];
               const indexAdmissao = historico.findIndex(h => h.data_vigencia === editingFuncionario.data_admissao);
               if (indexAdmissao !== -1) {
                   historico[indexAdmissao].data_vigencia = data.data_admissao;
                   data.historico_salarial = historico;
               }
          }
      }
      updateMutation.mutate({ id: editingFuncionario.id, data });
    } else {
      createMutation.mutate(data);
    }
  };

  const eventosFolha = useMemo(() => {
    if (!selectedFuncionario) return [];
    
    const calculados = calcularFolha(selectedFuncionario);
    const hoje = new Date();

    return calculados.map(evento => {
        const custoEncontrado = custosFuncionario.find(custo => {
            const dataCusto = parseISO(custo.data);
            return isSameMonth(dataCusto, evento.data_pagamento) && 
                   custo.descricao.includes(evento.tipo);
        });

        let statusFinal = 'provisionado';
        let statusFinanceiro = null; 

        if (custoEncontrado) {
            statusFinanceiro = custoEncontrado.status_pagamento;
            statusFinal = statusFinanceiro === 'pago' ? 'pago' : 'pendente_financeiro';
        } else {
            if (isBefore(evento.data_pagamento, hoje)) {
                statusFinal = 'pendente_lancamento';
            } else {
                statusFinal = 'provisionado';
            }
        }

        return { ...evento, status: statusFinal, custoId: custoEncontrado?.id };
    });

  }, [selectedFuncionario, custosFuncionario]);

  const totalSalarios = eventosFolha.filter(e => e.tipo === 'Salário Mensal' && e.status === 'pago').reduce((acc, e) => acc + e.valor, 0);
  const totalFerias = eventosFolha.filter(e => e.tipo.includes('Férias') && e.status === 'pago').reduce((acc, e) => acc + e.valor, 0);
  const totalDecimo = eventosFolha.filter(e => e.tipo.includes('13º') && e.status === 'pago').reduce((acc, e) => acc + e.valor, 0);
  const totalProjetadoFuturo = eventosFolha.filter(e => e.status === 'provisionado' || e.status === 'pendente_lancamento').reduce((acc, e) => acc + e.valor, 0);

  const totalFuncionarios = funcionarios.length;
  const funcionariosAtivos = funcionarios.filter(f => f.status === 'ativo').length;
  const totalFolhaBase = funcionarios.filter(f => f.status === 'ativo').reduce((acc, f) => acc + (f.salario || 0), 0);

  return (
    <div className="space-y-8">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-stone-900 tracking-tight">Funcionários</h1>
          <p className="text-stone-500 font-medium">Gestão de equipe e folha inteligente</p>
        </div>
        
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button className="bg-blue-600 hover:bg-blue-700 rounded-2xl h-12 px-6 shadow-lg shadow-blue-100">
              <Plus className="w-5 h-5 mr-2" /> Novo Funcionário
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-lg rounded-[2rem]">
            <DialogHeader>
              <DialogTitle className="text-2xl font-bold">{editingFuncionario ? 'Editar' : 'Novo'} Funcionário</DialogTitle>
              <DialogDescription className="sr-only">Formulário.</DialogDescription>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4 pt-4">
              <div className="space-y-2">
                <Label>Nome Completo</Label>
                <Input value={formData.nome} onChange={(e) => setFormData({ ...formData, nome: e.target.value })} className="rounded-xl h-11" required />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Cargo</Label>
                  <Input value={formData.cargo} onChange={(e) => setFormData({ ...formData, cargo: e.target.value })} className="rounded-xl h-11" required />
                </div>
                <div className="space-y-2">
                  <Label>Salário Inicial (R$)</Label>
                  <Input type="number" step="0.01" value={formData.salario} onChange={(e) => setFormData({ ...formData, salario: e.target.value })} className="rounded-xl h-11" required />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Data Admissão</Label>
                  <Input type="date" value={formData.data_admissao} onChange={(e) => setFormData({ ...formData, data_admissao: e.target.value })} className="rounded-xl h-11" required />
                </div>
                <div className="space-y-2">
                  <Label>Status</Label>
                  <Select value={formData.status || ""} onValueChange={(value) => setFormData({ ...formData, status: value })}>
                    <SelectTrigger className="rounded-xl h-11"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="ativo">Ativo</SelectItem>
                      <SelectItem value="inativo">Inativo</SelectItem>
                      <SelectItem value="ferias">Férias</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Telefone</Label>
                  <Input value={formData.telefone} onChange={(e) => setFormData({ ...formData, telefone: e.target.value })} className="rounded-xl h-11" placeholder="(00) 00000-0000" />
                </div>
                <div className="space-y-2">
                  <Label>Talhão Principal</Label>
                  <Select value={formData.talhao_principal || "none"} onValueChange={(value) => setFormData({ ...formData, talhao_principal: value === "none" ? null : value })}>
                    <SelectTrigger className="rounded-xl h-11"><SelectValue placeholder="Selecione" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">Nenhum</SelectItem>
                      {talhoes.map((t) => <SelectItem key={t.id} value={t.id}>{t.nome}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="space-y-2">
                <Label>Observações</Label>
                <Textarea value={formData.observacoes} onChange={(e) => setFormData({ ...formData, observacoes: e.target.value })} className="rounded-xl" rows={2} />
              </div>
              <div className="flex justify-end gap-3 pt-4">
                <Button type="button" variant="ghost" onClick={resetForm} className="rounded-xl">Cancelar</Button>
                <Button type="submit" className="bg-blue-600 rounded-xl px-8" disabled={createMutation.isPending || updateMutation.isPending}>{editingFuncionario ? 'Salvar' : 'Cadastrar'}</Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>

        <Dialog open={folhaOpen} onOpenChange={setFolhaOpen}>
          <DialogContent className="max-w-6xl max-h-[90vh] overflow-y-auto rounded-[2rem]">
            <DialogHeader>
              <DialogTitle className="text-2xl font-bold flex items-center justify-between text-stone-800">
                <div className="flex items-center gap-2">
                    <Calculator className="w-6 h-6 text-blue-600" />
                    Gestão de Folha & Financeiro
                </div>
                {selectedFuncionario && (
                    <Button 
                        size="sm" 
                        variant="outline" 
                        className="bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100"
                        onClick={() => setReajusteOpen(true)}
                    >
                        <TrendingUp className="w-4 h-4 mr-2" />
                        Reajustar Salário
                    </Button>
                )}
              </DialogTitle>
              <DialogDescription>
                Histórico salarial integrado ao módulo Financeiro.
              </DialogDescription>
            </DialogHeader>
            
            {selectedFuncionario && (
              <div className="space-y-6 pt-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
                    <div className="bg-emerald-50 p-4 rounded-2xl border border-emerald-100 relative overflow-hidden">
                        <div className="absolute right-0 top-0 p-3 opacity-10"><DollarSign className="w-12 h-12 text-emerald-600" /></div>
                        <p className="text-xs font-bold text-emerald-600 uppercase tracking-wider mb-1">Salários (Pago)</p>
                        <p className="text-lg font-black text-emerald-700">R$ {totalSalarios.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</p>
                    </div>
                    <div className="bg-amber-50 p-4 rounded-2xl border border-amber-100 relative overflow-hidden">
                        <div className="absolute right-0 top-0 p-3 opacity-10"><DollarSign className="w-12 h-12 text-amber-600" /></div>
                        <p className="text-xs font-bold text-amber-600 uppercase tracking-wider mb-1">13º (Pago)</p>
                        <p className="text-lg font-black text-amber-700">R$ {totalDecimo.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</p>
                    </div>
                    <div className="bg-blue-50 p-4 rounded-2xl border border-blue-100 relative overflow-hidden">
                         <div className="absolute right-0 top-0 p-3 opacity-10"><DollarSign className="w-12 h-12 text-blue-600" /></div>
                        <p className="text-xs font-bold text-blue-600 uppercase tracking-wider mb-1">Férias (Pago)</p>
                        <p className="text-lg font-black text-blue-700">R$ {totalFerias.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</p>
                    </div>
                    <div className="bg-stone-100 p-4 rounded-2xl border border-stone-200 relative overflow-hidden">
                        <p className="text-xs font-bold text-stone-500 uppercase tracking-wider mb-1">Pendente / Futuro</p>
                        <p className="text-lg font-black text-stone-600">R$ {totalProjetadoFuturo.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</p>
                    </div>
                </div>

                <div className="rounded-2xl border border-stone-100 overflow-hidden shadow-sm">
                  <Table>
                    <TableHeader className="bg-stone-50">
                      <TableRow>
                        <TableHead className="pl-6">Competência</TableHead>
                        <TableHead>Tipo</TableHead>
                        <TableHead>Vencimento</TableHead>
                        <TableHead>Detalhes</TableHead>
                        <TableHead className="text-right">Valor</TableHead>
                        <TableHead className="text-center">Status</TableHead>
                        <TableHead className="text-right pr-6">Ação</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {eventosFolha.map((evento, index) => (
                        <TableRow key={index} className="hover:bg-stone-50 transition-colors">
                          <TableCell className="pl-6 font-medium text-stone-700 capitalize">
                            {evento.referencia}
                          </TableCell>
                          <TableCell>
                            <Badge variant="outline" className={
                                evento.tipo.includes('Salário') ? 'bg-white text-emerald-700 border-emerald-200' :
                                evento.tipo.includes('13º') ? 'bg-white text-amber-700 border-amber-200' :
                                'bg-white text-blue-700 border-blue-200'
                            }>
                                {evento.tipo}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-stone-600 text-sm">
                            {format(evento.data_pagamento, 'dd/MM/yyyy')}
                          </TableCell>
                          <TableCell className="text-xs text-stone-500 max-w-[200px] truncate" title={evento.detalhe}>
                            {evento.detalhe}
                          </TableCell>
                          <TableCell className="text-right font-bold text-stone-800">
                            R$ {evento.valor.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                          </TableCell>
                          <TableCell className="text-center">
                            {evento.status === 'pago' && (
                                <Badge className="bg-emerald-100 text-emerald-700 border-emerald-200 hover:bg-emerald-200">
                                    <CheckCircle2 className="w-3 h-3 mr-1" /> PAGO
                                </Badge>
                            )}
                            {evento.status === 'pendente_financeiro' && (
                                <Badge className="bg-amber-100 text-amber-700 border-amber-200 hover:bg-amber-200">
                                    <Clock className="w-3 h-3 mr-1" /> PENDENTE
                                </Badge>
                            )}
                            {evento.status === 'pendente_lancamento' && (
                                <Badge className="bg-red-50 text-red-600 border-red-200 hover:bg-red-100">
                                    NÃO LANÇADO
                                </Badge>
                            )}
                            {evento.status === 'provisionado' && (
                                <Badge variant="outline" className="text-stone-400 border-stone-200">
                                    FUTURO
                                </Badge>
                            )}
                          </TableCell>
                          <TableCell className="text-right pr-6">
                            {evento.status === 'pago' || evento.status === 'pendente_financeiro' ? (
                                <span className="text-xs text-stone-400 font-medium select-none">
                                    Já no Financeiro
                                </span>
                            ) : (
                                <div className="flex justify-end gap-2">
                                    <Button 
                                    size="sm" 
                                    variant="outline"
                                    className="h-8 text-xs font-bold text-amber-600 border-amber-200 hover:bg-amber-50"
                                    onClick={() => {
                                        if(confirm(`Lançar como PENDENTE no financeiro?`)) {
                                            lancarCustoMutation.mutate({ evento, statusInicial: 'pendente' });
                                        }
                                    }}
                                    >
                                    Lançar Pendente
                                    </Button>
                                    <Button 
                                    size="sm" 
                                    className="h-8 text-xs font-bold bg-emerald-600 hover:bg-emerald-700"
                                    onClick={() => {
                                        if(confirm(`Lançar como PAGO no financeiro?`)) {
                                            lancarCustoMutation.mutate({ evento, statusInicial: 'pago' });
                                        }
                                    }}
                                    >
                                    Lançar Pago
                                    </Button>
                                </div>
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
            <DialogContent className="sm:max-w-sm rounded-2xl">
                <DialogHeader>
                    <DialogTitle>Reajustar Salário</DialogTitle>
                    <DialogDescription>Atualiza valor e mantém histórico.</DialogDescription>
                </DialogHeader>
                <div className="space-y-4 py-4">
                    <div className="space-y-2">
                        <Label>Novo Salário (R$)</Label>
                        <Input type="number" step="0.01" value={reajusteData.novo_salario} onChange={(e) => setReajusteData({...reajusteData, novo_salario: e.target.value})}/>
                    </div>
                    <div className="space-y-2">
                        <Label>Data de Vigência</Label>
                        <Input type="date" value={reajusteData.data_vigencia} onChange={(e) => setReajusteData({...reajusteData, data_vigencia: e.target.value})}/>
                    </div>
                </div>
                <DialogFooter>
                    <Button variant="outline" onClick={() => setReajusteOpen(false)}>Cancelar</Button>
                    <Button onClick={() => reajusteMutation.mutate()} className="bg-emerald-600 hover:bg-emerald-700">Confirmar</Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
        <StatCard title="Equipe Total" value={totalFuncionarios} icon={Users} />
        <StatCard title="Ativos Hoje" value={funcionariosAtivos} icon={User} color="text-emerald-600" />
        <StatCard title="Folha Base Mensal" value={`R$ ${totalFolhaBase.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`} icon={Briefcase} color="text-amber-600" />
      </div>

      {funcionarios.length === 0 ? (
        <EmptyState icon={Users} title="Nenhum funcionário" onAction={() => setOpen(true)} actionLabel="Cadastrar" />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {funcionarios.map((funcionario) => (
            <Card key={funcionario.id} className="border-none shadow-sm rounded-[2rem] hover:shadow-xl transition-all duration-300 group bg-white overflow-hidden">
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-4">
                    <div className="w-14 h-14 bg-gradient-to-br from-blue-500 to-blue-600 rounded-2xl flex items-center justify-center shadow-lg shadow-blue-100 transition-transform group-hover:rotate-3">
                      <span className="text-xl font-bold text-white">{funcionario.nome?.charAt(0).toUpperCase()}</span>
                    </div>
                    <div>
                      <CardTitle className="text-xl font-bold text-stone-800">{funcionario.nome}</CardTitle>
                      <p className="text-sm font-semibold text-stone-400 uppercase tracking-wider">{funcionario.cargo}</p>
                    </div>
                  </div>
                  <Badge variant="outline" className={`rounded-full px-3 py-1 font-bold border ${statusLabels[funcionario.status]?.color}`}>
                    {statusLabels[funcionario.status]?.label}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 gap-2 bg-stone-50 p-4 rounded-2xl border border-stone-100">
                  <div className="flex items-center gap-2 text-sm font-medium text-stone-600">
                    <Phone className="w-4 h-4 text-stone-400" /> {funcionario.telefone || '(00) 00000-0000'}
                  </div>
                  <div className="flex items-center gap-2 text-sm font-medium text-stone-600">
                    <Calendar className="w-4 h-4 text-stone-400" /> Adm: {funcionario.data_admissao ? format(new Date(funcionario.data_admissao + 'T12:00:00'), 'dd/MM/yyyy') : '-'}
                  </div>
                  <div className="flex items-center gap-2 text-sm font-bold text-emerald-600">
                    <Briefcase className="w-4 h-4" /> Atual: R$ {funcionario.salario?.toLocaleString('pt-BR') || '0,00'}
                  </div>
                </div>
                
                <Button 
                    variant="outline" 
                    className="w-full rounded-xl border-blue-200 text-blue-700 hover:bg-blue-50 hover:text-blue-800 font-bold"
                    onClick={() => { setSelectedFuncionario(funcionario); setFolhaOpen(true); }}
                >
                    <Calculator className="w-4 h-4 mr-2" />
                    Folha & Financeiro
                </Button>

                <div className="flex gap-2">
                  <Button variant="secondary" size="sm" className="flex-1 rounded-xl font-bold hover:bg-stone-100 transition-colors" onClick={() => handleEdit(funcionario)}>
                    <Edit className="w-4 h-4 mr-2" /> Editar
                  </Button>
                  <Button variant="ghost" size="sm" className="rounded-xl text-red-400 hover:bg-red-50 hover:text-red-600" onClick={() => deleteMutation.mutate(funcionario.id)}>
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}