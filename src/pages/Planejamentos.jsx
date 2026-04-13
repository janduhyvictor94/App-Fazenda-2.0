import React, { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabaseClient';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { 
  Plus, Save, Trash2, Calendar, Droplets, Leaf, 
  ShoppingCart, Calculator, CircleDot, ArrowDown, Settings, Trees,
  FileText, Table as TableIcon, Copy, Edit2
} from 'lucide-react';
import EmptyState from '@/components/ui/EmptyState';
import { format } from 'date-fns';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

// Labels amigáveis para os tipos de ciclo e métodos
const cicloLabels = {
  dia: 'Dia',
  semana: 'Semana',
  mes: 'Mês'
};

const metodoConfig = {
  foliar: { label: 'Foliar', icon: Droplets, color: 'text-blue-500', bg: 'bg-blue-50 border-blue-200' },
  adubacao: { label: 'Adubação', icon: Leaf, color: 'text-emerald-500', bg: 'bg-emerald-50 border-emerald-200' }
};

export default function Planejamentos() {
  const queryClient = useQueryClient();
  const [activePlanId, setActivePlanId] = useState('novo');
  const [openNovaPlanilha, setOpenNovaPlanilha] = useState(false);
  
  // Estado para criar um novo planejamento
  const [novoPlan, setNovoPlan] = useState({ nome: '', cultura: 'goiaba', tipo_ciclo: 'dia', quantidade_plantas: '' });
  
  // Estado local da planilha que está sendo editada
  const [planNome, setPlanNome] = useState('');
  const [planCultura, setPlanCultura] = useState('goiaba');
  const [planTipoCiclo, setPlanTipoCiclo] = useState('dia');
  const [planPlantas, setPlanPlantas] = useState('');
  const [planFases, setPlanFases] = useState([]);

  // Estado para o Dialog de Nova Fase
  const [openNovaFase, setOpenNovaFase] = useState(false);
  const [novaFaseMomento, setNovaFaseMomento] = useState('');

  // --- QUERIES ---
  const { data: insumos = [] } = useQuery({
    queryKey: ['insumos'],
    queryFn: async () => {
      const { data, error } = await supabase.from('insumos').select('*').order('nome');
      if (error) throw error; return data;
    }
  });

  const { data: planejamentos = [] } = useQuery({
    queryKey: ['planejamentos'],
    queryFn: async () => {
      const { data, error } = await supabase.from('planejamentos').select('*').order('created_at', { ascending: false });
      if (error) throw error; return data;
    }
  });

  // --- EFFECT: Carregar dados quando seleciona um plano ---
  useEffect(() => {
    if (activePlanId && activePlanId !== 'novo') {
      const plan = planejamentos.find(p => p.id === activePlanId);
      if (plan) {
        setPlanNome(plan.nome);
        setPlanCultura(plan.cultura);
        setPlanTipoCiclo(plan.dados?.tipo_ciclo || 'dia');
        setPlanPlantas(plan.dados?.quantidade_plantas || '');
        setPlanFases(plan.dados?.fases || []);
      }
    } else {
      setPlanNome('');
      setPlanCultura('goiaba');
      setPlanTipoCiclo('dia');
      setPlanPlantas('');
      setPlanFases([]);
    }
  }, [activePlanId, planejamentos]);

  // --- MUTATIONS ---
  const saveMutation = useMutation({
    mutationFn: async (payload) => {
      if (activePlanId === 'novo') {
        const { data, error } = await supabase.from('planejamentos').insert([payload]).select().single();
        if (error) throw error; return data;
      } else {
        const { data, error } = await supabase.from('planejamentos').update(payload).eq('id', activePlanId).select().single();
        if (error) throw error; return data;
      }
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['planejamentos'] });
      setActivePlanId(data.id);
      setOpenNovaPlanilha(false);
      alert('Planejamento salvo com sucesso!');
    }
  });

  const duplicateMutation = useMutation({
    mutationFn: async () => {
      const payload = {
        nome: `${planNome} (Cópia)`,
        cultura: planCultura,
        dados: { 
          tipo_ciclo: planTipoCiclo, 
          quantidade_plantas: planPlantas,
          fases: planFases 
        }
      };
      const { data, error } = await supabase.from('planejamentos').insert([payload]).select().single();
      if (error) throw error; return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['planejamentos'] });
      setActivePlanId(data.id); // Muda automaticamente para a cópia criada
    }
  });

  const deleteMutation = useMutation({
    mutationFn: async (id) => {
      const { error } = await supabase.from('planejamentos').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['planejamentos'] });
      setActivePlanId('novo');
    }
  });

  // --- FUNÇÕES DE CONTROLE ---
  const handleCreateNew = () => {
    if (!novoPlan.nome) return alert('Dê um nome ao planejamento.');
    const payload = {
      nome: novoPlan.nome,
      cultura: novoPlan.cultura,
      dados: { 
        tipo_ciclo: novoPlan.tipo_ciclo, 
        quantidade_plantas: novoPlan.quantidade_plantas,
        fases: [] 
      }
    };
    saveMutation.mutate(payload);
  };

  const handleSaveCurrent = () => {
    if (activePlanId === 'novo') return;
    const payload = { 
      nome: planNome, 
      cultura: planCultura, 
      dados: { 
        tipo_ciclo: planTipoCiclo, 
        quantidade_plantas: planPlantas,
        fases: planFases 
      } 
    };
    saveMutation.mutate(payload);
  };

  const handleAddFase = () => {
    const momento = parseInt(novaFaseMomento);
    if (isNaN(momento)) return;
    
    if (planFases.some(f => f.momento === momento)) {
        alert(`${cicloLabels[planTipoCiclo]} ${momento} já existe!`);
        return;
    }

    const novaFase = {
        id: Date.now().toString(),
        momento: momento,
        nome_etapa: '', 
        aplicacoes: []
    };

    const novasFases = [...planFases, novaFase].sort((a, b) => a.momento - b.momento);
    setPlanFases(novasFases);
    setNovaFaseMomento('');
    setOpenNovaFase(false);
  };

  const handleRemoveFase = (idFase) => {
    if(confirm('Remover esta fase inteira e seus produtos?')) {
        setPlanFases(prev => prev.filter(f => f.id !== idFase));
    }
  };

  const handleUpdateFase = (idFase, campo, valor) => {
    setPlanFases(prev => prev.map(fase => {
        if (fase.id === idFase) {
            return { ...fase, [campo]: valor };
        }
        return fase;
    }));
  };

  const handleAddAplicacao = (idFase) => {
    setPlanFases(prev => prev.map(fase => {
        if (fase.id === idFase) {
            return {
                ...fase,
                aplicacoes: [
                    ...fase.aplicacoes, 
                    { id: Date.now().toString(), metodo: 'foliar', insumo_id: '', quantidade: '', modo_aplicacao: 'ml/area' }
                ]
            };
        }
        return fase;
    }));
  };

  const handleUpdateAplicacao = (idFase, idAplicacao, campo, valor) => {
    setPlanFases(prev => prev.map(fase => {
        if (fase.id === idFase) {
            return {
                ...fase,
                aplicacoes: fase.aplicacoes.map(app => {
                    if (app.id === idAplicacao) {
                        return { ...app, [campo]: valor };
                    }
                    return app;
                })
            };
        }
        return fase;
    }));
  };

  const handleRemoveAplicacao = (idFase, idAplicacao) => {
    setPlanFases(prev => prev.map(fase => {
        if (fase.id === idFase) {
            return {
                ...fase,
                aplicacoes: fase.aplicacoes.filter(app => app.id !== idAplicacao)
            };
        }
        return fase;
    }));
  };

  // --- CÁLCULOS TOTAIS PARA COMPRAS ---
  const getInsumoDetalhes = (id) => insumos.find(i => i.id === id) || null;

  const resumoCompras = React.useMemo(() => {
    const map = new Map();
    const plantas = parseInt(planPlantas) || 0;

    planFases.forEach(fase => {
        fase.aplicacoes.forEach(app => {
            if (app.insumo_id && app.quantidade && app.modo_aplicacao) {
                const qtd = parseFloat(app.quantidade) || 0;
                let qtdConvertida = 0;
                let isLitro = false;

                if (app.modo_aplicacao === 'g/planta') {
                    qtdConvertida = (qtd * plantas) / 1000; 
                } else if (app.modo_aplicacao === 'kg/area') {
                    qtdConvertida = qtd; 
                } else if (app.modo_aplicacao === 'ml/area') {
                    qtdConvertida = qtd / 1000; 
                    isLitro = true;
                } else if (app.modo_aplicacao === 'l/area') {
                    qtdConvertida = qtd; 
                    isLitro = true;
                }

                if (qtdConvertida > 0) {
                    const existente = map.get(app.insumo_id) || { total_kg_L: 0, isLitro };
                    map.set(app.insumo_id, {
                        total_kg_L: existente.total_kg_L + qtdConvertida,
                        isLitro: isLitro || existente.isLitro
                    });
                }
            }
        });
    });

    const resumo = [];
    let custoTotal = 0;

    map.forEach((data, insumo_id) => {
        const insumo = getInsumoDetalhes(insumo_id);
        if (insumo) {
            const tamanhoEmb = parseFloat(insumo.tamanho_embalagem) || 1; 
            const qtdEmbalagensNecessarias = data.total_kg_L / tamanhoEmb;
            const custoEstimado = Math.ceil(qtdEmbalagensNecessarias) * (insumo.preco_unitario || 0); 
            
            custoTotal += custoEstimado;

            resumo.push({ 
                ...insumo, 
                quantidadeTotalBase: data.total_kg_L, 
                qtdEmbalagens: qtdEmbalagensNecessarias,
                tamanhoEmb: tamanhoEmb,
                unidadeCalculada: data.isLitro ? 'L' : 'kg',
                custoEstimado 
            });
        }
    });

    resumo.sort((a, b) => a.nome.localeCompare(b.nome));

    return { itens: resumo, custoTotal };
  }, [planFases, insumos, planPlantas]);

  // --- FUNÇÕES DE EXPORTAÇÃO ---
  const generatePDF = () => {
    const doc = new jsPDF();
    
    doc.setFontSize(18);
    doc.text(`Planejamento: ${planNome}`, 14, 20);
    
    doc.setFontSize(11);
    doc.setTextColor(100);
    doc.text(`Cultura: ${planCultura.toUpperCase()} | Ciclo por: ${cicloLabels[planTipoCiclo]}s | Plantas: ${planPlantas || 0}`, 14, 28);
    
    doc.setFontSize(14);
    doc.setTextColor(0);
    doc.text('Cronograma de Aplicações', 14, 40);
    
    const cronogramaRows = [];
    
    planFases.forEach(f => {
        const phaseName = f.nome_etapa ? ` - ${f.nome_etapa.toUpperCase()}` : '';
        cronogramaRows.push([
            { 
                content: `${cicloLabels[planTipoCiclo]} ${f.momento}${phaseName}`, 
                colSpan: 4, 
                styles: { fillColor: [230, 245, 240], textColor: [6, 78, 59], fontStyle: 'bold', halign: 'left' } 
            }
        ]);

        if (f.aplicacoes.length === 0) {
            cronogramaRows.push([{ content: 'Nenhum produto cadastrado.', colSpan: 4, styles: { fontStyle: 'italic', halign: 'center', textColor: [150, 150, 150] } }]);
        } else {
            f.aplicacoes.forEach(app => {
                const insumo = getInsumoDetalhes(app.insumo_id);
                cronogramaRows.push([
                    f.momento.toString(), 
                    app.metodo === 'foliar' ? 'Foliar' : 'Adubação',
                    insumo ? insumo.nome : '-',
                    `${app.quantidade} ${app.modo_aplicacao}`
                ]);
            });
        }
    });
    
    autoTable(doc, {
        startY: 45,
        head: [['Etapa', 'Método', 'Produto', 'Dosagem']],
        body: cronogramaRows,
        theme: 'grid',
        headStyles: { fillColor: [16, 185, 129] }, 
        styles: { fontSize: 9 }
    });
    
    const finalY = doc.lastAutoTable.finalY || 45;
    
    doc.setFontSize(14);
    doc.text('Resumo de Compras Necessárias', 14, finalY + 15);
    
    const resumoRows = [];
    resumoCompras.itens.forEach(item => {
        resumoRows.push([
            item.nome,
            `R$ ${(item.preco_unitario || 0).toLocaleString('pt-BR', {minimumFractionDigits: 2})}`,
            `${item.quantidadeTotalBase.toLocaleString('pt-BR', {maximumFractionDigits: 2})} ${item.unidadeCalculada}`,
            `${Math.ceil(item.qtdEmbalagens)} un.`, 
            `R$ ${item.custoEstimado.toLocaleString('pt-BR', {minimumFractionDigits: 2})}`
        ]);
    });
    
    autoTable(doc, {
        startY: finalY + 20,
        head: [['Produto', 'Preço Ref. (Emb)', 'Necessidade', 'Comprar', 'Custo Est.']],
        body: resumoRows,
        foot: [['', '', '', 'TOTAL GERAL:', `R$ ${resumoCompras.custoTotal.toLocaleString('pt-BR', {minimumFractionDigits: 2})}`]],
        theme: 'grid',
        headStyles: { fillColor: [59, 130, 246] }, 
        footStyles: { fillColor: [240, 240, 240], textColor: [0,0,0], fontStyle: 'bold' },
        styles: { fontSize: 9 }
    });
    
    doc.save(`Planejamento_${planNome.replace(/\s+/g, '_')}.pdf`);
  };

  const generateExcel = () => {
    let csv = '\uFEFF'; 
    
    csv += `Planejamento:;${planNome}\n`;
    csv += `Cultura:;${planCultura}\n`;
    csv += `Ciclo por:;${cicloLabels[planTipoCiclo]}s\n`;
    csv += `Qtd de Plantas:;${planPlantas || 0}\n\n`;

    csv += 'CRONOGRAMA DE APLICACOES\n';
    csv += 'Etapa;Nome da Etapa;Metodo;Produto;Quantidade;Modo de Aplicacao\n';
    planFases.forEach(f => {
        if (f.aplicacoes.length === 0) {
            csv += `${cicloLabels[planTipoCiclo]} ${f.momento};${f.nome_etapa || '-'};-;-;-;-\n`;
        } else {
            f.aplicacoes.forEach(app => {
                const insumo = getInsumoDetalhes(app.insumo_id);
                const nomeInsumo = insumo ? insumo.nome : '-';
                const metodo = app.metodo === 'foliar' ? 'Foliar' : 'Adubacao';
                csv += `${cicloLabels[planTipoCiclo]} ${f.momento};${f.nome_etapa || '-'};${metodo};${nomeInsumo};${app.quantidade};${app.modo_aplicacao}\n`;
            });
        }
    });

    csv += '\nRESUMO DE COMPRAS\n';
    csv += 'Produto;Preco Ref. da Embalagem;Necessidade Total;Unidade de Medida;Comprar (Embalagens);Custo Estimado\n';
    resumoCompras.itens.forEach(item => {
        const preco = (item.preco_unitario || 0).toLocaleString('pt-BR', {minimumFractionDigits: 2});
        const totalBase = item.quantidadeTotalBase.toLocaleString('pt-BR', {maximumFractionDigits: 2});
        const emb = Math.ceil(item.qtdEmbalagens).toString();
        const custo = item.custoEstimado.toLocaleString('pt-BR', {minimumFractionDigits: 2});
        
        csv += `${item.nome};R$ ${preco};${totalBase};${item.unidadeCalculada};${emb};R$ ${custo}\n`;
    });
    
    csv += `\nCUSTO TOTAL ESTIMADO;;;;;R$ ${resumoCompras.custoTotal.toLocaleString('pt-BR', {minimumFractionDigits: 2})}\n`;

    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.setAttribute('download', `Planejamento_${planNome.replace(/\s+/g, '_')}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };


  return (
    <div className="space-y-6">
      {/* HEADER */}
      <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-4 bg-white p-4 rounded-[1.5rem] border border-stone-100 shadow-sm">
        <div>
          <h1 className="text-2xl font-bold text-stone-900 tracking-tight">Planejamento de Ciclos</h1>
          <p className="text-stone-500 font-medium">Cronograma de aplicações foliares e adubações</p>
        </div>
        
        <div className="flex flex-col sm:flex-row items-center gap-3">
            <Select value={activePlanId} onValueChange={setActivePlanId}>
                <SelectTrigger className="w-full sm:w-[280px] rounded-xl bg-stone-50 border-stone-200 font-medium">
                    <SelectValue placeholder="Selecione um ciclo..." />
                </SelectTrigger>
                <SelectContent>
                    <SelectItem value="novo" className="text-emerald-600 font-bold">+ Criar Novo Ciclo</SelectItem>
                    {planejamentos.map(p => (
                        <SelectItem key={p.id} value={p.id}>{p.nome} ({p.cultura})</SelectItem>
                    ))}
                </SelectContent>
            </Select>

            {activePlanId === 'novo' ? (
                <Dialog open={openNovaPlanilha} onOpenChange={setOpenNovaPlanilha}>
                    <DialogTrigger asChild>
                        <Button className="w-full sm:w-auto bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl h-10 px-6 shadow-lg shadow-emerald-100">
                            <Plus className="w-4 h-4 mr-2" /> Iniciar Planejamento
                        </Button>
                    </DialogTrigger>
                    <DialogContent className="sm:max-w-md rounded-[2rem]">
                        <DialogHeader><DialogTitle>Novo Ciclo de Planejamento</DialogTitle></DialogHeader>
                        <div className="space-y-4 pt-4">
                            <div className="space-y-2">
                                <Label>Nome do Planejamento</Label>
                                <Input value={novoPlan.nome} onChange={e => setNovoPlan({...novoPlan, nome: e.target.value})} className="rounded-xl" placeholder="Ex: Goiaba 1º Ano" />
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <Label>Cultura</Label>
                                    <Select value={novoPlan.cultura} onValueChange={v => setNovoPlan({...novoPlan, cultura: v})}>
                                        <SelectTrigger className="rounded-xl"><SelectValue/></SelectTrigger>
                                        <SelectContent><SelectItem value="manga">Manga</SelectItem><SelectItem value="goiaba">Goiaba</SelectItem></SelectContent>
                                    </Select>
                                </div>
                                <div className="space-y-2">
                                    <Label>Formato do Ciclo</Label>
                                    <Select value={novoPlan.tipo_ciclo} onValueChange={v => setNovoPlan({...novoPlan, tipo_ciclo: v})}>
                                        <SelectTrigger className="rounded-xl"><SelectValue/></SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="dia">Por Dia</SelectItem>
                                            <SelectItem value="semana">Por Semana</SelectItem>
                                            <SelectItem value="mes">Por Mês</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>
                            </div>
                            <div className="space-y-2">
                                <Label className="text-stone-600">Qtd de Plantas <span className="text-xs text-stone-400 font-normal">(Usado p/ cálculo g/planta)</span></Label>
                                <Input type="number" value={novoPlan.quantidade_plantas} onChange={e => setNovoPlan({...novoPlan, quantidade_plantas: e.target.value})} className="rounded-xl" placeholder="Ex: 500" />
                            </div>
                            <Button onClick={handleCreateNew} className="w-full bg-emerald-600 hover:bg-emerald-700 rounded-xl font-bold h-11 mt-2" disabled={saveMutation.isPending}>
                                Criar Estrutura
                            </Button>
                        </div>
                    </DialogContent>
                </Dialog>
            ) : (
                <div className="flex flex-wrap gap-2 w-full sm:w-auto">
                    {/* BOTÕES DE EXPORTAÇÃO */}
                    <Button onClick={generatePDF} className="bg-white border border-stone-200 text-stone-700 hover:bg-stone-50 rounded-xl px-3 shadow-sm" disabled={saveMutation.isPending || planFases.length === 0} title="Exportar PDF">
                        <FileText className="w-4 h-4 text-red-500" />
                    </Button>
                    <Button onClick={generateExcel} className="bg-white border border-stone-200 text-stone-700 hover:bg-stone-50 rounded-xl px-3 shadow-sm" disabled={saveMutation.isPending || planFases.length === 0} title="Exportar Excel">
                        <TableIcon className="w-4 h-4 text-emerald-600" />
                    </Button>
                    
                    {/* BOTÃO NOVO: DUPLICAR */}
                    <Button onClick={() => duplicateMutation.mutate()} className="bg-white border border-stone-200 text-stone-700 hover:bg-blue-50 hover:text-blue-700 hover:border-blue-200 rounded-xl px-4 shadow-sm transition-all" disabled={duplicateMutation.isPending} title="Criar uma cópia deste planejamento">
                        <Copy className="w-4 h-4 mr-2 text-blue-500" /> {duplicateMutation.isPending ? 'Copiando...' : 'Duplicar'}
                    </Button>

                    {/* BOTÕES DE AÇÃO */}
                    <Button onClick={handleSaveCurrent} className="flex-1 sm:flex-none bg-blue-600 hover:bg-blue-700 text-white rounded-xl px-6 shadow-lg shadow-blue-100" disabled={saveMutation.isPending}>
                        <Save className="w-4 h-4 mr-2" /> {saveMutation.isPending ? 'Salvando...' : 'Salvar'}
                    </Button>
                    <Button variant="outline" className="text-red-500 hover:bg-red-50 border-red-200 rounded-xl px-4" onClick={() => { if(confirm("Tem certeza que deseja apagar todo este planejamento?")) deleteMutation.mutate(activePlanId) }}>
                        <Trash2 className="w-4 h-4" />
                    </Button>
                </div>
            )}
        </div>
      </div>

      {/* ÁREA DE CONSTRUÇÃO DO CICLO */}
      {activePlanId !== 'novo' ? (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
              
              {/* COLUNA ESQUERDA: LINHA DO TEMPO / FASES */}
              <div className="lg:col-span-2 space-y-6">
                  {/* Cabeçalho de Controle */}
                  <div className="bg-stone-50 rounded-[2rem] p-6 border border-stone-100 flex flex-col md:flex-row md:items-center justify-between gap-4">
                      <div>
                          <div className="flex items-center gap-3">
                              {/* NOVO: CAMPO DE TEXTO EDITÁVEL PARA O NOME DO PLANEJAMENTO */}
                              <div className="relative group flex items-center">
                                  <Input 
                                      value={planNome}
                                      onChange={(e) => setPlanNome(e.target.value)}
                                      className="text-xl font-black text-stone-800 bg-transparent border-transparent hover:border-stone-200 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 rounded-lg h-10 px-2 w-full min-w-[250px] shadow-none transition-all"
                                      title="Clique para renomear este planejamento"
                                  />
                                  <Edit2 className="w-4 h-4 text-stone-300 absolute right-3 pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity" />
                              </div>
                              <Badge variant="outline" className="bg-white capitalize text-stone-500">{planCultura}</Badge>
                          </div>
                          <div className="flex items-center gap-4 mt-3 px-2">
                              <p className="text-sm text-stone-500 flex items-center gap-1">
                                  <Settings className="w-4 h-4"/> Ciclo por <b>{cicloLabels[planTipoCiclo]}s</b>
                              </p>
                              <div className="flex items-center gap-2 bg-white px-3 py-1.5 rounded-xl border border-stone-200 shadow-sm">
                                  <Trees className="w-4 h-4 text-emerald-600" />
                                  <Label className="text-xs text-stone-500 m-0">Plantas:</Label>
                                  <Input 
                                      type="number" 
                                      value={planPlantas} 
                                      onChange={(e) => setPlanPlantas(e.target.value)}
                                      className="w-20 h-7 text-xs font-bold border-none bg-stone-50 focus-visible:ring-1 focus-visible:ring-emerald-500 px-2"
                                      placeholder="Ex: 500"
                                  />
                              </div>
                          </div>
                      </div>

                      <Dialog open={openNovaFase} onOpenChange={setOpenNovaFase}>
                          <DialogTrigger asChild>
                              <Button className="bg-stone-800 hover:bg-stone-900 text-white rounded-xl shadow-md h-11 shrink-0">
                                  <Plus className="w-4 h-4 mr-2" /> Adicionar {cicloLabels[planTipoCiclo]}
                              </Button>
                          </DialogTrigger>
                          <DialogContent className="sm:max-w-xs rounded-[2rem]">
                              <DialogHeader><DialogTitle>Adicionar Etapa</DialogTitle></DialogHeader>
                              <div className="space-y-4 pt-2">
                                  <div className="space-y-2">
                                      <Label>Número do {cicloLabels[planTipoCiclo]} (Ex: -7, 0, 14)</Label>
                                      <Input type="number" value={novaFaseMomento} onChange={e => setNovaFaseMomento(e.target.value)} className="rounded-xl" placeholder="Digite o número..." />
                                  </div>
                                  <Button onClick={handleAddFase} className="w-full bg-emerald-600 hover:bg-emerald-700 rounded-xl" disabled={!novaFaseMomento}>
                                      Adicionar à Linha do Tempo
                                  </Button>
                              </div>
                          </DialogContent>
                      </Dialog>
                  </div>

                  {/* Renderização das Fases */}
                  <div className="space-y-6 relative before:absolute before:inset-0 before:ml-6 before:-translate-x-px md:before:mx-auto md:before:translate-x-0 before:h-full before:w-0.5 before:bg-gradient-to-b before:from-stone-200 before:via-emerald-200 before:to-stone-100">
                      {planFases.length === 0 ? (
                          <div className="relative z-10 text-center py-10">
                              <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-stone-100 border-4 border-white shadow-sm mb-3">
                                  <Calendar className="w-5 h-5 text-stone-400" />
                              </div>
                              <p className="text-stone-500 font-medium text-sm">Nenhuma etapa programada.</p>
                              <p className="text-stone-400 text-xs mt-1">Clique em "Adicionar {cicloLabels[planTipoCiclo]}" para começar o ciclo.</p>
                          </div>
                      ) : (
                          planFases.map((fase) => (
                              <div key={fase.id} className="relative z-10 flex items-start flex-col md:flex-row gap-4 group">
                                  {/* Marcador Central */}
                                  <div className="flex items-center md:justify-end w-12 md:w-32 pt-3 shrink-0">
                                      <div className="hidden md:block mr-4 text-right">
                                          <div className="text-[10px] font-bold uppercase text-stone-400 tracking-wider">{cicloLabels[planTipoCiclo]}</div>
                                          <div className="text-xl font-black text-emerald-600">{fase.momento}</div>
                                          {fase.nome_etapa && <div className="text-xs font-bold text-stone-500 mt-1 max-w-[80px] truncate ml-auto" title={fase.nome_etapa}>{fase.nome_etapa}</div>}
                                      </div>
                                      <div className="w-12 h-12 rounded-full bg-white border-4 border-emerald-100 shadow-sm flex items-center justify-center relative md:-mr-6 z-10">
                                          <CircleDot className="w-5 h-5 text-emerald-500" />
                                      </div>
                                      <div className="md:hidden ml-4 flex flex-col">
                                          <span className="font-bold text-stone-700">{cicloLabels[planTipoCiclo]} {fase.momento}</span>
                                          {fase.nome_etapa && <span className="text-xs text-stone-500 font-medium">{fase.nome_etapa}</span>}
                                      </div>
                                  </div>

                                  {/* Card da Fase */}
                                  <Card className="flex-1 w-full border-stone-200/60 shadow-sm hover:shadow-md transition-shadow rounded-2xl ml-12 md:ml-0 overflow-hidden bg-white/80 backdrop-blur-sm">
                                      <div className="bg-stone-50/80 px-4 py-3 border-b border-stone-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                                          <div className="flex items-center gap-2 flex-1">
                                              <Label className="sr-only">Nome da Etapa</Label>
                                              <Input
                                                  placeholder="Nome da etapa (Ex: Indução, Maturação...)"
                                                  value={fase.nome_etapa || ''}
                                                  onChange={(e) => handleUpdateFase(fase.id, 'nome_etapa', e.target.value)}
                                                  className="h-8 text-sm font-bold bg-white/60 border-stone-200 focus-visible:ring-emerald-500 w-full max-w-[250px] shadow-sm"
                                              />
                                          </div>
                                          <div className="flex gap-2">
                                              <Button variant="outline" size="sm" onClick={() => handleAddAplicacao(fase.id)} className="h-8 text-xs bg-white text-emerald-600 border-emerald-200 hover:bg-emerald-50 shadow-sm">
                                                  <Plus className="w-3 h-3 mr-1"/> Adicionar Produto
                                              </Button>
                                              <Button variant="ghost" size="sm" onClick={() => handleRemoveFase(fase.id)} className="h-8 w-8 p-0 text-stone-400 hover:text-red-500 hover:bg-red-50 rounded-lg">
                                                  <Trash2 className="w-4 h-4"/>
                                              </Button>
                                          </div>
                                      </div>
                                      
                                      <div className="p-4">
                                          {fase.aplicacoes.length === 0 ? (
                                              <p className="text-xs text-stone-400 italic text-center py-2">Nenhum produto para esta etapa.</p>
                                          ) : (
                                              <div className="space-y-3">
                                                  {fase.aplicacoes.map((app) => {
                                                      const config = metodoConfig[app.metodo];
                                                      const Icon = config.icon;
                                                      return (
                                                          <div key={app.id} className="flex flex-col sm:flex-row gap-2 sm:items-center p-2 rounded-xl bg-stone-50/50 border border-stone-100 hover:border-stone-200 transition-colors">
                                                              {/* Seleção do Método (Foliar/Adubação) */}
                                                              <Select value={app.metodo} onValueChange={(v) => {
                                                                  handleUpdateAplicacao(fase.id, app.id, 'metodo', v);
                                                                  handleUpdateAplicacao(fase.id, app.id, 'modo_aplicacao', v === 'foliar' ? 'ml/area' : 'g/planta');
                                                              }}>
                                                                  <SelectTrigger className={`w-full sm:w-[120px] h-9 text-xs font-bold rounded-lg ${config.bg} ${config.color}`}>
                                                                      <div className="flex items-center gap-2">
                                                                          <Icon className="w-3 h-3" />
                                                                          <span>{config.label}</span>
                                                                      </div>
                                                                  </SelectTrigger>
                                                                  <SelectContent>
                                                                      <SelectItem value="foliar"><div className="flex items-center gap-2"><Droplets className="w-3 h-3 text-blue-500"/> Foliar</div></SelectItem>
                                                                      <SelectItem value="adubacao"><div className="flex items-center gap-2"><Leaf className="w-3 h-3 text-emerald-500"/> Adubação</div></SelectItem>
                                                                  </SelectContent>
                                                              </Select>

                                                              {/* Seleção do Insumo */}
                                                              <Select value={app.insumo_id} onValueChange={(v) => handleUpdateAplicacao(fase.id, app.id, 'insumo_id', v)}>
                                                                  <SelectTrigger className="flex-1 h-9 text-xs rounded-lg bg-white border-stone-200">
                                                                      <SelectValue placeholder="Selecione o produto..." />
                                                                  </SelectTrigger>
                                                                  <SelectContent>
                                                                      {insumos.map(ins => (
                                                                          <SelectItem key={ins.id} value={ins.id}>{ins.nome}</SelectItem>
                                                                      ))}
                                                                  </SelectContent>
                                                              </Select>

                                                              {/* Quantidade e Medida */}
                                                              <div className="flex items-center gap-2 w-full sm:w-[220px]">
                                                                  <Input 
                                                                      type="number" 
                                                                      placeholder="Qtd" 
                                                                      value={app.quantidade} 
                                                                      onChange={(e) => handleUpdateAplicacao(fase.id, app.id, 'quantidade', e.target.value)}
                                                                      className="w-20 h-9 text-xs rounded-lg bg-white text-center font-bold"
                                                                  />
                                                                  <Select value={app.modo_aplicacao || (app.metodo === 'foliar' ? 'ml/area' : 'g/planta')} onValueChange={(v) => handleUpdateAplicacao(fase.id, app.id, 'modo_aplicacao', v)}>
                                                                      <SelectTrigger className="flex-1 h-9 text-xs rounded-lg bg-white border-stone-200 font-medium">
                                                                          <SelectValue />
                                                                      </SelectTrigger>
                                                                      <SelectContent>
                                                                          {app.metodo === 'foliar' ? (
                                                                              <>
                                                                                  <SelectItem value="ml/area">ml / área</SelectItem>
                                                                                  <SelectItem value="l/area">L / área</SelectItem>
                                                                              </>
                                                                          ) : (
                                                                              <>
                                                                                  <SelectItem value="g/planta">g / planta</SelectItem>
                                                                                  <SelectItem value="kg/area">kg / área</SelectItem>
                                                                              </>
                                                                          )}
                                                                      </SelectContent>
                                                                  </Select>
                                                                  
                                                                  <Button variant="ghost" size="sm" onClick={() => handleRemoveAplicacao(fase.id, app.id)} className="h-8 w-8 p-0 text-stone-300 hover:text-red-500 hover:bg-white shrink-0">
                                                                      <Trash2 className="w-3 h-3"/>
                                                                  </Button>
                                                              </div>
                                                          </div>
                                                      );
                                                  })}
                                              </div>
                                          )}
                                      </div>
                                  </Card>
                              </div>
                          ))
                      )}
                  </div>
              </div>

              {/* COLUNA DIREITA: RESUMO FINANCEIRO E DE COMPRAS */}
              <div className="lg:col-span-1">
                  <div className="sticky top-24">
                      <Card className="border-emerald-100 rounded-[2rem] shadow-md shadow-emerald-100/50 bg-gradient-to-br from-emerald-600 to-teal-700 overflow-hidden">
                          <CardHeader className="border-b border-emerald-500/30 pb-4 bg-black/10">
                              <CardTitle className="flex items-center gap-2 text-lg text-white font-bold">
                                  <ShoppingCart className="w-5 h-5 text-emerald-200" /> Resumo do Ciclo
                              </CardTitle>
                          </CardHeader>
                          <CardContent className="p-0">
                              <div className="p-6 text-center text-white">
                                  <p className="text-emerald-100/80 text-xs uppercase font-bold tracking-widest mb-1">Custo Total Estimado</p>
                                  <div className="text-3xl font-black tracking-tight">
                                      R$ {resumoCompras.custoTotal.toLocaleString('pt-BR', {minimumFractionDigits: 2})}
                                  </div>
                                  {(!planPlantas || planPlantas === '0') && planFases.some(f => f.aplicacoes.some(a => a.modo_aplicacao === 'g/planta')) && (
                                      <div className="mt-3 bg-red-500/20 border border-red-500/30 text-red-100 text-xs py-1.5 px-3 rounded-lg inline-block">
                                          Informe a Qtd de Plantas para calcular "g/planta"
                                      </div>
                                  )}
                              </div>
                              
                              <div className="bg-white/95 rounded-t-3xl p-5 min-h-[300px]">
                                  <h3 className="text-sm font-bold text-stone-700 mb-4 flex items-center gap-2">
                                      <Calculator className="w-4 h-4 text-emerald-600"/> Lista de Compras Necessária
                                  </h3>
                                  
                                  {resumoCompras.itens.length === 0 ? (
                                      <div className="text-center text-stone-400 py-10 italic text-sm">
                                          Adicione produtos e preencha as quantidades para ver o resumo.
                                      </div>
                                  ) : (
                                      <div className="space-y-3 max-h-[500px] overflow-y-auto pr-2 scrollbar-thin">
                                          {resumoCompras.itens.map((item, idx) => (
                                              <div key={idx} className="bg-stone-50 rounded-xl p-3 border border-stone-100 flex items-center justify-between group hover:border-emerald-200 transition-colors">
                                                  <div className="flex-1 truncate pr-2">
                                                      <p className="font-bold text-stone-800 text-sm truncate" title={item.nome}>{item.nome}</p>
                                                      <p className="text-[10px] text-stone-400 font-medium">Ref: R$ {item.preco_unitario?.toFixed(2)} por embalagem</p>
                                                  </div>
                                                  <div className="text-right shrink-0">
                                                      <p className="text-sm font-black text-emerald-600">
                                                          {item.quantidadeTotalBase.toLocaleString('pt-BR', {maximumFractionDigits: 2})} <span className="text-[10px] text-emerald-600/60 font-bold uppercase">{item.unidadeCalculada}</span>
                                                      </p>
                                                      <div className="text-[10px] text-stone-500 font-medium">
                                                        Comprar <b className="text-stone-700">{Math.ceil(item.qtdEmbalagens)}</b> un.
                                                      </div>
                                                      <p className="text-[10px] font-bold text-emerald-700 mt-1">R$ {item.custoEstimado.toLocaleString('pt-BR', {minimumFractionDigits: 2})}</p>
                                                  </div>
                                              </div>
                                          ))}
                                      </div>
                                  )}
                              </div>
                          </CardContent>
                      </Card>
                  </div>
              </div>

          </div>
      ) : (
          <EmptyState 
            icon={CircleDot} 
            title="Nenhum ciclo selecionado" 
            description="Selecione um planejamento no topo ou crie um novo para organizar suas aplicações."
          />
      )}
    </div>
  );
}