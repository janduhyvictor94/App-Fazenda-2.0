import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabaseClient';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogDescription } from '@/components/ui/dialog';
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
      const { error } = await supabase.from('pluviometria').insert([data]);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['pluviometria'] });
      setOpen(false);
      setFormData({ data: format(new Date(), 'yyyy-MM-dd'), quantidade_mm: '', talhao_id: '', observacoes: '' });
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
    createMutation.mutate({ ...formData, quantidade_mm: parseFloat(formData.quantidade_mm), talhao_id: formData.talhao_id || null });
  };

  const chuvaAcumulada = chuvas.reduce((acc, c) => acc + (c.quantidade_mm || 0), 0);
  const chartData = [...chuvas].reverse().slice(-10).map(c => ({
    data: format(new Date(c.data + 'T12:00:00'), 'dd/MM'),
    mm: c.quantidade_mm
  }));

  const getTalhaoNome = (id) => talhoes.find(t => t.id === id)?.nome || 'Geral (Sede)';

  return (
    <div className="space-y-8">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-stone-900 tracking-tight">Pluviometria</h1>
          <p className="text-stone-500 font-medium">Controle de chuvas e clima</p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button className="bg-cyan-600 hover:bg-cyan-700 rounded-2xl h-12 px-6 shadow-lg shadow-cyan-100">
              <Plus className="w-5 h-5 mr-2" /> Registrar Chuva
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-md rounded-[2rem]">
            <DialogHeader>
              <DialogTitle className="text-2xl font-bold text-stone-900">Nova Medição</DialogTitle>
              <DialogDescription className="sr-only">Formulário para registro de volume de chuva.</DialogDescription>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4 pt-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label className="font-bold text-stone-700">Data</Label>
                  <Input type="date" value={formData.data} onChange={(e) => setFormData({ ...formData, data: e.target.value })} className="rounded-xl h-11" required />
                </div>
                <div className="space-y-2">
                  <Label className="font-bold text-stone-700">Milímetros (mm)</Label>
                  <Input type="number" step="0.1" value={formData.quantidade_mm} onChange={(e) => setFormData({ ...formData, quantidade_mm: e.target.value })} className="rounded-xl h-11" placeholder="Ex: 15" required />
                </div>
              </div>
              <div className="space-y-2">
                <Label className="font-bold text-stone-700">Local (Opcional)</Label>
                <Select value={formData.talhao_id || "geral"} onValueChange={(value) => setFormData({ ...formData, talhao_id: value === "geral" ? null : value })}>
                  <SelectTrigger className="rounded-xl h-11"><SelectValue placeholder="Geral / Sede" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="geral">Geral / Sede</SelectItem>
                    {talhoes.map((t) => <SelectItem key={t.id} value={t.id}>{t.nome}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label className="font-bold text-stone-700">Observações</Label>
                <Textarea value={formData.observacoes} onChange={(e) => setFormData({ ...formData, observacoes: e.target.value })} className="rounded-xl" rows={2} />
              </div>
              <div className="flex justify-end gap-3 pt-2">
                <Button type="button" variant="ghost" onClick={() => setOpen(false)} className="rounded-xl">Cancelar</Button>
                <Button type="submit" className="bg-cyan-600 rounded-xl px-8 h-11" disabled={createMutation.isPending}>Salvar</Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
        <div className="space-y-4">
          <StatCard title="Acumulado" value={`${chuvaAcumulada.toFixed(1)} mm`} icon={CloudRain} color="text-cyan-600" />
          <StatCard title="Dias de Chuva" value={chuvas.length} icon={Calendar} color="text-blue-600" />
        </div>
        <Card className="md:col-span-2 border-none shadow-sm rounded-[2rem] bg-white overflow-hidden">
          <CardHeader className="bg-stone-50/50 border-b border-stone-100 p-6">
            <CardTitle className="text-lg font-bold text-stone-800">Tendência de Volume (mm)</CardTitle>
          </CardHeader>
          <CardContent className="p-6">
            <div className="h-[200px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                  <XAxis dataKey="data" axisLine={false} tickLine={false} />
                  <YAxis axisLine={false} tickLine={false} />
                  <Tooltip cursor={{fill: '#f1f5f9'}} />
                  <Bar dataKey="mm" fill="#0ea5e9" radius={[6, 6, 0, 0]} barSize={35} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      </div>

      {chuvas.length > 0 && (
        <Card className="border-none shadow-sm rounded-[2rem] bg-white overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent bg-stone-50/50 border-stone-100 h-14">
                <TableHead className="font-bold text-stone-400 pl-8 uppercase text-[11px] tracking-widest">Data</TableHead>
                <TableHead className="font-bold text-stone-400 uppercase text-[11px] tracking-widest">Local</TableHead>
                <TableHead className="font-bold text-stone-400 uppercase text-[11px] tracking-widest">Volume</TableHead>
                <TableHead className="font-bold text-stone-400 uppercase text-[11px] tracking-widest text-right pr-8">Ação</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {chuvas.map((chuva) => (
                <TableRow key={chuva.id} className="border-stone-50 hover:bg-stone-50/50 transition-colors h-16">
                  <TableCell className="pl-8 font-bold text-stone-800">{format(new Date(chuva.data + 'T12:00:00'), 'dd/MM/yyyy')}</TableCell>
                  <TableCell className="font-medium text-stone-500">{chuva.talhao_id ? getTalhaoNome(chuva.talhao_id) : 'Geral'}</TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2 font-black text-cyan-600">
                      <Droplets className="w-4 h-4" /> {chuva.quantidade_mm} mm
                    </div>
                  </TableCell>
                  <TableCell className="text-right pr-8">
                    <Button variant="ghost" size="sm" className="rounded-xl text-red-400 hover:bg-red-50 hover:text-red-600" onClick={() => deleteMutation.mutate(chuva.id)}>
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