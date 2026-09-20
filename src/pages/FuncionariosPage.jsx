import React, { useMemo, useState } from 'react';
import {
  User,
  Phone,
  Calendar,
  UserX,
  Users,
  Wallet,
  Plus,
  Edit,
  Trash2,
  Loader2,
  AlertTriangle,
  TrendingUp,
  Calculator,
  Lock,
  CalendarRange
} from 'lucide-react';
import { format, isSameMonth, isBefore, isAfter, startOfDay, endOfDay, parseISO } from 'date-fns';
import Modal from '../components/Modal.jsx';
import HistoryAccordion from '../components/HistoryAccordion.jsx';
import KpiCard from '../components/KpiCard.jsx';
import { supabase } from '../lib/supabaseClient.js';
import { parseNumber } from '../lib/data.js';
import { formatBRL } from '../lib/format.js';
import { calcularFolha, calcularRescisao } from '../lib/folha.js';

// Mesmos valores de status usados em produção (App-Fazenda-2.0/src/pages/Funcionarios.jsx):
// 'ativo' | 'inativo' (= desligado) | 'ferias'. O painel de leitura original desta tela tinha
// sido feito com dados de exemplo em português ('Desligado'/'desligado') — mantemos essa
// checagem por compatibilidade, mas passamos a reconhecer também o valor real gravado pela
// produção ('inativo'), que é o que este formulário grava a partir de agora.
const isDesligado = (f) => f.status === 'inativo' || f.status === 'Desligado' || f.status === 'desligado';

function formVazio() {
  return {
    nome: '',
    cargo: '',
    salario: '',
    data_admissao: '',
    data_inicio_contabil: '',
    telefone: '',
    talhao_id: '',
    status: 'ativo',
    data_desligamento: '',
    observacoes: ''
  };
}

function FuncionarioCard({ f, desligado, onEditar, onExcluir, onReajustar, onDesligar, onVerHistorico }) {
  return (
    <div
      className={`rounded-xl2 border p-4 flex items-center justify-between gap-3 cursor-pointer transition-colors ${desligado ? 'bg-surface border-line opacity-80 hover:opacity-100' : 'bg-surface border-line hover:border-brand/40'}`}
      onClick={() => onVerHistorico(f)}
      title="Ver histórico de folha, 13º, férias e rescisão"
    >
      <div className="flex items-center gap-3 min-w-0">
        <div className={`w-9 h-9 rounded-full flex items-center justify-center shrink-0 ${desligado ? 'bg-line-soft text-ink-faint' : 'bg-brand/15 text-brand'}`}>
          <User className="w-4 h-4" />
        </div>
        <div className="min-w-0">
          <div className="text-sm font-semibold text-ink truncate">{f.nome}</div>
          <div className="text-xs text-ink-faint truncate">{f.cargo || 'Sem cargo definido'}</div>
        </div>
      </div>

      <div className="flex items-center gap-3 shrink-0">
        <div className="text-right text-xs text-ink-faint space-y-0.5">
          {f.salario != null && f.salario !== '' && (
            <div className="font-semibold text-ink tabular">{formatBRL(parseNumber(f.salario))}</div>
          )}
          {f.telefone && (
            <div className="flex items-center gap-1 justify-end">
              <Phone className="w-3 h-3" /> {f.telefone}
            </div>
          )}
          {desligado && f.data_desligamento && (
            <div className="flex items-center gap-1 justify-end text-rose">
              <UserX className="w-3 h-3" /> saiu em {f.data_desligamento}
            </div>
          )}
          {!desligado && f.data_admissao && (
            <div className="flex items-center gap-1 justify-end">
              <Calendar className="w-3 h-3" /> desde {f.data_admissao}
            </div>
          )}
        </div>

        <div className="flex items-center gap-0.5 border-l border-line pl-2" onClick={(e) => e.stopPropagation()}>
          <button
            onClick={() => onVerHistorico(f)}
            title="Folha, 13º, férias e rescisão"
            className="p-1.5 text-ink-faint hover:text-tech transition-colors"
          >
            <Calculator className="w-4 h-4" />
          </button>
          {!desligado && (
            <button
              onClick={() => onReajustar(f)}
              title="Reajustar salário"
              className="p-1.5 text-ink-faint hover:text-brand transition-colors"
            >
              <TrendingUp className="w-4 h-4" />
            </button>
          )}
          {!desligado && (
            <button
              onClick={() => onDesligar(f)}
              title="Desligar funcionário"
              className="p-1.5 text-ink-faint hover:text-rose transition-colors"
            >
              <UserX className="w-4 h-4" />
            </button>
          )}
          <button onClick={() => onEditar(f)} title="Editar" className="p-1.5 text-ink-faint hover:text-ink transition-colors">
            <Edit className="w-4 h-4" />
          </button>
          <button onClick={() => onExcluir(f)} title="Excluir" className="p-1.5 text-ink-faint hover:text-rose transition-colors">
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
}

export default function FuncionariosPage({ dados, recarregar }) {
  const { funcionarios, talhoes = [], custos = [] } = dados;

  const ativos = useMemo(() => funcionarios.filter((f) => !isDesligado(f)), [funcionarios]);
  const desligados = useMemo(() => funcionarios.filter(isDesligado), [funcionarios]);

  const folhaMensal = ativos.reduce((acc, f) => acc + parseNumber(f.salario), 0);

  // Custos já lançados de folha (categoria 'funcionario') — usados pra cruzar com os eventos
  // calculados (calcularFolha) e saber o que já foi pago/pendente/ainda não lançado.
  const custosFuncionarios = useMemo(() => custos.filter((c) => c.categoria === 'funcionario'), [custos]);

  // --- Cadastro (criar/editar) ---
  const [open, setOpen] = useState(false);
  const [editando, setEditando] = useState(null);
  const [form, setForm] = useState(formVazio());
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState(null);

  function abrirNovo() {
    setEditando(null);
    setForm(formVazio());
    setErro(null);
    setOpen(true);
  }

  function abrirEdicao(f) {
    setEditando(f);
    setForm({
      nome: f.nome || '',
      cargo: f.cargo || '',
      salario: f.salario != null ? String(f.salario) : '',
      data_admissao: f.data_admissao || '',
      data_inicio_contabil: f.data_inicio_contabil || '',
      telefone: f.telefone || '',
      talhao_id: f.talhao_id || '',
      status: f.status || 'ativo',
      data_desligamento: f.data_desligamento || '',
      observacoes: f.observacoes || ''
    });
    setErro(null);
    setOpen(true);
  }

  async function salvar(e) {
    e.preventDefault();
    if (!form.nome.trim() || !form.cargo.trim() || !form.salario || !form.data_admissao) {
      setErro('Preencha nome, cargo, salário e data de admissão.');
      return;
    }
    setSalvando(true);
    setErro(null);
    try {
      const payload = {
        nome: form.nome.trim(),
        cargo: form.cargo.trim(),
        salario: Number(form.salario),
        data_admissao: form.data_admissao || null,
        data_inicio_contabil: form.data_inicio_contabil || null,
        telefone: form.telefone || null,
        talhao_id: form.talhao_id || null,
        status: form.status,
        data_desligamento: form.status === 'inativo' ? form.data_desligamento || null : null,
        observacoes: form.observacoes || null
      };

      if (editando) {
        const { error } = await supabase.from('funcionarios').update(payload).eq('id', editando.id);
        if (error) throw error;
      } else {
        // Mesma convenção de produção: ao cadastrar, o histórico salarial nasce com um único
        // registro (salário/admissão), que serve de base pro cálculo de folha.
        payload.historico_salarial = [{ valor: payload.salario, data_vigencia: payload.data_admissao }];
        const { error } = await supabase.from('funcionarios').insert([payload]);
        if (error) throw error;
      }

      setOpen(false);
      await recarregar();
    } catch (err) {
      setErro(err.message || 'Não foi possível salvar o funcionário.');
    } finally {
      setSalvando(false);
    }
  }

  async function excluir(f) {
    if (!confirm('Tem certeza que deseja excluir este funcionário? Isso removerá também seus lançamentos financeiros.')) return;
    try {
      // Mesma regra de produção: apaga os custos de folha lançados pra este funcionário antes de
      // apagar o cadastro. Usa "- Nome" como sufixo exato da descrição (formato usado ao lançar:
      // "Folha: Tipo - Nome"), evitando apagar custos de outro funcionário cujo nome contenha este
      // como substring (ex: excluir "Maria Silva" não deve afetar "Ana Maria Silva").
      if (f.nome) {
        await supabase.from('custos').delete().eq('categoria', 'funcionario').ilike('descricao', `%- ${f.nome}`);
      }
      const { error } = await supabase.from('funcionarios').delete().eq('id', f.id);
      if (error) throw error;
      await recarregar();
    } catch (err) {
      alert(`Não foi possível excluir o funcionário.\n\nMotivo: ${err.message || 'Erro desconhecido'}`);
    }
  }

  // --- Reajuste salarial (alimenta historico_salarial, usado no cálculo de folha) ---
  const [reajusteOpen, setReajusteOpen] = useState(false);
  const [reajusteAlvo, setReajusteAlvo] = useState(null);
  const [reajusteForm, setReajusteForm] = useState({ novo_salario: '', data_vigencia: new Date().toISOString().slice(0, 10) });
  const [reajusteSalvando, setReajusteSalvando] = useState(false);
  const [reajusteErro, setReajusteErro] = useState(null);

  function abrirReajuste(f) {
    setReajusteAlvo(f);
    setReajusteForm({ novo_salario: '', data_vigencia: new Date().toISOString().slice(0, 10) });
    setReajusteErro(null);
    setReajusteOpen(true);
  }

  async function salvarReajuste(e) {
    e.preventDefault();
    if (!reajusteForm.novo_salario) {
      setReajusteErro('Informe o novo salário.');
      return;
    }
    setReajusteSalvando(true);
    setReajusteErro(null);
    try {
      const novoValor = Number(reajusteForm.novo_salario);
      const historicoAtual = reajusteAlvo.historico_salarial || [];
      const payload = {
        salario: novoValor,
        historico_salarial: [...historicoAtual, { valor: novoValor, data_vigencia: reajusteForm.data_vigencia }]
      };
      const { error } = await supabase.from('funcionarios').update(payload).eq('id', reajusteAlvo.id);
      if (error) throw error;
      setReajusteOpen(false);
      await recarregar();
    } catch (err) {
      setReajusteErro(err.message || 'Não foi possível reajustar o salário.');
    } finally {
      setReajusteSalvando(false);
    }
  }

  // --- Desligamento (ação separada da edição comum, igual ao fluxo de produção de
  // status='inativo' + data_desligamento, só que com um atalho dedicado em vez de precisar
  // abrir o formulário completo de edição) ---
  const [desligarOpen, setDesligarOpen] = useState(false);
  const [desligarAlvo, setDesligarAlvo] = useState(null);
  const [desligarData, setDesligarData] = useState(new Date().toISOString().slice(0, 10));
  const [desligarSalvando, setDesligarSalvando] = useState(false);
  const [desligarErro, setDesligarErro] = useState(null);

  function abrirDesligar(f) {
    setDesligarAlvo(f);
    setDesligarData(new Date().toISOString().slice(0, 10));
    setDesligarErro(null);
    setDesligarOpen(true);
  }

  async function confirmarDesligamento(e) {
    e.preventDefault();
    setDesligarSalvando(true);
    setDesligarErro(null);
    try {
      const { error } = await supabase
        .from('funcionarios')
        .update({ status: 'inativo', data_desligamento: desligarData || null })
        .eq('id', desligarAlvo.id);
      if (error) throw error;
      setDesligarOpen(false);
      await recarregar();
    } catch (err) {
      setDesligarErro(err.message || 'Não foi possível desligar o funcionário.');
    } finally {
      setDesligarSalvando(false);
    }
  }

  // --- Folha & Histórico (13º, férias, rescisão) — ao clicar no funcionário ---
  const anoAtual = new Date().getFullYear();
  const [folhaOpen, setFolhaOpen] = useState(false);
  const [folhaAlvo, setFolhaAlvo] = useState(null);
  const [filtroInicio, setFiltroInicio] = useState(`${anoAtual}-01-01`);
  const [filtroFim, setFiltroFim] = useState(`${anoAtual}-12-31`);
  const [lancandoId, setLancandoId] = useState(null);

  function abrirHistorico(f) {
    setFolhaAlvo(f);
    setFiltroInicio(`${anoAtual}-01-01`);
    setFiltroFim(`${anoAtual}-12-31`);
    setFolhaOpen(true);
  }

  // Mesma lógica de produção: cruza cada evento calculado (salário/13º/férias) com os custos já
  // lançados (categoria 'funcionario', descrição "Folha: Tipo - Nome") pra saber o status de cada um.
  const eventosFolha = useMemo(() => {
    if (!folhaAlvo) return [];
    const calculados = calcularFolha(folhaAlvo);
    const hoje = new Date();
    const dataCorte = folhaAlvo.data_inicio_contabil ? parseISO(folhaAlvo.data_inicio_contabil) : null;

    const comStatus = calculados.map((evento) => {
      const custo = custosFuncionarios.find((c) => {
        const dataCusto = parseISO(c.data);
        return isSameMonth(dataCusto, evento.data_pagamento) && c.descricao?.includes(folhaAlvo.nome) && c.descricao?.includes(evento.tipo);
      });
      let status = 'provisionado';
      if (dataCorte && isBefore(evento.data_pagamento, dataCorte)) {
        status = 'ignorado';
      } else if (custo) {
        status = custo.status_pagamento === 'pago' ? 'pago' : 'pendente_financeiro';
      } else if (isBefore(evento.data_pagamento, hoje)) {
        status = 'pendente_lancamento';
      }
      return { ...evento, status, custoId: custo?.id };
    });

    return comStatus.filter((evento) => {
      const dataEvt = startOfDay(evento.data_pagamento);
      const inicio = filtroInicio ? startOfDay(parseISO(filtroInicio)) : null;
      const fim = filtroFim ? endOfDay(parseISO(filtroFim)) : null;
      if (inicio && isBefore(dataEvt, inicio)) return false;
      if (fim && isAfter(dataEvt, fim)) return false;
      return true;
    });
  }, [folhaAlvo, custosFuncionarios, filtroInicio, filtroFim]);

  const rescisaoAlvo = useMemo(() => (folhaAlvo ? calcularRescisao(folhaAlvo, custosFuncionarios) : null), [folhaAlvo, custosFuncionarios]);

  const eventosValidos = eventosFolha.filter((e) => e.status !== 'ignorado');
  const totalSalarios = eventosValidos.filter((e) => e.tipo === 'Salário Mensal').reduce((acc, e) => acc + e.valor, 0);
  const totalFerias = eventosValidos.filter((e) => e.tipo.includes('Férias')).reduce((acc, e) => acc + e.valor, 0);
  const totalDecimo = eventosValidos.filter((e) => e.tipo.includes('13º')).reduce((acc, e) => acc + e.valor, 0);
  const custoTotalPeriodo = eventosValidos.reduce((acc, e) => acc + e.valor, 0);

  async function lancarEvento(evento, statusInicial) {
    if (!confirm(`Lançar "${evento.tipo}" (${evento.referencia}) como ${statusInicial === 'pago' ? 'PAGO' : 'PENDENTE'}?`)) return;
    setLancandoId(evento.id);
    try {
      const payload = {
        descricao: `Folha: ${evento.tipo} - ${folhaAlvo.nome}`,
        categoria: 'funcionario',
        valor: Number(evento.valor.toFixed(2)),
        data: format(evento.data_pagamento, 'yyyy-MM-dd'),
        status_pagamento: statusInicial,
        tipo_lancamento: 'despesa',
        observacoes: `Ref: ${evento.referencia}. ${evento.detalhe}`,
        talhao_id: folhaAlvo.talhao_id || null
      };
      const { error } = await supabase.from('custos').insert([payload]);
      if (error) throw error;
      await recarregar();
    } catch (err) {
      alert(`Não foi possível lançar o custo.\n\nMotivo: ${err.message || 'Erro desconhecido'}`);
    } finally {
      setLancandoId(null);
    }
  }

  async function alternarStatusEvento(evento, novoStatus) {
    setLancandoId(evento.id);
    try {
      const { error } = await supabase.from('custos').update({ status_pagamento: novoStatus }).eq('id', evento.custoId);
      if (error) throw error;
      await recarregar();
    } catch (err) {
      alert(`Não foi possível atualizar o status do pagamento.\n\nMotivo: ${err.message || 'Erro desconhecido'}`);
    } finally {
      setLancandoId(null);
    }
  }

  const statusBadge = {
    ignorado: { label: 'HISTÓRICO', cls: 'bg-line-soft text-ink-faint' },
    pago: { label: 'PAGO', cls: 'bg-brand/15 text-brand' },
    pendente_financeiro: { label: 'PENDENTE', cls: 'bg-amber/15 text-amber' },
    pendente_lancamento: { label: 'A LANÇAR', cls: 'bg-rose/15 text-rose' },
    provisionado: { label: 'FUTURO', cls: 'bg-line-soft text-ink-faint' }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <p className="text-sm text-ink-faint max-w-2xl">
          Mostrando só quem está ativo hoje — igual ao filtro que já existe no app atual (status). O histórico de
          quem já trabalhou na fazenda fica recolhido, sem sumir de verdade.
        </p>
        <button
          onClick={abrirNovo}
          className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-brand text-base font-semibold text-sm hover:bg-brand/90 transition-colors shrink-0"
        >
          <Plus className="w-4 h-4" /> Novo funcionário
        </button>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:gap-4 max-w-md">
        <KpiCard label="Ativos" value={String(ativos.length)} icon={Users} tone="brand" />
        <KpiCard label="Folha mensal" value={formatBRL(folhaMensal)} icon={Wallet} tone="tech" hint="salários ativos" />
      </div>

      <div className="space-y-2.5">
        {ativos.map((f) => (
          <FuncionarioCard
            key={f.id}
            f={f}
            onEditar={abrirEdicao}
            onExcluir={excluir}
            onReajustar={abrirReajuste}
            onDesligar={abrirDesligar}
            onVerHistorico={abrirHistorico}
          />
        ))}
        {ativos.length === 0 && <p className="text-sm text-ink-faint italic">Nenhum funcionário ativo no momento.</p>}
      </div>

      {desligados.length > 0 && (
        <HistoryAccordion
          title={`Histórico — ${desligados.length} desligado${desligados.length > 1 ? 's' : ''}`}
          subtitle="Recolhido por padrão · dados de folha e rescisão preservados"
        >
          <div className="space-y-2.5">
            {desligados.map((f) => (
              <FuncionarioCard key={f.id} f={f} desligado onEditar={abrirEdicao} onExcluir={excluir} onVerHistorico={abrirHistorico} />
            ))}
          </div>
        </HistoryAccordion>
      )}

      {/* Modal de criar/editar funcionário */}
      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title={editando ? 'Editar funcionário' : 'Novo funcionário'}
        description="Dados cadastrais e de admissão do funcionário."
      >
        <form onSubmit={salvar} className="space-y-4">
          <div>
            <label className="text-[11px] uppercase tracking-wide text-ink-faint font-semibold block mb-1">Nome</label>
            <input
              value={form.nome}
              onChange={(e) => setForm((f) => ({ ...f, nome: e.target.value }))}
              required
              className="w-full rounded-lg bg-base border border-line px-3 py-2 text-sm text-ink"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-[11px] uppercase tracking-wide text-ink-faint font-semibold block mb-1">Cargo</label>
              <input
                value={form.cargo}
                onChange={(e) => setForm((f) => ({ ...f, cargo: e.target.value }))}
                required
                className="w-full rounded-lg bg-base border border-line px-3 py-2 text-sm text-ink"
              />
            </div>
            <div>
              <label className="text-[11px] uppercase tracking-wide text-ink-faint font-semibold block mb-1">Salário (R$)</label>
              <input
                type="number"
                step="0.01"
                inputMode="decimal"
                value={form.salario}
                onChange={(e) => setForm((f) => ({ ...f, salario: e.target.value }))}
                required
                className="w-full rounded-lg bg-base border border-line px-3 py-2 text-sm text-ink"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-[11px] uppercase tracking-wide text-ink-faint font-semibold block mb-1">Admissão</label>
              <input
                type="date"
                value={form.data_admissao}
                onChange={(e) => setForm((f) => ({ ...f, data_admissao: e.target.value }))}
                required
                className="w-full rounded-lg bg-base border border-line px-3 py-2 text-sm text-ink"
              />
            </div>
            <div>
              <label className="text-[11px] uppercase tracking-wide text-ink-faint font-semibold block mb-1">
                Início contabilização <span className="normal-case text-ink-faint font-normal">(opcional)</span>
              </label>
              <input
                type="date"
                value={form.data_inicio_contabil}
                onChange={(e) => setForm((f) => ({ ...f, data_inicio_contabil: e.target.value }))}
                className="w-full rounded-lg bg-base border border-line px-3 py-2 text-sm text-ink"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-[11px] uppercase tracking-wide text-ink-faint font-semibold block mb-1">Telefone</label>
              <input
                value={form.telefone}
                onChange={(e) => setForm((f) => ({ ...f, telefone: e.target.value }))}
                className="w-full rounded-lg bg-base border border-line px-3 py-2 text-sm text-ink"
              />
            </div>
            <div>
              <label className="text-[11px] uppercase tracking-wide text-ink-faint font-semibold block mb-1">Talhão</label>
              <select
                value={form.talhao_id}
                onChange={(e) => setForm((f) => ({ ...f, talhao_id: e.target.value }))}
                className="w-full rounded-lg bg-base border border-line px-3 py-2 text-sm text-ink"
              >
                <option value="">Nenhum (rateio geral)</option>
                {talhoes.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.nome}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-[11px] uppercase tracking-wide text-ink-faint font-semibold block mb-1">Status</label>
              <select
                value={form.status}
                onChange={(e) => setForm((f) => ({ ...f, status: e.target.value }))}
                className="w-full rounded-lg bg-base border border-line px-3 py-2 text-sm text-ink"
              >
                <option value="ativo">Ativo</option>
                <option value="inativo">Desligado</option>
                <option value="ferias">Férias</option>
              </select>
            </div>
            {form.status === 'inativo' && (
              <div>
                <label className="text-[11px] uppercase tracking-wide text-ink-faint font-semibold block mb-1">Data de desligamento</label>
                <input
                  type="date"
                  value={form.data_desligamento}
                  onChange={(e) => setForm((f) => ({ ...f, data_desligamento: e.target.value }))}
                  className="w-full rounded-lg bg-base border border-line px-3 py-2 text-sm text-ink"
                />
              </div>
            )}
          </div>
          {form.status === 'inativo' && (
            <p className="text-xs text-ink-faint -mt-2">
              Funcionários desligados deixam de entrar nos lembretes e cálculos de folha a partir de agora. O
              histórico de pagamentos já feitos é mantido.
            </p>
          )}

          <div>
            <label className="text-[11px] uppercase tracking-wide text-ink-faint font-semibold block mb-1">Observações</label>
            <textarea
              value={form.observacoes}
              onChange={(e) => setForm((f) => ({ ...f, observacoes: e.target.value }))}
              rows={2}
              className="w-full rounded-lg bg-base border border-line px-3 py-2 text-sm text-ink resize-none"
            />
          </div>

          {erro && (
            <div className="flex items-start gap-2 text-sm text-rose">
              <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{erro}</span>
            </div>
          )}

          <div className="flex justify-end gap-2.5 pt-2">
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="px-4 py-2.5 rounded-xl bg-line-soft text-ink text-sm font-medium hover:bg-line transition-colors"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={salvando}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-brand text-base font-semibold text-sm disabled:opacity-40 disabled:cursor-not-allowed hover:bg-brand/90 transition-colors"
            >
              {salvando && <Loader2 className="w-4 h-4 animate-spin" />}
              {salvando ? 'Salvando…' : 'Salvar'}
            </button>
          </div>
        </form>
      </Modal>

      {/* Modal de reajuste salarial — alimenta historico_salarial usado no cálculo de folha */}
      <Modal
        open={reajusteOpen}
        onClose={() => setReajusteOpen(false)}
        title="Reajustar salário"
        description={reajusteAlvo ? `${reajusteAlvo.nome} — salário atual: ${formatBRL(parseNumber(reajusteAlvo.salario))}` : ''}
        maxWidth="max-w-sm"
      >
        <form onSubmit={salvarReajuste} className="space-y-4">
          <div>
            <label className="text-[11px] uppercase tracking-wide text-ink-faint font-semibold block mb-1">Novo salário (R$)</label>
            <input
              type="number"
              step="0.01"
              inputMode="decimal"
              value={reajusteForm.novo_salario}
              onChange={(e) => setReajusteForm((f) => ({ ...f, novo_salario: e.target.value }))}
              required
              className="w-full rounded-lg bg-base border border-line px-3 py-2 text-sm text-ink"
            />
          </div>
          <div>
            <label className="text-[11px] uppercase tracking-wide text-ink-faint font-semibold block mb-1">Data de vigência</label>
            <input
              type="date"
              value={reajusteForm.data_vigencia}
              onChange={(e) => setReajusteForm((f) => ({ ...f, data_vigencia: e.target.value }))}
              required
              className="w-full rounded-lg bg-base border border-line px-3 py-2 text-sm text-ink"
            />
          </div>

          {reajusteErro && (
            <div className="flex items-start gap-2 text-sm text-rose">
              <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{reajusteErro}</span>
            </div>
          )}

          <div className="flex justify-end gap-2.5 pt-2">
            <button
              type="button"
              onClick={() => setReajusteOpen(false)}
              className="px-4 py-2.5 rounded-xl bg-line-soft text-ink text-sm font-medium hover:bg-line transition-colors"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={reajusteSalvando}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-brand text-base font-semibold text-sm disabled:opacity-40 disabled:cursor-not-allowed hover:bg-brand/90 transition-colors"
            >
              {reajusteSalvando && <Loader2 className="w-4 h-4 animate-spin" />}
              {reajusteSalvando ? 'Salvando…' : 'Confirmar'}
            </button>
          </div>
        </form>
      </Modal>

      {/* Modal de desligamento — ação dedicada, separada da edição comum */}
      <Modal
        open={desligarOpen}
        onClose={() => setDesligarOpen(false)}
        title="Desligar funcionário"
        description={desligarAlvo ? `Confirma o desligamento de ${desligarAlvo.nome}?` : ''}
        maxWidth="max-w-sm"
      >
        <form onSubmit={confirmarDesligamento} className="space-y-4">
          <div>
            <label className="text-[11px] uppercase tracking-wide text-ink-faint font-semibold block mb-1">Data de desligamento</label>
            <input
              type="date"
              value={desligarData}
              onChange={(e) => setDesligarData(e.target.value)}
              required
              className="w-full rounded-lg bg-base border border-line px-3 py-2 text-sm text-ink"
            />
          </div>
          <p className="text-xs text-ink-faint">
            O funcionário deixa de entrar nos lembretes e cálculos de folha a partir de agora. O histórico de
            pagamentos já feitos é mantido.
          </p>

          {desligarErro && (
            <div className="flex items-start gap-2 text-sm text-rose">
              <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{desligarErro}</span>
            </div>
          )}

          <div className="flex justify-end gap-2.5 pt-2">
            <button
              type="button"
              onClick={() => setDesligarOpen(false)}
              className="px-4 py-2.5 rounded-xl bg-line-soft text-ink text-sm font-medium hover:bg-line transition-colors"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={desligarSalvando}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-rose text-base font-semibold text-sm disabled:opacity-40 disabled:cursor-not-allowed hover:bg-rose/90 transition-colors"
            >
              {desligarSalvando && <Loader2 className="w-4 h-4 animate-spin" />}
              {desligarSalvando ? 'Salvando…' : 'Confirmar desligamento'}
            </button>
          </div>
        </form>
      </Modal>

      {/* Folha & Histórico — salário, 13º, férias e rescisão, ao clicar no funcionário */}
      <Modal
        open={folhaOpen}
        onClose={() => setFolhaOpen(false)}
        title={folhaAlvo ? `Folha & Histórico — ${folhaAlvo.nome}` : 'Folha & Histórico'}
        description="Salário, 13º e férias calculados a partir da admissão e do histórico de reajustes. Use o período abaixo pra ver só uma faixa de datas."
        maxWidth="max-w-4xl"
      >
        {folhaAlvo && (
          <div className="space-y-5">
            <div className="p-3 rounded-xl bg-base border border-line-soft flex flex-wrap items-center gap-3">
              <div className="flex items-center gap-2 text-ink-muted text-xs font-semibold uppercase tracking-wide">
                <CalendarRange className="w-4 h-4" /> Período
              </div>
              <input
                type="date"
                value={filtroInicio}
                onChange={(e) => setFiltroInicio(e.target.value)}
                className="rounded-lg bg-surface-raised border border-line px-2.5 py-1.5 text-xs text-ink"
              />
              <span className="text-ink-faint text-xs">até</span>
              <input
                type="date"
                value={filtroFim}
                onChange={(e) => setFiltroFim(e.target.value)}
                className="rounded-lg bg-surface-raised border border-line px-2.5 py-1.5 text-xs text-ink"
              />
            </div>

            {rescisaoAlvo && (
              <div className="p-4 rounded-xl bg-rose/5 border border-rose/25 space-y-3">
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <h4 className="font-bold text-rose flex items-center gap-2 text-sm">
                    <Lock className="w-4 h-4" /> Resumo de rescisão — funcionário desligado
                  </h4>
                  <p className="text-xs text-rose/80">
                    Salário base na saída: <b>{formatBRL(rescisaoAlvo.salarioNaSaida)}</b>
                  </p>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                  <div className="bg-base rounded-lg p-3 border border-line-soft">
                    <p className="text-[10px] font-bold text-ink-faint uppercase">Já recebido (histórico)</p>
                    <p className="text-lg font-black text-ink">{formatBRL(rescisaoAlvo.totalRecebidoHistorico)}</p>
                    <p className="text-[10px] text-ink-faint mt-0.5">
                      Salários: {formatBRL(rescisaoAlvo.totalSalariosRecebidos)} · Férias: {formatBRL(rescisaoAlvo.totalFeriasRecebidas)} · 13º:{' '}
                      {formatBRL(rescisaoAlvo.totalDecimoRecebido)}
                    </p>
                  </div>
                  <div className="bg-base rounded-lg p-3 border border-line-soft">
                    <p className="text-[10px] font-bold text-ink-faint uppercase">13º a receber na saída</p>
                    <p className="text-lg font-black text-brand">{formatBRL(rescisaoAlvo.decimoRescisao.valor)}</p>
                    <p className="text-[10px] text-ink-faint mt-0.5">{rescisaoAlvo.decimoRescisao.detalhe}</p>
                  </div>
                  <div className="bg-base rounded-lg p-3 border border-line-soft">
                    <p className="text-[10px] font-bold text-ink-faint uppercase">Férias a receber na saída</p>
                    <p className="text-lg font-black text-brand">{formatBRL(rescisaoAlvo.feriasRescisao.valor)}</p>
                    <p className="text-[10px] text-ink-faint mt-0.5">{rescisaoAlvo.feriasRescisao.detalhe}</p>
                  </div>
                </div>
                <div className="flex items-center justify-between pt-2 border-t border-rose/20">
                  <span className="text-sm font-bold text-rose">Total a acertar na rescisão (13º + férias)</span>
                  <span className="text-lg font-black text-rose">{formatBRL(rescisaoAlvo.totalRescisao)}</span>
                </div>
                <p className="text-[10px] text-ink-faint">
                  Não inclui aviso prévio, multa de FGTS ou outros itens que o app não tem dados pra calcular — só salário, 13º e férias
                  proporcionais/em aberto.
                </p>
              </div>
            )}

            <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5">
              <KpiCard label="Total salários" value={formatBRL(totalSalarios)} icon={Wallet} tone="brand" />
              <KpiCard label="Total 13º" value={formatBRL(totalDecimo)} icon={TrendingUp} tone="tech" />
              <KpiCard label="Total férias" value={formatBRL(totalFerias)} icon={Calendar} tone="tech" />
              <KpiCard label="Custo total" value={formatBRL(custoTotalPeriodo)} icon={Calculator} tone="neutral" />
            </div>

            <div className="rounded-xl border border-line overflow-hidden">
              <div className="max-h-[360px] overflow-y-auto divide-y divide-line-soft">
                {eventosFolha.map((evento) => {
                  const badge = statusBadge[evento.status];
                  return (
                    <div key={evento.id} className="p-3 bg-base flex items-center justify-between gap-3 flex-wrap">
                      <div className="min-w-0">
                        <div className="text-sm font-semibold text-ink capitalize">{evento.referencia}</div>
                        <div className="text-xs text-ink-faint">
                          {evento.tipo} · vence {format(evento.data_pagamento, 'dd/MM/yyyy')}
                        </div>
                        <div className="text-[11px] text-ink-faint">{evento.detalhe}</div>
                      </div>
                      <div className="flex items-center gap-2.5 shrink-0">
                        <span className="text-sm font-bold text-ink tabular">{formatBRL(evento.valor)}</span>
                        <span className={`text-[10px] font-bold uppercase px-2 py-1 rounded-full ${badge.cls}`}>{badge.label}</span>
                        {evento.status === 'ignorado' && (
                          <span className="text-[11px] text-ink-faint italic flex items-center gap-1">
                            <Lock className="w-3 h-3" /> bloqueado
                          </span>
                        )}
                        {(evento.status === 'pago' || evento.status === 'pendente_financeiro') && (
                          <select
                            value={evento.status === 'pago' ? 'pago' : 'pendente'}
                            disabled={lancandoId === evento.id}
                            onChange={(e) => alternarStatusEvento(evento, e.target.value)}
                            className="rounded-lg bg-surface-raised border border-line px-2 py-1 text-xs font-bold text-ink"
                          >
                            <option value="pago">Pago</option>
                            <option value="pendente">Pendente</option>
                          </select>
                        )}
                        {evento.status === 'pendente_lancamento' && (
                          <div className="flex items-center gap-1.5">
                            <button
                              onClick={() => lancarEvento(evento, 'pendente')}
                              disabled={lancandoId === evento.id}
                              className="px-2.5 py-1 rounded-lg text-xs font-bold text-amber border border-amber/30 hover:bg-amber/10 disabled:opacity-40"
                            >
                              Pendente
                            </button>
                            <button
                              onClick={() => lancarEvento(evento, 'pago')}
                              disabled={lancandoId === evento.id}
                              className="px-2.5 py-1 rounded-lg text-xs font-bold bg-brand text-base hover:bg-brand/90 disabled:opacity-40"
                            >
                              Pago
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
                {eventosFolha.length === 0 && <p className="p-4 text-sm text-ink-faint italic">Nenhum evento de folha neste período.</p>}
              </div>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
