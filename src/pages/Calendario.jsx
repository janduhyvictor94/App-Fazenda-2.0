import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabaseClient';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ChevronLeft, ChevronRight, Calendar as CalendarIcon, CheckCircle, Clock, Circle, ArrowRight } from 'lucide-react';
import { format, startOfMonth, endOfMonth, eachDayOfInterval, isSameDay, addMonths, subMonths, isToday } from 'date-fns';
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

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-stone-900 tracking-tight">Calendário Operacional</h1>
          <p className="text-stone-500 font-medium">Cronograma detalhado de manejo e atividades</p>
        </div>
        <div className="flex items-center gap-3">
          <Label className="font-bold text-stone-400 uppercase text-[11px] tracking-wider">Filtrar Talhão:</Label>
          <Select value={filtroTalhao} onValueChange={setFiltroTalhao}>
            <SelectTrigger className="w-56 rounded-xl border-stone-200 bg-white shadow-sm h-11">
              <SelectValue placeholder="Selecione o talhão" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todos os Talhões</SelectItem>
              {talhoes.map(t => <SelectItem key={t.id} value={t.id}>{t.nome}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
        <Card className="lg:col-span-3 border-none shadow-xl shadow-stone-200/50 rounded-[2.5rem] bg-white overflow-hidden">
          <CardHeader className="bg-stone-50/50 border-b border-stone-100 flex flex-row items-center justify-between p-8">
            <CardTitle className="text-2xl font-black text-stone-800 capitalize">
              {format(currentDate, 'MMMM yyyy', { locale: ptBR })}
            </CardTitle>
            <div className="flex items-center gap-3">
              <Button variant="outline" size="icon" onClick={() => setCurrentDate(subMonths(currentDate, 1))} className="rounded-full h-10 w-10 border-stone-200 hover:bg-emerald-50 hover:text-emerald-600 transition-colors">
                <ChevronLeft className="w-5 h-5" />
              </Button>
              <Button variant="outline" onClick={() => {setCurrentDate(new Date()); setSelectedDate(new Date());}} className="rounded-2xl font-bold h-10 px-6 border-stone-200 hover:border-emerald-500 hover:text-emerald-600 transition-all">Hoje</Button>
              <Button variant="outline" size="icon" onClick={() => setCurrentDate(addMonths(currentDate, 1))} className="rounded-full h-10 w-10 border-stone-200 hover:bg-emerald-50 hover:text-emerald-600 transition-colors">
                <ChevronRight className="w-5 h-5" />
              </Button>
            </div>
          </CardHeader>
          <CardContent className="p-8">
            <div className="grid grid-cols-7 mb-6">
              {['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'].map(day => (
                <div key={day} className="text-center font-black text-stone-400 text-[11px] uppercase tracking-widest">{day}</div>
              ))}
            </div>
            <div className="grid grid-cols-7 gap-4">
              {previousDays.map((date, idx) => (
                <div key={idx} className="min-h-[120px] p-3 rounded-3xl bg-stone-50/30 opacity-40 border border-stone-100/50 flex flex-col items-start">
                  <span className="text-xs font-bold">{format(date, 'd')}</span>
                </div>
              ))}
              {days.map((date) => {
                const dayAtivs = getAtividadesForDate(date);
                const isSel = isSameDay(date, selectedDate);
                const isTod = isToday(date);
                
                return (
                  <div key={date.toISOString()} onClick={() => setSelectedDate(date)} 
                    className={cn(
                      "min-h-[140px] p-3 rounded-[2rem] cursor-pointer transition-all border-2 group flex flex-col gap-2",
                      isSel ? "bg-emerald-600 border-emerald-600 shadow-2xl shadow-emerald-200 translate-y-[-4px]" : 
                      isTod ? "bg-white border-emerald-500/30 shadow-lg shadow-emerald-500/5" : "bg-white border-stone-100 hover:border-emerald-200 hover:shadow-xl hover:shadow-stone-200/40"
                    )}>
                    <div className="flex justify-between items-center mb-1">
                      <span className={cn(
                        "text-base font-black w-8 h-8 rounded-full flex items-center justify-center transition-colors",
                        isSel ? "text-white bg-white/20" : isTod ? "bg-emerald-500 text-white" : "text-stone-700"
                      )}>
                        {format(date, 'd')}
                      </span>
                    </div>
                    <div className="flex flex-col gap-1 overflow-hidden">
                      {dayAtivs.slice(0, 3).map((a, i) => {
                        const config = tiposAtividadeLabels[a.tipo] || tiposAtividadeLabels.outro;
                        return (
                          <div 
                            key={i} 
                            className={cn(
                              "text-[10px] px-2 py-1 rounded-lg font-bold truncate transition-colors",
                              isSel ? "bg-white/20 text-white" : `${config.color} ${config.text} shadow-sm shadow-stone-200/50`
                            )}
                          >
                            {a.tipo}
                          </div>
                        );
                      })}
                      {dayAtivs.length > 3 && (
                        <p className={cn("text-[10px] font-black pl-1", isSel ? "text-white/80" : "text-stone-400")}>
                          +{dayAtivs.length - 3} mais tarefas
                        </p>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>

        <Card className="border-none shadow-xl shadow-stone-200/50 rounded-[2.5rem] bg-white overflow-hidden flex flex-col">
          <CardHeader className="bg-emerald-600 p-8">
            <CardTitle className="text-white flex items-center gap-3 font-bold text-xl">
              <CalendarIcon className="w-6 h-6 text-white/80" /> 
              {format(selectedDate, "dd 'de' MMMM", { locale: ptBR })}
            </CardTitle>
          </CardHeader>
          <CardContent className="p-8 flex-1 overflow-y-auto max-h-[600px] scrollbar-hide">
            <div className="space-y-4">
              {getAtividadesForDate(selectedDate).length > 0 ? (
                getAtividadesForDate(selectedDate).map((a) => {
                  const config = tiposAtividadeLabels[a.tipo] || tiposAtividadeLabels.outro;
                  return (
                    <div key={a.id} className="p-5 bg-stone-50/50 rounded-[2rem] border border-stone-100 hover:bg-stone-50 transition-all group">
                      <div className="flex items-center justify-between mb-3">
                        <Badge className={cn("rounded-xl px-3 py-1 font-black uppercase text-[10px]", config.color, config.text)}>
                          {a.tipo}
                        </Badge>
                        {a.status && (
                           <span className="text-[10px] font-black text-stone-400 uppercase">{a.status}</span>
                        )}
                      </div>
                      <div className="space-y-2">
                        <div className="flex items-center gap-2">
                          <ArrowRight className="w-3 h-3 text-stone-300 group-hover:text-emerald-500 transition-colors" />
                          <p className="text-sm font-black text-stone-800 tracking-tight">Talhão: {getTalhaoNome(a.talhao_id)}</p>
                        </div>
                        {a.responsavel && (
                          <p className="text-[11px] text-stone-500 font-bold ml-5 uppercase tracking-wide">Resp: {a.responsavel}</p>
                        )}
                        {a.custo_total > 0 && (
                          <p className="text-xs font-black text-emerald-600 bg-emerald-50 w-fit px-3 py-1 rounded-lg ml-5">
                            R$ {a.custo_total.toLocaleString('pt-BR')}
                          </p>
                        )}
                      </div>
                    </div>
                  );
                })
              ) : (
                <div className="text-center py-16 flex flex-col items-center">
                   <div className="w-20 h-20 bg-stone-50 rounded-full flex items-center justify-center mb-4">
                     <Circle className="w-10 h-10 text-stone-200" />
                   </div>
                   <p className="text-base font-black text-stone-300 uppercase tracking-widest">Nenhuma tarefa programada</p>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
      
      {/* Legenda Estilizada */}
      <Card className="border-none shadow-sm rounded-3xl bg-white p-6 overflow-hidden">
        <div className="flex flex-wrap items-center gap-6">
          <span className="text-[11px] font-black text-stone-400 uppercase tracking-widest border-r pr-6 border-stone-100">Cores de Manejo:</span>
          <div className="flex flex-wrap items-center gap-4">
            {Object.entries(tiposAtividadeLabels).map(([key, { label, color }]) => (
              <div key={key} className="flex items-center gap-2 px-3 py-1.5 rounded-2xl bg-stone-50 hover:bg-stone-100 transition-colors">
                <div className={cn("w-2 h-2 rounded-full", color)} />
                <span className="text-[11px] font-black text-stone-600 uppercase tracking-wide">{label}</span>
              </div>
            ))}
          </div>
        </div>
      </Card>
    </div>
  );
}