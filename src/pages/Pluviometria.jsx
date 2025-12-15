import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabaseClient';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Plus, Trash2, CloudRain, Droplets, Calendar } from 'lucide-react';
import EmptyState from '@/components/ui/EmptyState';
import StatCard from '@/components/ui/StatCard';
import { format } from 'date-fns';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';

export default function Pluviometria() {
  const [open, setOpen] = useState(false);
  const [formData, setFormData] = useState({
    data: format(new Date(), 'yyyy-MM-dd'),
    quantidade_mm: '',
    talhao_id: '',
    observacoes: ''
  });

  const queryClient = useQueryClient();

  const { data: talhoes = [] } = useQuery({
    queryKey: ['talhoes'],
    queryFn: async () => {
      const { data, error } = await supabase.from('talhoes').select('*');
      if (error) throw error;
      return data;
    }
  });

  const { data: chuvas = [] } = useQuery({
    queryKey: ['pluviometria'],
    queryFn: async () => {
      const { data, error } = await supabase.from('pluviometria').select('*').order('data', { ascending: false });
      if (error) throw error;
      return data;
    }
  });

  const createMutation = useMutation({
    mutationFn: async (data) => {
      const { error } = await supabase.from('pluviometria').insert(data);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['pluviometria'] });
      setOpen(false);
      setFormData({
        data: format(new Date(), 'yyyy-MM-dd'),
        quantidade_mm: '',
        talhao_id: '',
        observacoes: ''
      });
    }
  });

  const deleteMutation = useMutation({
    mutationFn: async (id) => {
      const { error } = await supabase.from('pluviometria').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['pluviometria'] });
    }
  });

  const handleSubmit = (e) => {
    e.preventDefault();
    createMutation.mutate({
      ...formData,
      quantidade_mm: parseFloat(formData.quantidade_mm),
      talhao_id: formData.talhao_id || null
    });
  };

  const totalRegistros = chuvas.length;
  const chuvaAcumulada = chuvas.reduce((acc, c) => acc + (c.quantidade_mm || 0), 0);
  
  const chartData = [...chuvas].reverse().slice(-10).map(c => ({
    data: format(new Date(c.data + 'T12:00:00'), 'dd/MM'),
    mm: c.quantidade_mm
  }));

  const getTalhaoNome = (id) => talhoes.find(t => t.id === id)?.nome || 'Geral (Sede)';

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-stone-900">Pluviometria</h1>
          <p className="text-stone-500">Controle de chuvas e clima na fazenda</p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button className="bg-cyan-600 hover:bg-cyan-700">
              <Plus className="w-4 h-4 mr-2" />
              Registrar Chuva
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>Registrar Chuva</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Data</Label>
                  <Input
                    type="date"
                    value={formData.data}
                    onChange={(e) => setFormData({ ...formData, data: e.target.value })}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label>Milímetros (mm)</Label>
                  <div className="relative">
                    <Input
                      type="number"
                      step="0.1"
                      value={formData.quantidade_mm}
                      onChange={(e) => setFormData({ ...formData, quantidade_mm: e.target.value })}
                      placeholder="Ex: 15"
                      required
                    />
                    <span className="absolute right-3 top-2.5 text-sm text-stone-400">mm</span>
                  </div>
                </div>
              </div>

              <div className="space-y-2">
                <Label>Local (Opcional)</Label>
                <Select
                  value={formData.talhao_id}
                  onValueChange={(value) => setFormData({ ...formData, talhao_id: value })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Geral / Sede" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={null}>Geral / Sede</SelectItem>
                    {talhoes.map((t) => (
                      <SelectItem key={t.id} value={t.id}>{t.nome}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-xs text-stone-500">Selecione apenas se a chuva foi localizada.</p>
              </div>

              <div className="space-y-2">
                <Label>Observações</Label>
                <Textarea
                  value={formData.observacoes}
                  onChange={(e) => setFormData({ ...formData, observacoes: e.target.value })}
                  placeholder="Ex: Chuva forte com vento..."
                />
              </div>

              <div className="flex justify-end gap-3 pt-2">
                <Button type="button" variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
                <Button type="submit" className="bg-cyan-600 hover:bg-cyan-700">Salvar</Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="space-y-4">
          <StatCard
            title="Acumulado Total"
            value={`${chuvaAcumulada.toFixed(1)} mm`}
            icon={CloudRain}
            iconBg="bg-cyan-50"
            iconColor="text-cyan-600"
          />
          <StatCard
            title="Dias com Chuva"
            value={totalRegistros}
            icon={Calendar}
            iconBg="bg-blue-50"
            iconColor="text-blue-600"
          />
        </div>
        
        <Card className="md:col-span-2 border-stone-100">
          <CardHeader>
            <CardTitle className="text-lg">Volume de Chuvas (Últimos registros)</CardTitle>
          </CardHeader>
          <CardContent>
            {chartData.length > 0 ? (
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} />
                  <XAxis dataKey="data" />
                  <YAxis />
                  <Tooltip formatter={(value) => [`${value} mm`, 'Chuva']} cursor={{fill: '#f0f9ff'}} />
                  <Bar dataKey="mm" fill="#06b6d4" radius={[4, 4, 0, 0]} barSize={40} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-48 flex items-center justify-center text-stone-400">
                Sem dados para exibir no gráfico
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {chuvas.length === 0 ? (
        <EmptyState
          icon={CloudRain}
          title="Nenhum registro de chuva"
          description="Comece a registrar a pluviometria para acompanhar o clima da fazenda."
          actionLabel="Registrar Chuva"
          onAction={() => setOpen(true)}
        />
      ) : (
        <Card className="border-stone-100">
          <Table>
            <TableHeader>
              <TableRow className="bg-stone-50">
                <TableHead>Data</TableHead>
                <TableHead>Local</TableHead>
                <TableHead>Volume</TableHead>
                <TableHead>Observações</TableHead>
                <TableHead className="w-16"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {chuvas.map((chuva) => (
                <TableRow key={chuva.id}>
                  <TableCell className="font-medium">
                    {format(new Date(chuva.data + 'T12:00:00'), 'dd/MM/yyyy')}
                  </TableCell>
                  <TableCell>
                    {chuva.talhao_id ? (
                      <span className="text-stone-600">{getTalhaoNome(chuva.talhao_id)}</span>
                    ) : (
                      <span className="text-stone-400 italic">Geral</span>
                    )}
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2 font-bold text-cyan-700">
                      <Droplets className="w-4 h-4" />
                      {chuva.quantidade_mm} mm
                    </div>
                  </TableCell>
                  <TableCell className="text-stone-500 text-sm max-w-xs truncate">
                    {chuva.observacoes || '-'}
                  </TableCell>
                  <TableCell>
                    <Button 
                      variant="ghost" 
                      size="sm"
                      className="text-red-600 hover:bg-red-50"
                      onClick={() => deleteMutation.mutate(chuva.id)}
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>
      )}
    </div>
  );
}