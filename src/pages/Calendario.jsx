import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabaseClient';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { ChevronLeft, ChevronRight, Calendar as CalendarIcon, Circle, ArrowRight, FileText, User, MapPin, DollarSign, Copy, Package } from 'lucide-react';
import { format, startOfMonth, endOfMonth, eachDayOfInterval, isSameDay, addMonths, subMonths, isToday, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { cn } from '@/lib/utils';

const tiposAtividadeLabels = {
  inducao: { label: 'Indução', color: 'bg-purple-500', text: 'text-white' },
  poda: { label: 'Poda', color: 'bg-emerald-500', text: 'text-white' },
  adubacao: { label: 'Adubação', color: 'bg-amber-500', text: 'text-white' },
  pulverizacao: { label: 'Pulverização', color: 'bg-blue-500', text: 'text-white' },
  maturacao: { label: 'Maturação', color: 'bg-orange-500', text: 'text-white' },
  irrigacao: { label: 'Irrigação', color: 'bg-cyan-500', text: 'text-white' },
  capina: { label: 'Capina', color: 'bg-lime-500', text: 'text-white' },
  outro: { label: 'Outro', color: 'bg-stone-500', text: 'text-white' }
};

export default function Calendario() {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [filtroTalhao, setFiltroTalhao] = useState('todos');

  // Estados para o Modal
  const [selectedActivity, setSelectedActivity] = useState(null);
  const [isModalOpen, setIsModalOpen] = useState(false);

  const { data: atividades = [] } = useQuery({
    queryKey: ['atividades'],
    queryFn: async () => {
      const { data, error } = await supabase.from('atividades').select('*');
      if (error) throw error;
      return data;
    }
  });

  const { data: talhoes = [] } = useQuery({
    queryKey: ['talhoes'],
    queryFn: async () => {
      const { data, error } = await supabase.from('talhoes').select('*');
      if (error) throw error;
      return data;
    }
  });

  const monthStart = startOfMonth(currentDate);
  const monthEnd = endOfMonth(currentDate);
  const days = eachDayOfInterval({ start: monthStart, end: monthEnd });
  const startDay = monthStart.getDay();
  const previousDays = Array.from({ length: startDay }, (_, i) => {
    const d = new Date(monthStart);
    d.setDate(d.getDate() - (startDay - i));
    return d;
  });

  const getAtividadesForDate = (date) => {
    return atividades.filter(a => {
      if (filtroTalhao !== 'todos' && a.talhao_id !== filtroTalhao) return false;
      const d = a.data_programada ? new Date(a.data_programada + 'T12:00:00') : null;
      return d && isSameDay(d, date);
    });
  };

  const getTalhaoNome = (id) => talhoes.find(t => t.id === id)?.nome || '-';

  // Função para abrir o modal
  const handleActivityClick = (activity) => {
    setSelectedActivity(activity);
    setIsModalOpen(true);
  };

  // Gerador de Texto para Copiar (Reutilizado para consistência)
  const generateActivityText = (activity) => {
    if (!activity) return '';
    const talhaoNome = getTalhaoNome(activity.talhao_id);
    const data = format(parseISO(activity.data_programada), 'dd/MM/yyyy');
    const tipo = activity.tipo === 'outro' ? activity.tipo_personalizado : tiposAtividadeLabels[activity.tipo]?.label || activity.tipo;

    let text = `🚜 *ATIVIDADE PROGRAMADA*\n\n`;
    text += `📍 *Válvula:* ${talhaoNome}\n`;
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

  const copyToClipboard = () => {
      if (!selectedActivity) return;
      navigator.clipboard.writeText(generateActivityText(selectedActivity));
      alert("Texto copiado!");
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      
      {/* --- MODAL DE DETALHES DA ATIVIDADE --- */}
      <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
        <DialogContent className="sm:max-w-md rounded-[2rem] bg-white p-0 overflow-hidden">
            {selectedActivity && (() => {
                const config = tiposAtividadeLabels[selectedActivity.tipo] || tiposAtividadeLabels.outro;
                return (
                <div className="flex flex-col h-full">
                    <div className={cn("px-6 py-4 flex items-center justify-between", config.color)}>
                        <div className="flex items-center gap-3 text-white">
                            <CalendarIcon className="w-5 h-5 opacity-80" />
                            <DialogTitle className="text-lg font-bold capitalize text-white">
                                {config.label}
                            </DialogTitle>
                        </div>
                        <Badge className="bg-white/20 hover:bg-white/30 text-white border-none font-semibold">
                            {format(parseISO(selectedActivity.data_programada), 'dd/MM/yyyy')}
                        </Badge>
                    </div>
                    
                    <div className="p-6 space-y-5">
                        {/* Infos Principais */}
                        <div className="grid grid-cols-2 gap-4">
                            <div className="bg-stone-50 p-3 rounded-xl border border-stone-100">
                                <Label className="text-[10px] uppercase tracking-wider text-stone-400 font-bold flex items-center gap-1 mb-1"><MapPin className="w-3 h-3"/> Válvula</Label>
                                <p className="font-bold text-stone-800 text-sm">{getTalhaoNome(selectedActivity.talhao_id)}</p>
                            </div>
                            <div className="bg-stone-50 p-3 rounded-xl border border-stone-100">
                                <Label className="text-[10px] uppercase tracking-wider text-stone-400 font-bold flex items-center gap-1 mb-1"><User className="w-3 h-3"/> Responsável</Label>
                                <p className="font-bold text-stone-800 text-sm">{selectedActivity.responsavel || '-'}</p>
                            </div>
                        </div>

                        {/* Insumos */}
                        {selectedActivity.insumos_utilizados && selectedActivity.insumos_utilizados.length > 0 && (
                            <div className="bg-stone-50 p-4 rounded-xl border border-stone-100">
                                <Label className="text-[10px] uppercase tracking-wider text-stone-400 font-bold flex items-center gap-1 mb-3"><Package className="w-3 h-3"/> Insumos Definidos</Label>
                                <div className="space-y-2">
                                    {selectedActivity.insumos_utilizados.map((ins, idx) => (
                                        <div key={idx} className="flex justify-between items-center text-sm border-b border-stone-200/50 last:border-0 pb-1 last:pb-0">
                                            <span className="text-stone-700 font-medium">{ins.nome}</span>
                                            <span className="text-stone-500">{ins.quantidade} {ins.unidade} <span className="text-[10px] bg-stone-200 px-1 rounded ml-1 text-stone-600">{ins.metodo_aplicacao}</span></span>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}
                        
                        {/* Observações */}
                        <div className="bg-stone-50 p-4 rounded-xl border border-stone-100">
                            <Label className="text-[10px] uppercase tracking-wider text-stone-400 font-bold flex items-center gap-1 mb-2"><FileText className="w-3 h-3"/> Recomendação / Obs</Label>
                            {selectedActivity.observacoes ? (
                                <p className="text-sm text-stone-700 whitespace-pre-wrap leading-relaxed font-medium">{selectedActivity.observacoes}</p>
                            ) : (
                                <p className="text-sm text-stone-400 italic">Sem observações adicionais.</p>
                            )}
                        </div>

                        {/* Footer do Modal */}
                        <div className="pt-2">
                            <Button onClick={copyToClipboard} className="w-full rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold h-11 shadow-lg shadow-emerald-100">
                                <Copy className="w-4 h-4 mr-2" /> Copiar Texto Recomendação
                            </Button>
                        </div>
                    </div>
                </div>
                );
            })()}
        </DialogContent>
      </Dialog>


      {/* Header e Filtros */}
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
        <div>
          {/* Fonte mais leve: font-semibold */}
          <h1 className="text-3xl font-semibold text-stone-900 tracking-tight">Calendário Operacional</h1>
          <p className="text-stone-500 font-medium">Cronograma detalhado de manejo e atividades</p>
        </div>
        <div className="flex items-center gap-3">
          <Label className="font-medium text-stone-400 uppercase text-[11px] tracking-wider">Filtrar Válvula:</Label>
          <Select value={filtroTalhao} onValueChange={setFiltroTalhao}>
            <SelectTrigger className="w-56 rounded-xl border-stone-200 bg-white shadow-sm h-11 font-medium text-stone-600">
              <SelectValue placeholder="Selecione..." />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todas as Válvulas</SelectItem>
              {talhoes.map(t => <SelectItem key={t.id} value={t.id}>{t.nome}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
        
        {/* COLUNA ESQUERDA: CALENDÁRIO */}
        <Card className="lg:col-span-3 border-none shadow-xl shadow-stone-200/50 rounded-[2.5rem] bg-white overflow-hidden">
          <CardHeader className="bg-stone-50/50 border-b border-stone-100 flex flex-row items-center justify-between p-8">
            {/* Fonte mais leve */}
            <CardTitle className="text-2xl font-bold text-stone-800 capitalize">
              {format(currentDate, 'MMMM yyyy', { locale: ptBR })}
            </CardTitle>
            <div className="flex items-center gap-3">
              <Button variant="outline" size="icon" onClick={() => setCurrentDate(subMonths(currentDate, 1))} className="rounded-full h-10 w-10 border-stone-200 hover:bg-emerald-50 hover:text-emerald-600 transition-colors">
                <ChevronLeft className="w-5 h-5" />
              </Button>
              <Button variant="outline" onClick={() => {setCurrentDate(new Date()); setSelectedDate(new Date());}} className="rounded-2xl font-semibold h-10 px-6 border-stone-200 hover:border-emerald-500 hover:text-emerald-600 transition-all text-stone-600">Hoje</Button>
              <Button variant="outline" size="icon" onClick={() => setCurrentDate(addMonths(currentDate, 1))} className="rounded-full h-10 w-10 border-stone-200 hover:bg-emerald-50 hover:text-emerald-600 transition-colors">
                <ChevronRight className="w-5 h-5" />
              </Button>
            </div>
          </CardHeader>
          <CardContent className="p-8">
            <div className="grid grid-cols-7 mb-6">
              {['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'].map(day => (
                <div key={day} className="text-center font-bold text-stone-400 text-[11px] uppercase tracking-widest">{day}</div>
              ))}
            </div>
            
            <div className="grid grid-cols-7 gap-4">
              {previousDays.map((date, idx) => (
                <div key={idx} className="min-h-[120px] p-3 rounded-3xl bg-stone-50/30 opacity-40 border border-stone-100/50 flex flex-col items-start pointer-events-none">
                  <span className="text-xs font-medium text-stone-400">{format(date, 'd')}</span>
                </div>
              ))}

              {days.map((date) => {
                const dayAtivs = getAtividadesForDate(date);
                const isSel = isSameDay(date, selectedDate);
                const isTod = isToday(date);
                
                return (
                  <div key={date.toISOString()} onClick={() => setSelectedDate(date)} 
                    className={cn(
                      "min-h-[140px] p-3 rounded-[2rem] cursor-pointer transition-all border-2 group flex flex-col gap-2 relative overflow-hidden",
                      isSel ? "bg-emerald-600 border-emerald-600 shadow-2xl shadow-emerald-200 translate-y-[-4px]" : 
                      isTod ? "bg-white border-emerald-500/30 shadow-lg shadow-emerald-500/5" : "bg-white border-stone-100 hover:border-emerald-200 hover:shadow-xl hover:shadow-stone-200/40"
                    )}>
                    
                    {/* Número do Dia - Fonte mais leve */}
                    <div className="flex justify-between items-center mb-1 relative z-10">
                      <span className={cn(
                        "text-sm font-bold w-8 h-8 rounded-full flex items-center justify-center transition-colors",
                        isSel ? "text-white bg-white/20" : isTod ? "bg-emerald-500 text-white" : "text-stone-600 bg-stone-100/50"
                      )}>
                        {format(date, 'd')}
                      </span>
                    </div>

                    <div className="flex flex-col gap-1 relative z-10">
                      {dayAtivs.slice(0, 3).map((a, i) => {
                        const config = tiposAtividadeLabels[a.tipo] || tiposAtividadeLabels.outro;
                        return (
                          <div 
                            key={i} 
                            className={cn(
                              "text-[10px] px-2 py-1 rounded-lg font-medium truncate transition-colors flex items-center gap-1.5",
                              isSel ? "bg-white/20 text-white backdrop-blur-sm" : "bg-stone-50 text-stone-600 border border-stone-100"
                            )}
                          >
                            <div className={cn("w-1.5 h-1.5 rounded-full flex-shrink-0", config.color)} />
                            <span className="truncate">{config.label}</span>
                          </div>
                        );
                      })}
                      {dayAtivs.length > 3 && (
                        <p className={cn("text-[9px] font-semibold pl-1 mt-1", isSel ? "text-white/80" : "text-stone-400")}>
                          +{dayAtivs.length - 3} mais
                        </p>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>

        {/* COLUNA DIREITA: DETALHES DO DIA SELECIONADO */}
        <Card className="border-none shadow-xl shadow-stone-200/50 rounded-[2.5rem] bg-white overflow-hidden flex flex-col h-full lg:h-auto lg:min-h-[600px]">
          <CardHeader className="bg-emerald-600 p-8 text-center lg:text-left">
            <p className="text-emerald-100 font-semibold text-xs uppercase tracking-widest mb-1">Dia Selecionado</p>
            <CardTitle className="text-white flex flex-col lg:flex-row items-center lg:items-end gap-2 font-bold text-3xl">
                <span>{format(selectedDate, "dd")}</span>
                <span className="text-lg font-medium opacity-80 pb-1">{format(selectedDate, "MMMM", { locale: ptBR })}</span>
            </CardTitle>
            <p className="text-emerald-100/60 text-sm font-medium mt-1 capitalize">{format(selectedDate, "cccc", { locale: ptBR })}</p>
          </CardHeader>
          
          <CardContent className="p-0 flex-1 overflow-y-auto max-h-[600px] scrollbar-hide bg-stone-50/30">
            <div className="p-6 space-y-4">
              {getAtividadesForDate(selectedDate).length > 0 ? (
                getAtividadesForDate(selectedDate).map((a) => {
                  const config = tiposAtividadeLabels[a.tipo] || tiposAtividadeLabels.outro;
                  return (
                    <div 
                        key={a.id} 
                        onClick={() => handleActivityClick(a)}
                        className="p-5 bg-white rounded-[2rem] border border-stone-100 shadow-sm hover:shadow-md transition-all group relative overflow-hidden cursor-pointer"
                    >
                      <div className={cn("absolute left-0 top-0 bottom-0 w-2", config.color)} />
                      
                      <div className="flex items-center justify-between mb-3 pl-3">
                        <Badge className={cn("rounded-lg px-2 py-0.5 font-semibold uppercase text-[10px] border-none shadow-none bg-stone-100 text-stone-500 tracking-wide")}>
                          {config.label}
                        </Badge>
                        {a.status && (
                           <span className={cn(
                               "text-[9px] font-bold uppercase px-2 py-0.5 rounded-lg",
                               a.status === 'concluida' ? "bg-emerald-100 text-emerald-700" : "bg-blue-50 text-blue-600"
                           )}>
                               {a.status}
                           </span>
                        )}
                      </div>
                      
                      <div className="space-y-2 pl-3">
                        <div className="flex items-center gap-2">
                          <p className="text-sm font-bold text-stone-700 tracking-tight">Válvula: {getTalhaoNome(a.talhao_id)}</p>
                        </div>
                        <div className="flex items-center justify-between mt-3">
                            <p className="text-[10px] text-stone-400 font-medium flex items-center gap-1">
                                <FileText className="w-3 h-3"/> Ver recomendação
                            </p>
                            <ArrowRight className="w-4 h-4 text-stone-300 group-hover:text-emerald-500 transition-colors" />
                        </div>
                      </div>
                    </div>
                  );
                })
              ) : (
                <div className="text-center py-16 flex flex-col items-center">
                   <div className="w-16 h-16 bg-white rounded-full flex items-center justify-center mb-4 shadow-sm border border-stone-100">
                     <Circle className="w-8 h-8 text-stone-200" />
                   </div>
                   <p className="text-sm font-semibold text-stone-400">Nada programado.</p>
                   <p className="text-xs text-stone-300 mt-1">Dia livre de atividades.</p>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
      
      {/* Legenda Estilizada */}
      <Card className="border-none shadow-sm rounded-3xl bg-white p-6 overflow-hidden">
        <div className="flex flex-col lg:flex-row lg:items-center gap-6">
          <span className="text-[11px] font-bold text-stone-400 uppercase tracking-widest lg:border-r pr-6 border-stone-100">Legenda:</span>
          <div className="flex flex-wrap items-center gap-3">
            {Object.entries(tiposAtividadeLabels).map(([key, { label, color }]) => (
              <div key={key} className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-stone-50 border border-stone-100">
                <div className={cn("w-2 h-2 rounded-full shadow-sm", color)} />
                <span className="text-[10px] font-medium text-stone-600 uppercase tracking-wide">{label}</span>
              </div>
            ))}
          </div>
        </div>
      </Card>
    </div>
  );
}