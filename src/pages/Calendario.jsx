import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabaseClient';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ChevronLeft, ChevronRight, Calendar as CalendarIcon, CheckCircle, Clock, Circle } from 'lucide-react';
import { format, startOfMonth, endOfMonth, eachDayOfInterval, isSameMonth, isSameDay, addMonths, subMonths, isToday, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { cn } from '@/lib/utils';

const tiposAtividadeLabels = {
  inducao: { label: 'Indução', color: 'bg-purple-500' },
  poda: { label: 'Poda', color: 'bg-green-500' },
  adubacao: { label: 'Adubação', color: 'bg-amber-500' },
  pulverizacao: { label: 'Pulverização', color: 'bg-blue-500' },
  maturacao: { label: 'Maturação', color: 'bg-orange-500' },
  irrigacao: { label: 'Irrigação', color: 'bg-cyan-500' },
  capina: { label: 'Capina', color: 'bg-lime-500' },
  outro: { label: 'Outro', color: 'bg-stone-500' }
};

const statusIcons = {
  programada: Circle,
  em_andamento: Clock,
  concluida: CheckCircle
};

export default function Calendario() {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState(null);
  const [filtroTalhao, setFiltroTalhao] = useState('todos');
  const [filtroTipo, setFiltroTipo] = useState('todos');

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

  // Adiciona dias do mês anterior para preencher a primeira semana
  const startDay = monthStart.getDay();
  const previousDays = [];
  for (let i = startDay - 1; i >= 0; i--) {
    const date = new Date(monthStart);
    date.setDate(date.getDate() - (i + 1));
    previousDays.push(date);
  }

  // Filtros
  const atividadesFiltradas = atividades.filter(a => {
    if (filtroTalhao !== 'todos' && a.talhao_id !== filtroTalhao) return false;
    if (filtroTipo !== 'todos' && a.tipo !== filtroTipo) return false;
    return true;
  });

  const getAtividadesForDate = (date) => {
    return atividadesFiltradas.filter(a => {
      // Correção de data aqui para garantir match exato do dia
      const dataProg = a.data_programada ? new Date(a.data_programada + 'T12:00:00') : null;
      const dataReal = a.data_realizada ? new Date(a.data_realizada + 'T12:00:00') : null;
      return (dataProg && isSameDay(dataProg, date)) || (dataReal && isSameDay(dataReal, date));
    });
  };

  const getTalhaoNome = (id) => talhoes.find(t => t.id === id)?.nome || '-';

  const selectedDateActivities = selectedDate ? getAtividadesForDate(selectedDate) : [];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-stone-900">Calendário</h1>
          <p className="text-stone-500">Visualize e acompanhe as atividades programadas</p>
        </div>
        <div className="flex flex-wrap gap-3">
          <Select value={filtroTalhao} onValueChange={setFiltroTalhao}>
            <SelectTrigger className="w-40">
              <SelectValue placeholder="Talhão" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todos Talhões</SelectItem>
              {talhoes.map((t) => (
                <SelectItem key={t.id} value={t.id}>{t.nome}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={filtroTipo} onValueChange={setFiltroTipo}>
            <SelectTrigger className="w-40">
              <SelectValue placeholder="Tipo" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todos Tipos</SelectItem>
              {Object.entries(tiposAtividadeLabels).map(([key, { label }]) => (
                <SelectItem key={key} value={key}>{label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Calendário */}
        <Card className="lg:col-span-2 border-stone-100">
          <CardHeader className="flex flex-row items-center justify-between pb-4">
            <CardTitle className="text-xl font-bold capitalize">
              {format(currentDate, 'MMMM yyyy', { locale: ptBR })}
            </CardTitle>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="icon"
                onClick={() => setCurrentDate(subMonths(currentDate, 1))}
              >
                <ChevronLeft className="w-4 h-4" />
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setCurrentDate(new Date())}
              >
                Hoje
              </Button>
              <Button
                variant="outline"
                size="icon"
                onClick={() => setCurrentDate(addMonths(currentDate, 1))}
              >
                <ChevronRight className="w-4 h-4" />
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            {/* Dias da semana */}
            <div className="grid grid-cols-7 gap-1 mb-2">
              {['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'].map((day) => (
                <div key={day} className="text-center text-sm font-medium text-stone-500 py-2">
                  {day}
                </div>
              ))}
            </div>

            {/* Dias do mês */}
            <div className="grid grid-cols-7 gap-1">
              {/* Dias do mês anterior */}
              {previousDays.map((date, index) => (
                <div
                  key={`prev-${index}`}
                  className="min-h-24 p-1 rounded-lg bg-stone-50 opacity-40"
                >
                  <span className="text-sm text-stone-400">{format(date, 'd')}</span>
                </div>
              ))}

              {/* Dias do mês atual */}
              {days.map((date) => {
                const dayActivities = getAtividadesForDate(date);
                const isSelected = selectedDate && isSameDay(date, selectedDate);
                const today = isToday(date);

                return (
                  <div
                    key={date.toISOString()}
                    onClick={() => setSelectedDate(date)}
                    className={cn(
                      "min-h-24 p-1 rounded-lg cursor-pointer transition-all border",
                      isSelected
                        ? "bg-emerald-50 border-emerald-300 ring-2 ring-emerald-200"
                        : today
                        ? "bg-amber-50 border-amber-200"
                        : "bg-white border-stone-100 hover:border-stone-200 hover:bg-stone-50"
                    )}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span className={cn(
                        "text-sm font-medium",
                        today ? "text-amber-600" : "text-stone-700"
                      )}>
                        {format(date, 'd')}
                      </span>
                      {dayActivities.length > 0 && (
                        <Badge variant="secondary" className="h-5 px-1.5 text-xs">
                          {dayActivities.length}
                        </Badge>
                      )}
                    </div>
                    <div className="space-y-1">
                      {dayActivities.slice(0, 3).map((atividade, idx) => {
                        const config = tiposAtividadeLabels[atividade.tipo] || tiposAtividadeLabels.outro;
                        return (
                          <div
                            key={idx}
                            className={cn(
                              "text-xs px-1.5 py-0.5 rounded truncate text-white",
                              config.color
                            )}
                          >
                            {config.label}
                          </div>
                        );
                      })}
                      {dayActivities.length > 3 && (
                        <div className="text-xs text-stone-500 px-1">
                          +{dayActivities.length - 3} mais
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>

        {/* Detalhes do dia selecionado */}
        <Card className="border-stone-100">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CalendarIcon className="w-5 h-5 text-emerald-600" />
              {selectedDate 
                ? format(selectedDate, "dd 'de' MMMM", { locale: ptBR })
                : 'Selecione um dia'
              }
            </CardTitle>
          </CardHeader>
          <CardContent>
            {selectedDate ? (
              selectedDateActivities.length > 0 ? (
                <div className="space-y-3">
                  {selectedDateActivities.map((atividade) => {
                    const config = tiposAtividadeLabels[atividade.tipo] || tiposAtividadeLabels.outro;
                    const StatusIcon = statusIcons[atividade.status] || Circle;
                    return (
                      <div
                        key={atividade.id}
                        className="p-3 bg-stone-50 rounded-xl space-y-2"
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <div className={cn("w-2 h-2 rounded-full", config.color)} />
                            <span className="font-medium text-stone-800">
                              {atividade.tipo === 'outro' ? atividade.tipo_personalizado : config.label}
                            </span>
                          </div>
                          <Badge
                            className={cn(
                              "text-xs",
                              atividade.status === 'concluida' && "bg-emerald-100 text-emerald-700",
                              atividade.status === 'em_andamento' && "bg-amber-100 text-amber-700",
                              atividade.status === 'programada' && "bg-blue-100 text-blue-700"
                            )}
                          >
                            <StatusIcon className="w-3 h-3 mr-1" />
                            {atividade.status === 'programada' && 'Programada'}
                            {atividade.status === 'em_andamento' && 'Em Andamento'}
                            {atividade.status === 'concluida' && 'Concluída'}
                          </Badge>
                        </div>
                        <p className="text-sm text-stone-600">
                          Talhão: <span className="font-medium">{getTalhaoNome(atividade.talhao_id)}</span>
                        </p>
                        {atividade.responsavel && (
                          <p className="text-sm text-stone-500">
                            Responsável: {atividade.responsavel}
                          </p>
                        )}
                        {atividade.custo_total > 0 && (
                          <p className="text-sm font-medium text-emerald-600">
                            Custo: R$ {atividade.custo_total.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                          </p>
                        )}
                        {atividade.observacoes && (
                          <p className="text-sm text-stone-500 italic">
                            {atividade.observacoes}
                          </p>
                        )}
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="text-center py-8 text-stone-400">
                  <CalendarIcon className="w-12 h-12 mx-auto mb-3 opacity-50" />
                  <p>Nenhuma atividade neste dia</p>
                </div>
              )
            ) : (
              <div className="text-center py-8 text-stone-400">
                <CalendarIcon className="w-12 h-12 mx-auto mb-3 opacity-50" />
                <p>Clique em um dia para ver as atividades</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Legenda */}
      <Card className="border-stone-100">
        <CardContent className="pt-4">
          <div className="flex flex-wrap items-center gap-4">
            <span className="text-sm font-medium text-stone-600">Legenda:</span>
            {Object.entries(tiposAtividadeLabels).map(([key, { label, color }]) => (
              <div key={key} className="flex items-center gap-2">
                <div className={cn("w-3 h-3 rounded-full", color)} />
                <span className="text-sm text-stone-600">{label}</span>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}