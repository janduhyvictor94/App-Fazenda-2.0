import React, { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabaseClient';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { 
  Plus, Save, Trash2, Calendar, Droplets, Leaf, 
  ShoppingCart, Calculator, CircleDot, Settings, Trees,
  FileText, Table as TableIcon, Copy, Edit2, PlayCircle, Send, Briefcase
} from 'lucide-react';
import EmptyState from '@/components/ui/EmptyState';
import { format, parseISO, addDays, addMonths } from 'date-fns'; 
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

const cicloLabels = {
  dia: 'Dia',
  semana: 'Semana',
  mes: 'Mês',
  livre: 'Etapa'
};

const metodoConfig = {
  foliar: { label: 'Foliar', icon: Droplets, color: 'text-blue-500', bg: 'bg-blue-50 border-blue-200' },
  adubacao: { label: 'Adubação', icon: Leaf, color: 'text-emerald-500', bg: 'bg-emerald-50 border-emerald-200' },
  terceirizado: { label: 'Terceirizado', icon: Briefcase, color: 'text-amber-600', bg: 'bg-amber-50 border-amber-200' }
};

export default function Planejamentos() {
  const queryClient = useQueryClient();
  const [activePlanId, setActivePlanId] = useState('novo');
  const [openNovaPlanilha, setOpenNovaPlanilha] = useState(false);
  
  const [novoPlan, setNovoPlan] = useState({ nome: '', cultura: 'goiaba', tipo_ciclo: 'dia', quantidade_plantas: '' });
  
  const [planNome, setPlanNome] = useState('');
  const [planCultura, setPlanCultura] = useState('goiaba');
  const [planTipoCiclo, setPlanTipoCiclo] = useState('dia');
  const [planPlantas, setPlanPlantas] = useState('');
  const [planFases, setPlanFases] = useState([]);

  const [openNovaFase, setOpenNovaFase] = useState(false);
  const [novaFaseMomento, setNovaFaseMomento] = useState('');

  const [openApplyModal, setOpenApplyModal] = useState(false);
  const [applySafraId, setApplySafraId] = useState('');
  const [applyStartDate, setApplyStartDate] = useState(format(new Date(), 'yyyy-MM-dd'));

  const { data: insumos = [] } = useQuery({ queryKey: ['insumos'], queryFn: async () => { const { data } = await supabase.from('insumos').select('*').order('nome'); return data || []; } });
  const { data: planejamentos = [] } = useQuery({ queryKey: ['planejamentos'], queryFn: async () => { const { data } = await supabase.from('planejamentos').select('*').order('created_at', { ascending: false }); return data || []; } });
  const { data: safras = [] } = useQuery({ queryKey: ['safras'], queryFn: async () => { const { data } = await supabase.from('safras').select('*, talhoes(nome)').eq('status', 'ativo').order('data_inicio', { ascending: false }); return data || []; } });

  useEffect(() => {
    if (activePlanId && activePlanId !== 'novo') {
      const plan = planejamentos.find(p => p.id === activePlanId);
      if (plan) {
        setPlanNome(plan.nome); setPlanCultura(plan.cultura); setPlanTipoCiclo(plan.dados?.tipo_ciclo || 'dia');
        setPlanPlantas(plan.dados?.quantidade_plantas || ''); setPlanFases(plan.dados?.fases || []);
      }
    } else {
      setPlanNome(''); setPlanCultura('goiaba'); setPlanTipoCiclo('dia'); setPlanPlantas(''); setPlanFases([]);
    }
  }, [activePlanId, planejamentos]);

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
    onSuccess: (data) => { queryClient.invalidateQueries({ queryKey: ['planejamentos'] }); setActivePlanId(data.id); setOpenNovaPlanilha(false); alert('Salvo com sucesso!'); },
    onError: (error) => { alert(`Não foi possível salvar o planejamento.\n\nMotivo: ${error.message || 'Erro desconhecido'}`); console.error('Erro ao salvar planejamento:', error); }
  });

  const duplicateMutation = useMutation({
    mutationFn: async () => {
      const payload = { nome: `${planNome} (Cópia)`, cultura: planCultura, dados: { tipo_ciclo: planTipoCiclo, quantidade_plantas: planPlantas, fases: planFases } };
      const { data, error } = await supabase.from('planejamentos').insert([payload]).select().single();
      if (error) throw error; return data;
    },
    onSuccess: (data) => { queryClient.invalidateQueries({ queryKey: ['planejamentos'] }); setActivePlanId(data.id); },
    onError: (error) => { alert(`Não foi possível duplicar o planejamento.\n\nMotivo: ${error.message || 'Erro desconhecido'}`); console.error('Erro ao duplicar planejamento:', error); }
  });

  const deleteMutation = useMutation({ mutationFn: async (id) => { const { error } = await supabase.from('planejamentos').delete().eq('id', id); if (error) throw error; }, onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['planejamentos'] }); setActivePlanId('novo'); }, onError: (error) => { alert(`Não foi possível excluir o planejamento.\n\nMotivo: ${error.message || 'Erro desconhecido'}`); console.error('Erro ao excluir planejamento:', error); } });

  const applyToSafraMutation = useMutation({
    mutationFn: async () => {
        if (!applySafraId) throw new Error("Selecione a safra de destino.");
        if (planTipoCiclo !== 'livre' && !applyStartDate) throw new Error("Preencha a data de início.");
        const safraSelecionada = safras.find(s => s.id === applySafraId);
        if (!safraSelecionada) throw new Error("Safra não encontrada.");
        if (planFases.length === 0) throw new Error("O planejamento está vazio.");

        // A CORREÇÃO: Força o relógio para meio-dia. Impossível o fuso jogar pro dia anterior.
        const baseDate = applyStartDate ? new Date(`${applyStartDate}T12:00:00`) : new Date();
        
        const atividadesParaInserir = [];

        const menorMomento = Math.min(...planFases.map(f => Number(f.momento)));

        planFases.forEach(fase => {
            let dataCalculada;
            let dataProgStr = null;

            const momentoRelativo = Number(fase.momento) - menorMomento;

            // No modo "Livre/Etapas" a atividade nasce SEM data — ela só ganha data real
            // quando você marcar como concluída em Atividades, escolhendo o dia que aconteceu de fato.
            if (planTipoCiclo !== 'livre') {
                if (planTipoCiclo === 'semana') {
                    dataCalculada = addDays(baseDate, momentoRelativo * 7);
                } else if (planTipoCiclo === 'mes') {
                    dataCalculada = addMonths(baseDate, momentoRelativo);
                } else {
                    dataCalculada = addDays(baseDate, momentoRelativo);
                }
                dataProgStr = format(dataCalculada, 'yyyy-MM-dd');
            }

            const terceirizados = fase.aplicacoes.filter(app => app.metodo === 'terceirizado');
            const isTerceirizada = terceirizados.length > 0;
            const valorTerceirizadoTotaL = terceirizados.reduce((acc, curr) => acc + (parseFloat(curr.valor_estimado) || 0), 0);
            const descricoesTerc = terceirizados.map(t => t.descricao_servico).filter(Boolean).join(', ');

            const insumosConvertidos = fase.aplicacoes.filter(app => app.metodo !== 'terceirizado').map(app => {
                const insumo = insumos.find(i => i.id === app.insumo_id);
                if (!insumo) return null;
                
                const qtdInput = parseFloat(app.quantidade) || 0;
                const plantas = parseInt(planPlantas) || 0;
                
                let qtdTotalBase = 0; 
                if (app.modo_aplicacao === 'g/planta') qtdTotalBase = (qtdInput * plantas) / 1000;
                else if (app.modo_aplicacao === 'ml/area') qtdTotalBase = qtdInput / 1000;
                else qtdTotalBase = qtdInput; 

                const tamanhoEmb = parseFloat(insumo.tamanho_embalagem) || 1;
                const fracaoUso = qtdTotalBase / tamanhoEmb;
                const embalagensFechadas = Math.ceil(fracaoUso);
                const valorTotal = embalagensFechadas * (insumo.preco_unitario || 0);

                return {
                    insumo_id: insumo.id,
                    nome: insumo.nome,
                    quantidade: embalagensFechadas, 
                    unidade: 'un.', 
                    valor_unitario: insumo.preco_unitario || 0,
                    valor_total: valorTotal,
                    metodo_aplicacao: app.metodo
                };
            }).filter(Boolean);

            let custoDaAtividade = insumosConvertidos.reduce((acc, curr) => acc + curr.valor_total, 0);
            if (isTerceirizada) custoDaAtividade += valorTerceirizadoTotaL;

            let obs = `Gerado via Planejamento: ${planNome}`;
            if (planTipoCiclo === 'livre') obs += `\n*Etapa Livre (Executar conforme a planta responder)*`;
            if (descricoesTerc) obs += `\nServiços terceirizados previstos: ${descricoesTerc}`;

            atividadesParaInserir.push({
                talhao_id: safraSelecionada.talhao_id,
                safra_id: applySafraId,
                ordem_etapa: fase.momento,
                tipo: 'outro',
                tipo_personalizado: fase.nome_etapa || `Aplicação Etapa ${fase.momento}`,
                data_programada: dataProgStr,
                status: 'programada',
                terceirizada: isTerceirizada,
                valor_terceirizado: isTerceirizada && valorTerceirizadoTotaL > 0 ? valorTerceirizadoTotaL : null,
                insumos_utilizados: insumosConvertidos,
                custo_total: custoDaAtividade,
                observacoes: obs
            });
        });

        const { error } = await supabase.from('atividades').insert(atividadesParaInserir);
        if (error) throw error;
    },
    onSuccess: () => {
        setOpenApplyModal(false);
        alert(`Sucesso! ${planFases.length} atividades foram agendadas na tela de Atividades.`);
    },
    onError: (err) => {
        alert("Erro ao gerar: " + err.message);
    }
  });

  const handleCreateNew = () => { if (!novoPlan.nome) return alert('Dê um nome.'); saveMutation.mutate({ nome: novoPlan.nome, cultura: novoPlan.cultura, dados: { tipo_ciclo: novoPlan.tipo_ciclo, quantidade_plantas: novoPlan.quantidade_plantas, fases: [] } }); };
  const handleSaveCurrent = () => { if (activePlanId === 'novo') return; saveMutation.mutate({ nome: planNome, cultura: planCultura, dados: { tipo_ciclo: planTipoCiclo, quantidade_plantas: planPlantas, fases: planFases } }); };

  const handleAddFase = () => {
    const momento = parseInt(novaFaseMomento); if (isNaN(momento)) return;
    if (planFases.some(f => f.momento === momento)) return alert(`Esta etapa já existe!`);
    
    setPlanFases([...planFases, { 
        id: Date.now().toString(), 
        momento: momento, 
        nome_etapa: '', 
        aplicacoes: [] 
    }].sort((a, b) => a.momento - b.momento));
    
    setNovaFaseMomento(''); setOpenNovaFase(false);
  };
  
  const handleRemoveFase = (idFase) => { if(confirm('Remover etapa?')) setPlanFases(prev => prev.filter(f => f.id !== idFase)); };
  const handleUpdateFase = (idFase, campo, valor) => setPlanFases(prev => prev.map(f => f.id === idFase ? { ...f, [campo]: valor } : f));
  
  const handleAddAplicacao = (idFase) => setPlanFases(prev => prev.map(f => f.id === idFase ? { ...f, aplicacoes: [...f.aplicacoes, { id: Date.now().toString(), metodo: 'foliar', insumo_id: '', quantidade: '', modo_aplicacao: 'ml/area', descricao_servico: '', valor_estimado: '' }] } : f));
  const handleUpdateAplicacao = (idFase, idApp, campo, valor) => setPlanFases(prev => prev.map(f => f.id === idFase ? { ...f, aplicacoes: f.aplicacoes.map(a => a.id === idApp ? { ...a, [campo]: valor } : a) } : f));
  const handleRemoveAplicacao = (idFase, idApp) => setPlanFases(prev => prev.map(f => f.id === idFase ? { ...f, aplicacoes: f.aplicacoes.filter(a => a.id !== idApp) } : f));

  const getInsumoDetalhes = (id) => insumos.find(i => i.id === id) || null;

  const resumoCompras = React.useMemo(() => {
    const map = new Map(); const plantas = parseInt(planPlantas) || 0;
    let custoTerceirizadoEstimado = 0;

    planFases.forEach(fase => {
        fase.aplicacoes.forEach(app => {
            if (app.metodo === 'terceirizado') {
                custoTerceirizadoEstimado += parseFloat(app.valor_estimado) || 0;
            } else if (app.insumo_id && app.quantidade && app.modo_aplicacao) {
                const qtd = parseFloat(app.quantidade) || 0; let qtdConvertida = 0; let isLitro = false;
                if (app.modo_aplicacao === 'g/planta') qtdConvertida = (qtd * plantas) / 1000; 
                else if (app.modo_aplicacao === 'kg/area') qtdConvertida = qtd; 
                else if (app.modo_aplicacao === 'ml/area') { qtdConvertida = qtd / 1000; isLitro = true; } 
                else if (app.modo_aplicacao === 'l/area') { qtdConvertida = qtd; isLitro = true; }
                if (qtdConvertida > 0) {
                    const existente = map.get(app.insumo_id) || { total_kg_L: 0, isLitro };
                    map.set(app.insumo_id, { total_kg_L: existente.total_kg_L + qtdConvertida, isLitro: isLitro || existente.isLitro });
                }
            }
        });
    });
    
    const resumo = []; let custoTotalInsumos = 0;
    map.forEach((data, insumo_id) => {
        const insumo = getInsumoDetalhes(insumo_id);
        if (insumo) {
            const tamanhoEmb = parseFloat(insumo.tamanho_embalagem) || 1; 
            const qtdEmbalagensNecessarias = data.total_kg_L / tamanhoEmb;
            const custoEstimado = Math.ceil(qtdEmbalagensNecessarias) * (insumo.preco_unitario || 0); 
            custoTotalInsumos += custoEstimado;
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
    
    return { 
        itens: resumo, 
        custoTotalInsumos, 
        custoTerceirizadoEstimado, 
        custoGeralEstimado: custoTotalInsumos + custoTerceirizadoEstimado 
    };
  }, [planFases, insumos, planPlantas]);

  const generatePDF = () => {
    const doc = new jsPDF();
    doc.setFontSize(18); doc.text(`Planejamento: ${planNome}`, 14, 20);
    doc.setFontSize(11); doc.setTextColor(100); doc.text(`Cultura: ${planCultura.toUpperCase()} | Ciclo por: ${cicloLabels[planTipoCiclo]}s | Plantas: ${planPlantas || 0}`, 14, 28);
    doc.setFontSize(14); doc.setTextColor(0); doc.text('Cronograma de Aplicações e Serviços', 14, 40);
    
    const cronogramaRows = [];
    const prefixoEtapa = planTipoCiclo === 'livre' ? 'Etapa' : cicloLabels[planTipoCiclo];

    planFases.forEach(f => {
        const phaseName = f.nome_etapa ? ` - ${f.nome_etapa.toUpperCase()}` : '';
        cronogramaRows.push([{ content: `${prefixoEtapa} ${f.momento}${phaseName}`, colSpan: 5, styles: { fillColor: [230, 245, 240], textColor: [6, 78, 59], fontStyle: 'bold', halign: 'left' } }]);
        
        if (f.aplicacoes.length === 0) {
            cronogramaRows.push([{ content: 'Nenhum item cadastrado.', colSpan: 5, styles: { fontStyle: 'italic', halign: 'center', textColor: [150, 150, 150] } }]);
        } else {
            f.aplicacoes.forEach(app => {
                if (app.metodo === 'terceirizado') {
                    cronogramaRows.push([ f.momento.toString(), 'Terceirizado', app.descricao_servico || 'Serviço', `R$ ${parseFloat(app.valor_estimado || 0).toLocaleString('pt-BR')}`, '-' ]);
                } else {
                    const insumo = getInsumoDetalhes(app.insumo_id);
                    
                    let usoTotalStr = '-';
                    const qtd = parseFloat(app.quantidade) || 0;
                    const plantas = parseInt(planPlantas) || 0;
                    if (qtd > 0) {
                        if (app.modo_aplicacao === 'g/planta' && plantas > 0) usoTotalStr = `${((qtd * plantas) / 1000).toLocaleString('pt-BR', {maximumFractionDigits: 2})} kg`;
                        else if (app.modo_aplicacao === 'kg/area') usoTotalStr = `${qtd.toLocaleString('pt-BR', {maximumFractionDigits: 2})} kg`;
                        else if (app.modo_aplicacao === 'ml/area') usoTotalStr = `${(qtd / 1000).toLocaleString('pt-BR', {maximumFractionDigits: 2})} L`;
                        else if (app.modo_aplicacao === 'l/area') usoTotalStr = `${qtd.toLocaleString('pt-BR', {maximumFractionDigits: 2})} L`;
                    }

                    cronogramaRows.push([ f.momento.toString(), app.metodo === 'foliar' ? 'Foliar' : 'Adubação', insumo ? insumo.nome : '-', `${app.quantidade} ${app.modo_aplicacao}`, usoTotalStr ]);
                }
            });
        }
    });
    
    autoTable(doc, { startY: 45, head: [['Etapa', 'Método', 'Insumo/Serviço', 'Dosagem/Valor', 'Uso Total']], body: cronogramaRows, theme: 'grid', headStyles: { fillColor: [16, 185, 129] }, styles: { fontSize: 9 } });
    const finalY = doc.lastAutoTable.finalY || 45;
    
    doc.setFontSize(14); doc.text('Resumo de Compras e Estimativas', 14, finalY + 15);
    const resumoRows = [];
    resumoCompras.itens.forEach(item => {
        resumoRows.push([ item.nome, `R$ ${(item.preco_unitario || 0).toLocaleString('pt-BR', {minimumFractionDigits: 2})}`, `${item.quantidadeTotalBase.toLocaleString('pt-BR', {maximumFractionDigits: 2})} ${item.unidadeCalculada}`, `${Math.ceil(item.qtdEmbalagens)} un.`, `R$ ${item.custoEstimado.toLocaleString('pt-BR', {minimumFractionDigits: 2})}` ]);
    });
    
    autoTable(doc, { 
        startY: finalY + 20, 
        head: [['Produto', 'Preço Ref. (Emb)', 'Necessidade', 'Comprar', 'Custo Est.']], 
        body: resumoRows, 
        foot: [
            ['', '', '', 'Insumos Estimados:', `R$ ${resumoCompras.custoTotalInsumos.toLocaleString('pt-BR', {minimumFractionDigits: 2})}`],
            ['', '', '', 'Serviços Estimados:', `R$ ${resumoCompras.custoTerceirizadoEstimado.toLocaleString('pt-BR', {minimumFractionDigits: 2})}`],
            ['', '', '', 'TOTAL GERAL ESTIMADO:', `R$ ${resumoCompras.custoGeralEstimado.toLocaleString('pt-BR', {minimumFractionDigits: 2})}`]
        ], 
        theme: 'grid', headStyles: { fillColor: [59, 130, 246] }, footStyles: { fillColor: [240, 240, 240], textColor: [0,0,0], fontStyle: 'bold' }, styles: { fontSize: 9 } 
    });
    doc.save(`Planejamento_${planNome.replace(/\s+/g, '_')}.pdf`);
  };

  const generateExcel = () => {
    let csv = '\uFEFF'; 
    const prefixoEtapa = planTipoCiclo === 'livre' ? 'Etapa' : cicloLabels[planTipoCiclo];
    csv += `Planejamento:;${planNome}\n`; csv += `Cultura:;${planCultura}\n`; csv += `Ciclo por:;${prefixoEtapa}s\n`; csv += `Qtd de Plantas:;${planPlantas || 0}\n\n`;
    csv += 'CRONOGRAMA DE APLICACOES\n'; csv += 'Etapa;Nome da Etapa;Metodo;Produto_ou_Servico;Quantidade_ou_Estimativa;Modo_Aplicacao;Uso_Total\n';
    planFases.forEach(f => {
        if (f.aplicacoes.length === 0) { csv += `${prefixoEtapa} ${f.momento};${f.nome_etapa || '-'};-;-;-;-;-\n`; } 
        else {
            f.aplicacoes.forEach(app => {
                if (app.metodo === 'terceirizado') {
                    csv += `${prefixoEtapa} ${f.momento};${f.nome_etapa || '-'};Terceirizado;${app.descricao_servico || 'Servico'};R$ ${app.valor_estimado || 0};Valor Estimado;-\n`;
                } else {
                    const insumo = getInsumoDetalhes(app.insumo_id); const nomeInsumo = insumo ? insumo.nome : '-'; const metodo = app.metodo === 'foliar' ? 'Foliar' : 'Adubacao';
                    
                    let usoTotalStr = '-';
                    const qtd = parseFloat(app.quantidade) || 0;
                    const plantas = parseInt(planPlantas) || 0;
                    if (qtd > 0) {
                        if (app.modo_aplicacao === 'g/planta' && plantas > 0) usoTotalStr = `${((qtd * plantas) / 1000).toLocaleString('pt-BR', {maximumFractionDigits: 2})} kg`;
                        else if (app.modo_aplicacao === 'kg/area') usoTotalStr = `${qtd.toLocaleString('pt-BR', {maximumFractionDigits: 2})} kg`;
                        else if (app.modo_aplicacao === 'ml/area') usoTotalStr = `${(qtd / 1000).toLocaleString('pt-BR', {maximumFractionDigits: 2})} L`;
                        else if (app.modo_aplicacao === 'l/area') usoTotalStr = `${qtd.toLocaleString('pt-BR', {maximumFractionDigits: 2})} L`;
                    }

                    csv += `${prefixoEtapa} ${f.momento};${f.nome_etapa || '-'};${metodo};${nomeInsumo};${app.quantidade};${app.modo_aplicacao};${usoTotalStr}\n`;
                }
            });
        }
    });
    csv += '\nRESUMO DE COMPRAS (INSUMOS)\n'; csv += 'Produto;Preco Ref. da Embalagem;Necessidade Total;Unidade de Medida;Comprar (Embalagens);Custo Estimado\n';
    resumoCompras.itens.forEach(item => {
        const preco = (item.preco_unitario || 0).toLocaleString('pt-BR', {minimumFractionDigits: 2}); const totalBase = item.quantidadeTotalBase.toLocaleString('pt-BR', {maximumFractionDigits: 2}); const emb = Math.ceil(item.qtdEmbalagens).toString(); const custo = item.custoEstimado.toLocaleString('pt-BR', {minimumFractionDigits: 2});
        csv += `${item.nome};R$ ${preco};${totalBase};${item.unidadeCalculada};${emb};R$ ${custo}\n`;
    });
    csv += `\nCusto Estimado Insumos;;;;;R$ ${resumoCompras.custoTotalInsumos.toLocaleString('pt-BR', {minimumFractionDigits: 2})}\n`;
    csv += `Custo Estimado Terceirizados;;;;;R$ ${resumoCompras.custoTerceirizadoEstimado.toLocaleString('pt-BR', {minimumFractionDigits: 2})}\n`;
    csv += `CUSTO TOTAL ESTIMADO;;;;;R$ ${resumoCompras.custoGeralEstimado.toLocaleString('pt-BR', {minimumFractionDigits: 2})}\n`;
    
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' }); const link = document.createElement('a'); link.href = URL.createObjectURL(blob); link.setAttribute('download', `Planejamento_${planNome.replace(/\s+/g, '_')}.csv`); document.body.appendChild(link); link.click(); document.body.removeChild(link);
  };

  return (
    <div className="space-y-6">
      
      <Dialog open={openApplyModal} onOpenChange={setOpenApplyModal}>
        <DialogContent className="sm:max-w-md rounded-[2rem]">
            <DialogHeader>
                <DialogTitle className="flex items-center gap-2 text-emerald-700">
                    <Send className="w-5 h-5" /> Aplicar Planejamento
                </DialogTitle>
                <DialogDescription>
                    Gerar atividades no calendário da Safra selecionada.
                </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 pt-4">
                <div className="space-y-2">
                    <Label>Safra Destino (Ativa)</Label>
                    <Select value={applySafraId} onValueChange={setApplySafraId}>
                        <SelectTrigger className="rounded-xl"><SelectValue placeholder="Selecione a safra..." /></SelectTrigger>
                        <SelectContent>
                            {safras.length === 0 && <SelectItem value="none" disabled>Nenhuma safra ativa.</SelectItem>}
                            {safras.map(s => <SelectItem key={s.id} value={s.id}>{s.nome} ({s.talhoes?.nome})</SelectItem>)}
                        </SelectContent>
                    </Select>
                </div>
                <div className="space-y-2">
                    <Label>Data Base de Início {planTipoCiclo === 'livre' && <span className="text-stone-400 font-normal">(opcional)</span>}</Label>
                    <Input type="date" value={applyStartDate} onChange={e => setApplyStartDate(e.target.value)} className="rounded-xl" />
                    {planTipoCiclo === 'livre' ? (
                        <p className="text-[10px] text-stone-500">As etapas nascem <b>sem data</b> em Atividades, na ordem certa. Você escolhe a data real de cada uma só quando marcar como concluída — e é aí que o custo entra no financeiro daquele talhão.</p>
                    ) : (
                        <p className="text-[10px] text-stone-500">As {cicloLabels[planTipoCiclo]}s serão calculadas a partir desta data.</p>
                    )}
                </div>
            </div>
            <DialogFooter className="mt-4">
                <Button variant="outline" onClick={() => setOpenApplyModal(false)} className="rounded-xl">Cancelar</Button>
                <Button onClick={() => applyToSafraMutation.mutate()} disabled={applyToSafraMutation.isPending || !applySafraId} className="bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl">
                    {applyToSafraMutation.isPending ? 'Agendando...' : 'Gerar Atividades'}
                </Button>
            </DialogFooter>
        </DialogContent>
      </Dialog>

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
                        <DialogHeader><DialogTitle>Novo Ciclo de Planejamento</DialogTitle><DialogDescription>Crie o esqueleto base de aplicações.</DialogDescription></DialogHeader>
                        <div className="space-y-4 pt-4">
                            <div className="space-y-2">
                                <Label>Nome do Planejamento</Label>
                                <Input value={novoPlan.nome} onChange={e => setNovoPlan({...novoPlan, nome: e.target.value})} className="rounded-xl" placeholder="Ex: Manga Palmer - Sem Data Fixa" />
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
                                            <SelectItem value="livre">Livre / Etapas</SelectItem>
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
                    <Button onClick={generatePDF} className="bg-white border border-stone-200 text-stone-700 hover:bg-stone-50 rounded-xl px-3 shadow-sm transition-all" title="Baixar PDF">
                        <FileText className="w-4 h-4 text-red-500 sm:mr-2" /> <span className="hidden sm:inline">PDF</span>
                    </Button>
                    <Button onClick={generateExcel} className="bg-white border border-stone-200 text-stone-700 hover:bg-stone-50 rounded-xl px-3 shadow-sm transition-all" title="Baixar Excel">
                        <TableIcon className="w-4 h-4 text-emerald-600 sm:mr-2" /> <span className="hidden sm:inline">Excel</span>
                    </Button>
                    
                    <div className="w-px h-8 bg-stone-200 mx-1 hidden sm:block"></div>

                    <Button onClick={() => setOpenApplyModal(true)} className="bg-emerald-100 hover:bg-emerald-200 border border-emerald-200 text-emerald-800 font-bold rounded-xl px-4 shadow-sm transition-all" disabled={planFases.length === 0} title="Aplicar isso no calendário real">
                        <PlayCircle className="w-4 h-4 mr-2" /> Aplicar na Safra
                    </Button>

                    <Button onClick={() => duplicateMutation.mutate()} className="bg-white border border-stone-200 text-stone-700 hover:bg-blue-50 hover:text-blue-700 rounded-xl px-4 shadow-sm transition-all" disabled={duplicateMutation.isPending} title="Duplicar Planejamento">
                        <Copy className="w-4 h-4 mr-2 text-blue-500" /> Duplicar
                    </Button>

                    <Button onClick={handleSaveCurrent} className="flex-1 sm:flex-none bg-blue-600 hover:bg-blue-700 text-white rounded-xl px-6 shadow-lg shadow-blue-100" disabled={saveMutation.isPending}>
                        <Save className="w-4 h-4 mr-2" /> Salvar
                    </Button>
                    <Button variant="outline" className="text-red-500 hover:bg-red-50 border-red-200 rounded-xl px-4" onClick={() => { if(confirm("Excluir planejamento?")) deleteMutation.mutate(activePlanId) }}>
                        <Trash2 className="w-4 h-4" />
                    </Button>
                </div>
            )}
        </div>
      </div>

      {activePlanId !== 'novo' ? (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
              
              <div className="lg:col-span-2 space-y-6">
                  <div className="bg-stone-50 rounded-[2rem] p-6 border border-stone-100 flex flex-col md:flex-row md:items-center justify-between gap-4">
                      <div>
                          <div className="flex items-center gap-3">
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
                                  <Settings className="w-4 h-4"/> Formato: <b>{planTipoCiclo === 'livre' ? 'Livre (Sem Data)' : `${cicloLabels[planTipoCiclo]}s`}</b>
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
                              <DialogHeader><DialogTitle>Adicionar Etapa</DialogTitle><DialogDescription>Digite o número da etapa no ciclo.</DialogDescription></DialogHeader>
                              <div className="space-y-4 pt-2">
                                  <div className="space-y-2">
                                      <Label>{planTipoCiclo === 'livre' ? 'Ordem da Etapa (Ex: 1, 2, 3...)' : `Número do ${cicloLabels[planTipoCiclo]} (Ex: -7, 0, 14)`}</Label>
                                      <Input type="number" value={novaFaseMomento} onChange={e => setNovaFaseMomento(e.target.value)} className="rounded-xl" placeholder="Digite o número..." />
                                  </div>
                                  <Button onClick={handleAddFase} className="w-full bg-emerald-600 hover:bg-emerald-700 rounded-xl" disabled={!novaFaseMomento}>
                                      Adicionar à Linha do Tempo
                                  </Button>
                              </div>
                          </DialogContent>
                      </Dialog>
                  </div>

                  <div className="space-y-6 relative before:absolute before:inset-0 before:ml-6 before:-translate-x-px md:before:mx-auto md:before:translate-x-0 before:h-full before:w-0.5 before:bg-gradient-to-b before:from-stone-200 before:via-emerald-200 before:to-stone-100">
                      {planFases.length === 0 ? (
                          <div className="relative z-10 text-center py-10">
                              <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-stone-100 border-4 border-white shadow-sm mb-3">
                                  <Calendar className="w-5 h-5 text-stone-400" />
                              </div>
                              <p className="text-stone-500 font-medium text-sm">Nenhuma etapa programada.</p>
                              <p className="text-stone-400 text-xs mt-1">Clique em "Adicionar {cicloLabels[planTipoCiclo]}" para começar.</p>
                          </div>
                      ) : (
                          planFases.map((fase) => (
                              <div key={fase.id} className="relative z-10 flex items-start flex-col md:flex-row gap-4 group">
                                  <div className="flex items-center md:justify-end w-12 md:w-32 pt-3 shrink-0">
                                      <div className="hidden md:block mr-4 text-right">
                                          <div className="text-[10px] font-bold uppercase text-stone-400 tracking-wider">
                                              {planTipoCiclo === 'livre' ? 'Etapa' : cicloLabels[planTipoCiclo]}
                                          </div>
                                          <div className="text-xl font-black text-emerald-600">{fase.momento}</div>
                                          {fase.nome_etapa && <div className="text-xs font-bold text-stone-500 mt-1 max-w-[80px] truncate ml-auto" title={fase.nome_etapa}>{fase.nome_etapa}</div>}
                                      </div>
                                      <div className="w-12 h-12 rounded-full bg-white border-4 border-emerald-100 shadow-sm flex items-center justify-center relative md:-mr-6 z-10">
                                          <CircleDot className="w-5 h-5 text-emerald-500" />
                                      </div>
                                      <div className="md:hidden ml-4 flex flex-col">
                                          <span className="font-bold text-stone-700">{planTipoCiclo === 'livre' ? 'Etapa' : cicloLabels[planTipoCiclo]} {fase.momento}</span>
                                          {fase.nome_etapa && <span className="text-xs text-stone-500 font-medium">{fase.nome_etapa}</span>}
                                      </div>
                                  </div>

                                  <Card className="flex-1 w-full border-stone-200/60 shadow-sm hover:shadow-md transition-shadow rounded-2xl ml-12 md:ml-0 overflow-hidden bg-white/80 backdrop-blur-sm">
                                      <div className="bg-stone-50/80 px-4 py-3 border-b border-stone-100 flex flex-col xl:flex-row xl:items-center justify-between gap-3">
                                          <div className="flex items-center gap-2 flex-1">
                                              <Input
                                                  placeholder="Nome da etapa (Ex: Indução...)"
                                                  value={fase.nome_etapa || ''}
                                                  onChange={(e) => handleUpdateFase(fase.id, 'nome_etapa', e.target.value)}
                                                  className="h-8 text-sm font-bold bg-white/60 border-stone-200 focus-visible:ring-emerald-500 w-full max-w-[250px] shadow-sm"
                                              />
                                          </div>

                                          <div className="flex gap-2 mt-2 xl:mt-0">
                                              <Button variant="outline" size="sm" onClick={() => handleAddAplicacao(fase.id)} className="h-8 text-xs bg-white text-emerald-600 border-emerald-200 hover:bg-emerald-50 shadow-sm">
                                                  <Plus className="w-3 h-3 mr-1"/> Adicionar Item
                                              </Button>
                                              <Button variant="ghost" size="sm" onClick={() => handleRemoveFase(fase.id)} className="h-8 w-8 p-0 text-stone-400 hover:text-red-500 hover:bg-red-50 rounded-lg">
                                                  <Trash2 className="w-4 h-4"/>
                                              </Button>
                                          </div>
                                      </div>
                                      
                                      <div className="p-4">
                                          {fase.aplicacoes.length === 0 ? (
                                              <p className="text-xs text-stone-400 italic text-center py-2">
                                                  Nenhum item adicionado nesta etapa.
                                              </p>
                                          ) : (
                                              <div className="space-y-3">
                                                  {fase.aplicacoes.map((app) => {
                                                      const config = metodoConfig[app.metodo] || metodoConfig.foliar;
                                                      const Icon = config.icon;

                                                      const plantas = parseInt(planPlantas) || 0;
                                                      const qtdFisica = parseFloat(app.quantidade) || 0;
                                                      const pesoCalculado = (app.modo_aplicacao === 'g/planta' && plantas > 0) 
                                                        ? (qtdFisica * plantas) / 1000 
                                                        : 0;

                                                      return (
                                                          <div key={app.id} className="flex flex-col md:flex-row gap-2 md:items-center p-2 rounded-xl bg-stone-50/50 border border-stone-100 hover:border-stone-200 transition-colors">
                                                              <Select value={app.metodo} onValueChange={(v) => {
                                                                  handleUpdateAplicacao(fase.id, app.id, 'metodo', v);
                                                                  if (v !== 'terceirizado') {
                                                                      handleUpdateAplicacao(fase.id, app.id, 'modo_aplicacao', v === 'foliar' ? 'ml/area' : 'g/planta');
                                                                  }
                                                              }}>
                                                                  <SelectTrigger className={`w-full md:w-[130px] h-9 text-xs font-bold rounded-lg ${config.bg} ${config.color}`}>
                                                                      <div className="flex items-center gap-2"><Icon className="w-3 h-3" /><span>{config.label}</span></div>
                                                                  </SelectTrigger>
                                                                  <SelectContent>
                                                                      <SelectItem value="foliar"><div className="flex items-center gap-2"><Droplets className="w-3 h-3 text-blue-500"/> Foliar</div></SelectItem>
                                                                      <SelectItem value="adubacao"><div className="flex items-center gap-2"><Leaf className="w-3 h-3 text-emerald-500"/> Adubação</div></SelectItem>
                                                                      <SelectItem value="terceirizado"><div className="flex items-center gap-2"><Briefcase className="w-3 h-3 text-amber-600"/> Terceirizado</div></SelectItem>
                                                                  </SelectContent>
                                                              </Select>

                                                              {app.metodo === 'terceirizado' ? (
                                                                  <>
                                                                      <Input 
                                                                          placeholder="Descrição do serviço (ex: Poda, Roçada)" 
                                                                          value={app.descricao_servico || ''} 
                                                                          onChange={(e) => handleUpdateAplicacao(fase.id, app.id, 'descricao_servico', e.target.value)}
                                                                          className="flex-1 h-9 text-xs rounded-lg bg-white border-stone-200"
                                                                      />
                                                                      <div className="flex items-center justify-between md:justify-end gap-2 w-full md:w-auto shrink-0 mt-2 md:mt-0">
                                                                          <Label className="text-[10px] text-stone-500 font-bold whitespace-nowrap">R$ Est.</Label>
                                                                          <Input 
                                                                              type="number" 
                                                                              placeholder="Opcional" 
                                                                              value={app.valor_estimado || ''} 
                                                                              onChange={(e) => handleUpdateAplicacao(fase.id, app.id, 'valor_estimado', e.target.value)}
                                                                              className="w-24 h-9 text-xs rounded-lg bg-white text-center font-bold"
                                                                          />
                                                                          <Button variant="ghost" size="sm" onClick={() => handleRemoveAplicacao(fase.id, app.id)} className="h-8 w-8 p-0 text-stone-300 hover:text-red-500 hover:bg-white shrink-0"><Trash2 className="w-3 h-3"/></Button>
                                                                      </div>
                                                                  </>
                                                              ) : (
                                                                  <>
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

                                                                      <div className="flex items-center justify-between md:justify-end gap-2 w-full md:w-auto shrink-0 mt-2 md:mt-0">
                                                                          <Input type="number" placeholder="Qtd" value={app.quantidade} onChange={(e) => handleUpdateAplicacao(fase.id, app.id, 'quantidade', e.target.value)} className="w-20 h-9 text-xs rounded-lg bg-white text-center font-bold" />
                                                                          <Select value={app.modo_aplicacao || (app.metodo === 'foliar' ? 'ml/area' : 'g/planta')} onValueChange={(v) => handleUpdateAplicacao(fase.id, app.id, 'modo_aplicacao', v)}>
                                                                              <SelectTrigger className="w-28 h-9 text-xs rounded-lg bg-white font-medium"><SelectValue /></SelectTrigger>
                                                                              <SelectContent>
                                                                                  {app.metodo === 'foliar' ? (
                                                                                      <><SelectItem value="ml/area">ml / área</SelectItem><SelectItem value="l/area">L / área</SelectItem></>
                                                                                  ) : (
                                                                                      <><SelectItem value="g/planta">g / planta</SelectItem><SelectItem value="kg/area">kg / área</SelectItem></>
                                                                                  )}
                                                                              </SelectContent>
                                                                          </Select>

                                                                          {pesoCalculado > 0 && (
                                                                            <div className="flex flex-col items-center justify-center bg-emerald-50 border border-emerald-100 px-2 py-0.5 rounded-lg">
                                                                              <span className="text-[8px] font-black text-emerald-700 uppercase leading-none mb-1">Uso Total</span>
                                                                              <span className="text-[11px] font-black text-emerald-600 leading-none whitespace-nowrap">{pesoCalculado.toLocaleString('pt-BR', {minimumFractionDigits: 1})} <span className="text-[8px]">kg</span></span>
                                                                            </div>
                                                                          )}

                                                                          <Button variant="ghost" size="sm" onClick={() => handleRemoveAplicacao(fase.id, app.id)} className="h-8 w-8 p-0 text-stone-300 hover:text-red-500 hover:bg-white shrink-0"><Trash2 className="w-3 h-3"/></Button>
                                                                      </div>
                                                                  </>
                                                              )}
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
                                      R$ {resumoCompras.custoGeralEstimado.toLocaleString('pt-BR', {minimumFractionDigits: 2})}
                                  </div>
                                  <div className="flex justify-center gap-4 mt-2 text-[10px] text-emerald-100/70 font-medium">
                                      <span>Insumos: R$ {resumoCompras.custoTotalInsumos.toLocaleString('pt-BR')}</span>
                                      <span>Mão de Obra: R$ {resumoCompras.custoTerceirizadoEstimado.toLocaleString('pt-BR')}</span>
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
