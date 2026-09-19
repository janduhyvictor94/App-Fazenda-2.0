// ---------------------------------------------------------------------------
// Cálculo de folha de pagamento — cópia fiel de `calcularFolha` (e seus dois
// helpers) do App Fazenda 2.0 em produção (src/pages/Funcionarios.jsx). É
// função pura (não mexe no banco), usada pelo Assistente (marcar_folha_paga)
// pra saber o valor exato devido em cada mês — nunca um valor perguntado ao
// usuário, sempre calculado a partir do salário (e histórico de reajustes,
// se houver) já cadastrado.
// ---------------------------------------------------------------------------
import { format, addMonths, startOfMonth, endOfMonth, isWeekend, isBefore, differenceInMonths, setDate, isSameMonth } from 'date-fns';
import { ptBR } from 'date-fns/locale';

const getSalarioNaData = (historico, salarioAtual, dataReferencia) => {
  if (!historico || !Array.isArray(historico) || historico.length === 0) return salarioAtual;
  const historicoOrdenado = [...historico].sort((a, b) => new Date(b.data_vigencia) - new Date(a.data_vigencia));
  const registroVigente = historicoOrdenado.find((h) => {
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

export const calcularFolha = (funcionario) => {
  if (!funcionario.data_admissao || !funcionario.salario) return [];
  const admissao = new Date(funcionario.data_admissao + 'T12:00:00');
  const hoje = new Date();
  const limiteFuturo = addMonths(hoje, 60);

  // Se o funcionário foi desligado, a projeção não pode continuar gerando salário/13º/férias
  // pra frente — ela para no mês da saída. Mesma convenção do cálculo de 13º proporcional logo
  // abaixo: saiu até dia 15, o mês da saída não conta como trabalhado; depois do dia 15, conta.
  let dataLimite = limiteFuturo;
  if (funcionario.status === 'inativo' && funcionario.data_desligamento) {
    const desligamento = new Date(funcionario.data_desligamento + 'T12:00:00');
    dataLimite = desligamento.getDate() > 15 ? endOfMonth(desligamento) : startOfMonth(desligamento);
  }

  let eventos = [];
  let cursor = new Date(admissao);
  cursor.setDate(1);

  while (isBefore(cursor, dataLimite)) {
    const salarioVigente = getSalarioNaData(funcionario.historico_salarial, funcionario.salario, cursor);
    const dataPagamentoSalario = getQuintoDiaUtil(cursor);

    eventos.push({
      id: `salario-${format(cursor, 'yyyy-MM')}`,
      tipo: 'Salário Mensal',
      referencia: format(cursor, 'MMMM/yyyy', { locale: ptBR }),
      data_pagamento: dataPagamentoSalario,
      valor: salarioVigente,
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
          id: `13-${anoCursor}`,
          tipo: '13º Salário',
          referencia: `Exercício ${anoCursor}`,
          data_pagamento: dataDecimo,
          valor: valorDecimo,
          detalhe: `Prop. ${mesesTrabalhados}/12 avos`
        });
      }
    }

    const mesesDeCasa = differenceInMonths(cursor, admissao);
    if (mesesDeCasa > 0 && mesesDeCasa % 12 === 0) {
      const dataPagamentoFerias = addMonths(cursor, 1);
      const bonusFerias = salarioVigente * (1 / 3);
      const totalFerias = salarioVigente + bonusFerias;
      eventos.push({
        id: `ferias-${format(cursor, 'yyyy-MM')}`,
        tipo: 'Férias (1 Ano)',
        referencia: `Período ${format(addMonths(cursor, -12), 'MM/yy')} a ${format(cursor, 'MM/yy')}`,
        data_pagamento: dataPagamentoFerias,
        valor: totalFerias,
        detalhe: 'Salário + 1/3'
      });
    }
    cursor = addMonths(cursor, 1);
  }
  return eventos.sort((a, b) => a.data_pagamento - b.data_pagamento);
};
