// ---------------------------------------------------------------------------
// Cálculo de folha de pagamento — cópia fiel de `calcularFolha` (e seus dois
// helpers) do App Fazenda 2.0 em produção (src/pages/Funcionarios.jsx). É
// função pura (não mexe no banco), usada pelo Assistente (marcar_folha_paga)
// pra saber o valor exato devido em cada mês — nunca um valor perguntado ao
// usuário, sempre calculado a partir do salário (e histórico de reajustes,
// se houver) já cadastrado.
// ---------------------------------------------------------------------------
import { format, addMonths, startOfMonth, endOfMonth, isWeekend, isBefore, differenceInMonths, setDate, isSameMonth, parseISO } from 'date-fns';
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

// Calcula o resumo de rescisão de um funcionário desligado: o que já foi pago no histórico,
// e o 13º e as férias que ainda faltam receber pra fechar a conta, na data da saída.
// Convenção: se tem um período de férias ou 13º já vencido e ainda não pago, conta ele inteiro
// ("em aberto"); senão, calcula só o proporcional desde o último período completo até a saída.
// Obs: não inclui aviso prévio nem multa de FGTS — o app não tem esses dados pra calcular.
// Cópia fiel de `calcularRescisao` de produção (src/pages/Funcionarios.jsx) — não mudar a regra.
export const calcularRescisao = (funcionario, todosCustosFuncionarios) => {
  if (funcionario.status !== 'inativo' || !funcionario.data_desligamento || !funcionario.data_admissao || !funcionario.salario) return null;

  const admissao = new Date(funcionario.data_admissao + 'T12:00:00');
  const desligamento = new Date(funcionario.data_desligamento + 'T12:00:00');
  const salarioNaSaida = getSalarioNaData(funcionario.historico_salarial, funcionario.salario, desligamento);

  const eventos = calcularFolha(funcionario);
  const eventosComStatus = eventos.map((evento) => {
    const custo = (todosCustosFuncionarios || []).find((c) => {
      const dataCusto = parseISO(c.data);
      return isSameMonth(dataCusto, evento.data_pagamento) && c.descricao?.includes(funcionario.nome) && c.descricao?.includes(evento.tipo);
    });
    return { ...evento, pago: custo?.status_pagamento === 'pago' };
  });

  const totalRecebidoHistorico = eventosComStatus.filter((e) => e.pago).reduce((acc, e) => acc + e.valor, 0);
  const totalSalariosRecebidos = eventosComStatus.filter((e) => e.pago && e.tipo === 'Salário Mensal').reduce((acc, e) => acc + e.valor, 0);
  const totalFeriasRecebidas = eventosComStatus.filter((e) => e.pago && e.tipo.includes('Férias')).reduce((acc, e) => acc + e.valor, 0);
  const totalDecimoRecebido = eventosComStatus.filter((e) => e.pago && e.tipo.includes('13º')).reduce((acc, e) => acc + e.valor, 0);

  const decimosGerados = eventosComStatus.filter((e) => e.tipo === '13º Salário').sort((a, b) => b.data_pagamento - a.data_pagamento);
  const ultimoDecimo = decimosGerados[0];
  let decimoRescisao;
  if (ultimoDecimo && !ultimoDecimo.pago) {
    decimoRescisao = { valor: ultimoDecimo.valor, detalhe: `${ultimoDecimo.referencia} (em aberto, não pago)` };
  } else {
    const anoDesligamento = desligamento.getFullYear();
    const inicioContagem = admissao.getFullYear() === anoDesligamento ? admissao : new Date(anoDesligamento, 0, 1);
    let mesesTrabalhados = (desligamento.getFullYear() - inicioContagem.getFullYear()) * 12 + (desligamento.getMonth() - inicioContagem.getMonth()) + 1;
    if (desligamento.getDate() <= 15) mesesTrabalhados -= 1;
    if (mesesTrabalhados < 0) mesesTrabalhados = 0;
    decimoRescisao = { valor: (salarioNaSaida / 12) * mesesTrabalhados, detalhe: `Proporcional: ${mesesTrabalhados}/12 avos de ${anoDesligamento}` };
  }

  const feriasGeradas = eventosComStatus.filter((e) => e.tipo.includes('Férias')).sort((a, b) => b.data_pagamento - a.data_pagamento);
  const ultimasFerias = feriasGeradas[0];
  const dataBaseFerias = ultimasFerias ? new Date(ultimasFerias.data_pagamento) : admissao;
  let mesesDesdeBase = differenceInMonths(desligamento, dataBaseFerias);
  if (mesesDesdeBase < 0) mesesDesdeBase = 0;
  const valorProporcionalFerias = ((salarioNaSaida * (1 + 1 / 3)) / 12) * mesesDesdeBase;

  let feriasRescisao;
  if (ultimasFerias && !ultimasFerias.pago) {
    feriasRescisao = { valor: ultimasFerias.valor + valorProporcionalFerias, detalhe: `${ultimasFerias.referencia} (vencidas, em aberto) + ${mesesDesdeBase}/12 avos proporcionais` };
  } else {
    feriasRescisao = { valor: valorProporcionalFerias, detalhe: `Proporcional: ${mesesDesdeBase}/12 avos` };
  }

  return {
    salarioNaSaida,
    totalRecebidoHistorico,
    totalSalariosRecebidos,
    totalFeriasRecebidas,
    totalDecimoRecebido,
    decimoRescisao,
    feriasRescisao,
    totalRescisao: decimoRescisao.valor + feriasRescisao.valor
  };
};
