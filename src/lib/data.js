import { supabase } from './supabaseClient';
import { format, addDays, addMonths } from 'date-fns';

// ---------------------------------------------------------------------------
// Camada de dados do protótipo — SOMENTE LEITURA.
// As funções abaixo replicam fielmente as regras já usadas em produção
// (App-Fazenda-2.0/src/pages/Dashboard.jsx e Financeiro.jsx):
//   - parseNumber / getAreaTalhao: mesma lógica, mesmos fallbacks de campo.
//   - Rateio de custos gerais: um custo é "geral da fazenda" quando não tem
//     talhao_id (ou talhao_id vazio / 'geral' / 'todos' / 'null'), e é
//     distribuído proporcionalmente à área de cada talhão sobre a área total.
// Nada aqui recalcula ou altera valores gravados — é só leitura + o mesmo
// cálculo de proporção que a Dashboard atual já faz.
// ---------------------------------------------------------------------------

export const parseNumber = (val) => {
  if (val === undefined || val === null || val === '') return 0;
  const parsed = Number(String(val).replace(',', '.'));
  return Number.isNaN(parsed) ? 0 : parsed;
};

export const getAreaTalhao = (t) => {
  if (!t) return 0;
  return (
    parseNumber(t.area_hectares) ||
    parseNumber(t.tamanho_ha) ||
    parseNumber(t.area) ||
    parseNumber(t.tamanho) ||
    parseNumber(t.hectares) ||
    0
  );
};

export const isCustoGeral = (c) => {
  const tid = c.talhao_id;
  return (
    !tid ||
    String(tid).trim() === '' ||
    String(tid).toLowerCase() === 'geral' ||
    String(tid).toLowerCase() === 'todos' ||
    String(tid) === 'null'
  );
};

async function selectAll(table, orderBy) {
  let query = supabase.from(table).select('*');
  if (orderBy) query = query.order(orderBy.column, { ascending: orderBy.ascending });
  const { data, error } = await query;
  if (error) throw error;
  return data || [];
}

// Busca tudo que o painel precisa, em paralelo. Somente SELECT — nenhuma
// escrita acontece neste protótipo.
export async function fetchFazendaData() {
  const [
    talhoes,
    safras,
    colheitas,
    custos,
    funcionarios,
    atividades,
    pluviometria,
    insumos,
    consultorias,
    metasTalhoes,
    planejamentos,
    culturas
  ] = await Promise.all([
    selectAll('talhoes'),
    selectAll('safras', { column: 'data_inicio', ascending: false }),
    selectAll('colheitas'),
    selectAll('custos'),
    selectAll('funcionarios'),
    selectAll('atividades'),
    selectAll('pluviometria', { column: 'data', ascending: false }),
    selectAll('insumos'),
    selectAll('consultorias', { column: 'data_visita', ascending: false }),
    selectAll('metas_talhoes', { column: 'ano', ascending: false }),
    selectAll('planejamentos', { column: 'created_at', ascending: false }),
    selectAll('culturas', { column: 'nome', ascending: true })
  ]);
  return {
    talhoes,
    safras,
    colheitas,
    custos,
    funcionarios,
    atividades,
    pluviometria,
    insumos,
    consultorias,
    metasTalhoes,
    planejamentos,
    culturas
  };
}

// Filtros genéricos de período — mesma ideia de custosDoAno/colheitasDoAno,
// só parametrizados pelo nome do campo de data de cada tabela.
export function filtrarPorAno(lista, ano, campoData = 'data') {
  const inicio = `${ano}-01-01`;
  const fim = `${ano}-12-31`;
  return lista.filter((item) => item[campoData] && item[campoData] >= inicio && item[campoData] <= fim);
}

export function filtrarPorSafra(lista, safra, campoData = 'data') {
  if (!safra) return [];
  const start = safra.data_inicio || '2000-01-01';
  const end = safra.data_fim || '2099-12-31';
  const talhaoId = String(safra.talhao_id);
  return lista.filter(
    (item) =>
      String(item.talhao_id) === talhaoId && item[campoData] && item[campoData] >= start && item[campoData] <= end
  );
}

export function areaTotalFazenda(talhoes) {
  return talhoes.reduce((acc, t) => acc + getAreaTalhao(t), 0);
}

// Uma linha de custo "geral" pesa proporcionalmente à área de cada talhão.
// Vista "ano" (fazenda inteira): não precisa proporcionalizar — a soma das
// proporções de todos os talhões já fecha em 100% do custo geral.
// Vista "safra"/"talhão" (um recorte): aplica a MESMA fórmula do Dashboard
// atual — valor * (areaTalhao / areaTotalFazenda).
export function custosDoAno({ custos, ano }) {
  const inicio = `${ano}-01-01`;
  const fim = `${ano}-12-31`;
  return custos.filter((c) => c.data && c.data >= inicio && c.data <= fim);
}

export function colheitasDoAno({ colheitas, ano }) {
  const inicio = `${ano}-01-01`;
  const fim = `${ano}-12-31`;
  return colheitas.filter((c) => c.data && c.data >= inicio && c.data <= fim);
}

export function colheitasDaSafra({ colheitas, safra }) {
  if (!safra) return [];
  const start = safra.data_inicio || '2000-01-01';
  const end = safra.data_fim || '2099-12-31';
  const talhaoId = String(safra.talhao_id);
  return colheitas.filter(
    (c) => String(c.talhao_id) === talhaoId && c.data && c.data >= start && c.data <= end
  );
}

export function custosDaSafra({ custos, safra, talhoes }) {
  if (!safra) return [];
  const start = safra.data_inicio || '2000-01-01';
  const end = safra.data_fim || '2099-12-31';
  const talhaoId = String(safra.talhao_id);
  const areaTotal = areaTotalFazenda(talhoes);
  const talhaoSafra = talhoes.find((t) => String(t.id) === talhaoId);
  const areaTalhao = getAreaTalhao(talhaoSafra);
  const proporcaoArea = areaTotal > 0 ? areaTalhao / areaTotal : 0;

  const diretos = custos.filter(
    (c) => String(c.talhao_id) === talhaoId && c.data && c.data >= start && c.data <= end
  );

  const globaisRateados = custos
    .filter((c) => isCustoGeral(c) && c.data && c.data >= start && c.data <= end)
    .map((c) => ({ ...c, valor: parseNumber(c.valor) * proporcaoArea, isRateio: true }));

  return [...diretos, ...globaisRateados];
}

// Detalha um custo "geral" (sem talhão) por área — mesma fórmula usada em
// custosDaSafra e no Painel de Inteligência (valor × área do talhão / área
// total da fazenda), só que aqui devolve a quebra por TODOS os talhões de uma
// vez, em vez de só a fatia de um. Usado no Financeiro pra mostrar, pra cada
// lançamento geral, quanto cai em cada área.
export function rateioPorTalhao(valor, talhoes) {
  const areaTotal = areaTotalFazenda(talhoes);
  if (areaTotal <= 0) return [];
  return talhoes
    .map((t) => {
      const areaHa = getAreaTalhao(t);
      const proporcao = areaHa / areaTotal;
      return { talhao: t, areaHa, proporcao, valor: valor * proporcao };
    })
    .filter((r) => r.areaHa > 0)
    .sort((a, b) => b.valor - a.valor);
}

// Custos de UM talhão específico dentro de um ano inteiro: os lançamentos
// diretos dele + a fatia rateada de cada custo geral da fazenda — mesma regra
// de custosDaSafra, só que parametrizada por ano/talhão em vez de depender de
// existir uma safra cadastrada. Usado no filtro "ver só este talhão" do
// Financeiro (fora do modo Safra, que já é implicitamente por talhão).
export function custosDoAnoPorTalhao({ custos, ano, talhaoId, talhoes }) {
  const doAno = custosDoAno({ custos, ano });
  const areaTotal = areaTotalFazenda(talhoes);
  const talhao = talhoes.find((t) => String(t.id) === String(talhaoId));
  const areaTalhao = getAreaTalhao(talhao);
  const proporcao = areaTotal > 0 ? areaTalhao / areaTotal : 0;

  const diretos = doAno.filter((c) => String(c.talhao_id) === String(talhaoId));
  const globaisRateados = doAno
    .filter((c) => isCustoGeral(c))
    .map((c) => ({ ...c, valor: parseNumber(c.valor) * proporcao, isRateio: true }));

  return [...diretos, ...globaisRateados];
}

export function totaisFinanceiros(custosLista) {
  const despesasPagas = custosLista
    .filter((c) => c.tipo_lancamento === 'despesa' && c.status_pagamento === 'pago')
    .reduce((acc, c) => acc + parseNumber(c.valor), 0);
  const despesasPendentes = custosLista
    .filter((c) => c.tipo_lancamento === 'despesa' && c.status_pagamento === 'pendente')
    .reduce((acc, c) => acc + parseNumber(c.valor), 0);
  const receitasExtras = custosLista
    .filter((c) => c.tipo_lancamento === 'receita' && c.status_pagamento === 'pago')
    .reduce((acc, c) => acc + parseNumber(c.valor), 0);
  return { despesasPagas, despesasPendentes, receitasExtras };
}

export function receitaColheitas(colheitasLista) {
  return colheitasLista.reduce((acc, c) => acc + parseNumber(c.valor_total), 0);
}

// ---------------------------------------------------------------------------
// ÚNICA escrita deste protótipo. Tudo acima é somente leitura.
// Usada pela tela de Notas Fiscais, depois que você já conferiu e confirmou
// cada item na tabela (a extração da IA nunca salva nada por conta própria —
// ela só propõe; isto aqui é o "confirmar" que de fato grava, igual ao botão
// de confirmação do Assistente em produção). Cria um lançamento em `custos`
// por item confirmado, com os mesmos campos que o assistente já usa hoje
// (registrar_pagamento): descricao, categoria, talhao_id, valor, data,
// status_pagamento, tipo_lancamento.
// ---------------------------------------------------------------------------
export async function salvarLancamentosDeNota({ itens, fornecedor }) {
  if (!itens || itens.length === 0) throw new Error('Nenhum item para salvar.');

  const linhas = itens.map((item) => ({
    descricao: fornecedor ? `${item.nome} — NF ${fornecedor}` : item.nome,
    categoria: item.categoria || 'outro',
    talhao_id: item.talhao_id || null,
    valor: parseNumber(item.valor_total),
    data: item.data || new Date().toISOString().slice(0, 10),
    status_pagamento: item.status_pagamento || 'pendente',
    tipo_lancamento: 'despesa',
    observacoes: 'Lançado via IA de nota fiscal (protótipo) — conferido manualmente antes de salvar.'
  }));

  const { data: inseridos, error } = await supabase.from('custos').insert(linhas).select();
  if (error) throw error;
  return inseridos;
}

// Segunda escrita do protótipo — salva o contorno (polígono) e/ou o ponto
// central de UM talhão específico, desenhado na tela de Mapa por Satélite.
// Precisa das colunas de sql/001_mapa_satelite.sql já criadas no Supabase
// (rode a migração uma vez antes de usar esta função). Nunca mexe em nenhum
// outro campo do talhão (nome, área, cultura, etc. continuam intactos).
export async function salvarLocalizacaoTalhao({ talhaoId, poligonoGeojson, centroLat, centroLng }) {
  if (!talhaoId) throw new Error('Talhão não informado.');
  const patch = {};
  if (poligonoGeojson !== undefined) patch.poligono_geojson = poligonoGeojson;
  if (centroLat !== undefined) patch.centro_lat = centroLat;
  if (centroLng !== undefined) patch.centro_lng = centroLng;

  const { data, error } = await supabase.from('talhoes').update(patch).eq('id', talhaoId).select();
  if (error) {
    if (String(error.message || '').toLowerCase().includes('column')) {
      throw new Error(
        'O Supabase ainda não tem as colunas de localização. Rode a migração em sql/001_mapa_satelite.sql (Supabase → SQL Editor) antes de salvar um polígono.'
      );
    }
    throw error;
  }
  return data?.[0] || null;
}

// ---------------------------------------------------------------------------
// Metas — terceira e quarta escrita do protótipo (portadas de produção,
// tela Metas.jsx). Uma meta é custo/ha e produção/ha alvo para um talhão,
// num ciclo entre duas datas, dentro de um ano. Mesmo formato de campos,
// mesma tabela (`metas_talhoes`) já usada em produção.
// ---------------------------------------------------------------------------
export async function salvarMeta({ id, payload }) {
  if (id) {
    const { data, error } = await supabase.from('metas_talhoes').update(payload).eq('id', id).select();
    if (error) throw error;
    return data?.[0] || null;
  }
  const { data, error } = await supabase.from('metas_talhoes').insert([payload]).select();
  if (error) throw error;
  return data?.[0] || null;
}

export async function excluirMeta(id) {
  const { error } = await supabase.from('metas_talhoes').delete().eq('id', id);
  if (error) throw error;
}

// ---------------------------------------------------------------------------
// Planejamentos — portado de produção (Planejamentos.jsx). Um planejamento é
// um "molde" de cronograma de aplicações/serviços (fases + itens), que pode
// ser salvo, duplicado e, quando pronto, "aplicado" numa safra real — o que
// gera atividades de verdade na tabela `atividades` (ver
// aplicarPlanejamentoNaSafra abaixo). Nada aqui recalcula custo — reaproveita
// a mesma conversão de unidades e arredondamento de embalagem de sempre.
// ---------------------------------------------------------------------------
export async function salvarPlanejamento({ id, payload }) {
  if (id) {
    const { data, error } = await supabase.from('planejamentos').update(payload).eq('id', id).select().single();
    if (error) throw error;
    return data;
  }
  const { data, error } = await supabase.from('planejamentos').insert([payload]).select().single();
  if (error) throw error;
  return data;
}

export async function duplicarPlanejamento(planejamento) {
  const payload = {
    nome: `${planejamento.nome} (Cópia)`,
    cultura: planejamento.cultura,
    dados: planejamento.dados
  };
  const { data, error } = await supabase.from('planejamentos').insert([payload]).select().single();
  if (error) throw error;
  return data;
}

export async function excluirPlanejamento(id) {
  const { error } = await supabase.from('planejamentos').delete().eq('id', id);
  if (error) throw error;
}

// "Aplicar na Safra" — a parte mais delicada do que foi portado: gera as
// atividades reais (tabela `atividades`) a partir das fases do planejamento.
// Replica EXATAMENTE a lógica de produção: conversão g/planta → kg e
// ml/área → L, arredondamento pra cima em embalagens fechadas, cálculo de
// data por tipo de ciclo (dia soma dias corridos, semana soma em blocos de
// 7, mês soma meses), e o modo "livre" — que nasce sem nenhuma data
// (data_programada = null) porque a ideia é que cada etapa só ganhe uma
// data real quando for marcada como concluída em Atividades, na ordem
// (ordem_etapa) em que aparecem aqui.
export async function aplicarPlanejamentoNaSafra({
  safra,
  safraId,
  planNome,
  tipoCiclo,
  quantidadePlantas,
  fases,
  insumos,
  dataInicio
}) {
  if (!safraId) throw new Error('Selecione a safra de destino.');
  if (tipoCiclo !== 'livre' && !dataInicio) throw new Error('Preencha a data de início.');
  if (!safra) throw new Error('Safra não encontrada.');
  if (!fases || fases.length === 0) throw new Error('O planejamento está vazio.');

  // Meio-dia fixo — evita o fuso horário jogar a data pro dia anterior.
  const baseDate = dataInicio ? new Date(`${dataInicio}T12:00:00`) : new Date();
  const menorMomento = Math.min(...fases.map((f) => Number(f.momento)));
  const atividadesParaInserir = [];

  fases.forEach((fase) => {
    let dataProgStr = null;
    const momentoRelativo = Number(fase.momento) - menorMomento;

    if (tipoCiclo !== 'livre') {
      let dataCalculada;
      if (tipoCiclo === 'semana') dataCalculada = addDays(baseDate, momentoRelativo * 7);
      else if (tipoCiclo === 'mes') dataCalculada = addMonths(baseDate, momentoRelativo);
      else dataCalculada = addDays(baseDate, momentoRelativo);
      dataProgStr = format(dataCalculada, 'yyyy-MM-dd');
    }

    const terceirizados = (fase.aplicacoes || []).filter((app) => app.metodo === 'terceirizado');
    const isTerceirizada = terceirizados.length > 0;
    const valorTerceirizadoTotal = terceirizados.reduce((acc, curr) => acc + (parseFloat(curr.valor_estimado) || 0), 0);
    const descricoesTerc = terceirizados.map((t) => t.descricao_servico).filter(Boolean).join(', ');

    const insumosConvertidos = (fase.aplicacoes || [])
      .filter((app) => app.metodo !== 'terceirizado')
      .map((app) => {
        const insumo = insumos.find((i) => i.id === app.insumo_id);
        if (!insumo) return null;

        const qtdInput = parseFloat(app.quantidade) || 0;
        const plantas = parseInt(quantidadePlantas) || 0;

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
      })
      .filter(Boolean);

    let custoDaAtividade = insumosConvertidos.reduce((acc, curr) => acc + curr.valor_total, 0);
    if (isTerceirizada) custoDaAtividade += valorTerceirizadoTotal;

    let obs = `Gerado via Planejamento: ${planNome}`;
    if (tipoCiclo === 'livre') obs += `\n*Etapa Livre (Executar conforme a planta responder)*`;
    if (descricoesTerc) obs += `\nServiços terceirizados previstos: ${descricoesTerc}`;

    atividadesParaInserir.push({
      talhao_id: safra.talhao_id,
      safra_id: safraId,
      ordem_etapa: fase.momento,
      tipo: 'outro',
      tipo_personalizado: fase.nome_etapa || `Aplicação Etapa ${fase.momento}`,
      data_programada: dataProgStr,
      status: 'programada',
      terceirizada: isTerceirizada,
      valor_terceirizado: isTerceirizada && valorTerceirizadoTotal > 0 ? valorTerceirizadoTotal : null,
      insumos_utilizados: insumosConvertidos,
      custo_total: custoDaAtividade,
      observacoes: obs
    });
  });

  const { error } = await supabase.from('atividades').insert(atividadesParaInserir);
  if (error) throw error;
  return atividadesParaInserir.length;
}

// ---------------------------------------------------------------------------
// Inteligência gerencial (BI) — só leitura, só combina números que já existem.
// Nenhuma "IA" aqui: é a mesma fórmula de rateio de sempre, aplicada por
// talhão em vez de por safra, mais algumas contas de produtividade/margem e
// um conjunto pequeno de regras pra gerar alertas. Nada disso recalcula ou
// substitui os valores lançados — é só cruzamento de informação.
// ---------------------------------------------------------------------------
export function indicadoresPorTalhao({ talhoes, custos, colheitas, ano }) {
  const areaTotal = areaTotalFazenda(talhoes);
  const custosAno = custosDoAno({ custos, ano });
  const colheitasAno = colheitasDoAno({ colheitas, ano });
  const totalGeral = custosAno
    .filter(isCustoGeral)
    .reduce((acc, c) => acc + parseNumber(c.valor), 0);

  return talhoes.map((t) => {
    const areaHa = getAreaTalhao(t);
    const proporcao = areaTotal > 0 ? areaHa / areaTotal : 0;

    const custoDireto = custosAno
      .filter((c) => String(c.talhao_id) === String(t.id))
      .reduce((acc, c) => acc + parseNumber(c.valor), 0);
    const custoRateado = totalGeral * proporcao;
    const custoTotal = custoDireto + custoRateado;

    const colheitasTalhao = colheitasAno.filter((c) => String(c.talhao_id) === String(t.id));
    const kgColhidos = colheitasTalhao.reduce((acc, c) => acc + parseNumber(c.quantidade_kg), 0);
    const receita = receitaColheitas(colheitasTalhao);
    const margem = receita - custoTotal;

    return {
      talhao: t,
      areaHa,
      custoDireto,
      custoRateado,
      custoTotal,
      custoPorHa: areaHa > 0 ? custoTotal / areaHa : 0,
      kgColhidos,
      kgPorHa: areaHa > 0 ? kgColhidos / areaHa : 0,
      receita,
      margem,
      margemPorHa: areaHa > 0 ? margem / areaHa : 0
    };
  });
}

// ---------------------------------------------------------------------------
// Demonstrativo de safra por talhão, pra Relatórios — mesma regra de
// produção (App-Fazenda-2.0/src/pages/Relatorios.jsx, aba "Safra & Custos"):
// só custos PAGOS entram na conta (é o resultado realizado, não o previsto),
// custo direto = custos pagos do talhão + atividades concluídas do talhão no
// período, custo indireto = rateio dos custos gerais pagos pela área. Aceita
// um intervalo de datas livre (não precisa ser o ano inteiro) e um talhaoId
// opcional pra filtrar o resultado só daquele talhão.
// ---------------------------------------------------------------------------
export function demonstrativoPorTalhao({ custos, colheitas, atividades, talhoes, dataInicio, dataFim, talhaoId }) {
  const inicio = dataInicio || '2000-01-01';
  const fim = dataFim || '2100-12-31';
  const dentroDoPeriodo = (data) => data && data >= inicio && data <= fim;

  const custosNoPeriodo = (custos || []).filter((c) => dentroDoPeriodo(c.data));
  const colheitasNoPeriodo = (colheitas || []).filter((c) => dentroDoPeriodo(c.data));
  const atividadesConcluidasNoPeriodo = (atividades || [])
    .filter((a) => a.status === 'concluida' || a.status === 'concluída')
    .map((a) => ({ ...a, dataEfetiva: a.data_realizada || a.data_programada }))
    .filter((a) => dentroDoPeriodo(a.dataEfetiva));

  const custosPagosNoPeriodo = custosNoPeriodo.filter((c) => c.status_pagamento === 'pago');
  const areaTotal = areaTotalFazenda(talhoes);
  const custosGeraisPeriodo = custosPagosNoPeriodo.filter(isCustoGeral).reduce((acc, c) => acc + parseNumber(c.valor), 0);
  const rateioPorHa = areaTotal > 0 ? custosGeraisPeriodo / areaTotal : 0;

  const talhoesRelevantes = talhaoId ? talhoes.filter((t) => String(t.id) === String(talhaoId)) : talhoes;

  const linhas = talhoesRelevantes
    .map((t) => {
      const area = getAreaTalhao(t);
      const receita = colheitasNoPeriodo
        .filter((c) => String(c.talhao_id) === String(t.id))
        .reduce((acc, c) => acc + parseNumber(c.valor_total), 0);
      const custoFinDireto = custosPagosNoPeriodo
        .filter((c) => String(c.talhao_id) === String(t.id))
        .reduce((acc, c) => acc + parseNumber(c.valor), 0);
      const custoAtivDireto = atividadesConcluidasNoPeriodo
        .filter((a) => String(a.talhao_id) === String(t.id))
        .reduce((acc, a) => acc + parseNumber(a.custo_total), 0);
      const custoDireto = custoFinDireto + custoAtivDireto;
      const custoIndireto = area * rateioPorHa;
      const custoTotal = custoDireto + custoIndireto;
      const lucro = receita - custoTotal;
      return {
        id: t.id,
        nome: t.nome,
        cultura: t.cultura,
        area,
        receita,
        custoDireto,
        custoIndireto,
        custoTotal,
        lucro,
        lucroPorHa: area > 0 ? lucro / area : 0,
        custoPorHa: area > 0 ? custoTotal / area : 0
      };
    })
    .filter((t) => t.receita > 0 || t.custoTotal > 0);

  const totais = linhas.reduce(
    (acc, l) => ({
      area: acc.area + l.area,
      receita: acc.receita + l.receita,
      custoDireto: acc.custoDireto + l.custoDireto,
      custoIndireto: acc.custoIndireto + l.custoIndireto,
      custoTotal: acc.custoTotal + l.custoTotal,
      lucro: acc.lucro + l.lucro
    }),
    { area: 0, receita: 0, custoDireto: 0, custoIndireto: 0, custoTotal: 0, lucro: 0 }
  );

  return { linhas, totais, custosGeraisPeriodo };
}

// Regras simples (sem IA de verdade) que viram alertas de texto — comparam
// cada talhão com a média da própria fazenda, e olham prazos de pagamento e
// de consultoria. Serve de esqueleto: dá pra trocar os limiares (1.3x, 45
// dias, etc) ou acrescentar novas regras sem mexer no resto da tela.
export function gerarAlertasGerenciais({ indicadores, custos, consultorias }) {
  const alertas = [];
  const comArea = indicadores.filter((i) => i.areaHa > 0);

  const mediaCustoPorHa = comArea.length
    ? comArea.reduce((acc, i) => acc + i.custoPorHa, 0) / comArea.length
    : 0;
  const mediaKgPorHa = comArea.length
    ? comArea.reduce((acc, i) => acc + i.kgPorHa, 0) / comArea.length
    : 0;

  comArea.forEach((i) => {
    if (mediaCustoPorHa > 0 && i.custoPorHa > mediaCustoPorHa * 1.3) {
      const percentual = Math.round((i.custoPorHa / mediaCustoPorHa - 1) * 100);
      alertas.push({
        nivel: 'atencao',
        talhao: i.talhao.nome,
        texto: `Custo por hectare de ${i.talhao.nome} está ${percentual}% acima da média da fazenda — vale revisar os lançamentos de insumos e atividades deste talhão.`
      });
    }
    if (i.margem < 0 && (i.custoTotal > 0 || i.receita > 0)) {
      alertas.push({
        nivel: 'critico',
        talhao: i.talhao.nome,
        texto: `${i.talhao.nome} está com resultado negativo no período — custos correndo na frente da receita de colheita.`
      });
    }
    if (mediaKgPorHa > 0 && i.kgColhidos > 0 && i.kgPorHa < mediaKgPorHa * 0.6) {
      const percentual = Math.round((1 - i.kgPorHa / mediaKgPorHa) * 100);
      alertas.push({
        nivel: 'atencao',
        talhao: i.talhao.nome,
        texto: `Produtividade de ${i.talhao.nome} está ${percentual}% abaixo da média da fazenda (kg/ha) — pode valer uma visita técnica.`
      });
    }
  });

  const hoje = new Date().toISOString().slice(0, 10);
  const pendentesAntigos = custos.filter(
    (c) => c.tipo_lancamento === 'despesa' && c.status_pagamento === 'pendente' && c.data && diasEntre(c.data, hoje) > 45
  );
  if (pendentesAntigos.length > 0) {
    const total = pendentesAntigos.reduce((acc, c) => acc + parseNumber(c.valor), 0);
    alertas.push({
      nivel: 'atencao',
      talhao: null,
      texto: `${pendentesAntigos.length} lançamento${pendentesAntigos.length > 1 ? 's' : ''} pendente${pendentesAntigos.length > 1 ? 's' : ''} de pagamento há mais de 45 dias, somando um valor considerável — vale conferir no Financeiro.`,
      valor: total
    });
  }

  const proximaVisita = (consultorias || [])
    .filter((c) => c.proxima_visita)
    .sort((a, b) => (a.proxima_visita || '').localeCompare(b.proxima_visita || ''))[0];
  const ultimaVisita = [...(consultorias || [])].sort((a, b) => (b.data_visita || '').localeCompare(a.data_visita || ''))[0];
  if (!proximaVisita && ultimaVisita?.data_visita && diasEntre(ultimaVisita.data_visita, hoje) > 90) {
    alertas.push({
      nivel: 'atencao',
      talhao: null,
      texto: `Já se passaram mais de 90 dias desde a última consultoria técnica registrada, e não há próxima visita agendada.`
    });
  }

  return alertas;
}

function diasEntre(dataInicio, dataFim) {
  const a = new Date(dataInicio);
  const b = new Date(dataFim);
  return Math.round((b - a) / (1000 * 60 * 60 * 24));
}

// Tipos de atividade de campo (mesmos valores de App-Fazenda-2.0/Atividades.jsx,
// tela "Atividades" deste protótipo) — usados aqui só pra rotular o custo de
// cada etapa (adubação, indução...) na divisão por etapa do Financeiro.
export const tipoAtividadeLabels = {
  inducao: 'Indução',
  poda: 'Poda',
  adubacao: 'Adubação',
  pulverizacao: 'Pulverização',
  maturacao: 'Maturação',
  irrigacao: 'Irrigação',
  capina: 'Capina',
  outro: 'Outra atividade'
};

// Divisão por etapa de UM talhão dentro de um período (ex.: a janela de uma
// safra) — separa 3 origens de custo que hoje vivem em lugares diferentes do
// app e nunca apareciam juntas:
//   1) custosDeSafra   — lançamentos DIRETOS do talhão na tela Financeiro
//      (insumo, funcionário, colheita, manutenção... o que já está na tabela
//      `custos` com este talhao_id).
//   2) custosRateados  — fatia deste talhão nos custos GERAIS da fazenda
//      (mesmo cálculo de área/área-total de sempre).
//   3) etapas          — custo das atividades de campo já CONCLUÍDAS deste
//      talhão (adubação, indução, poda...), lançadas na tela Atividades e que
//      NUNCA duplicam a tabela `custos` — por isso somam à parte, não por
//      cima do item 1.
// Nada aqui inventa número novo: é só reagrupar valores que já existem, pra
// mostrar "de onde vem" o custo de uma área, etapa por etapa.
export function divisaoEtapasTalhao({ custos, atividades, talhoes, talhaoId, dataInicio, dataFim }) {
  const inicio = dataInicio || '2000-01-01';
  const fim = dataFim || '2100-12-31';
  const dentroDoPeriodo = (d) => d && d >= inicio && d <= fim;

  const custosDiretos = (custos || []).filter(
    (c) => String(c.talhao_id) === String(talhaoId) && dentroDoPeriodo(c.data)
  );
  const custosDeSafra = custosDiretos.reduce((acc, c) => acc + parseNumber(c.valor), 0);

  const areaTotal = areaTotalFazenda(talhoes);
  const talhao = talhoes.find((t) => String(t.id) === String(talhaoId));
  const proporcao = areaTotal > 0 ? getAreaTalhao(talhao) / areaTotal : 0;
  const custosRateados = (custos || [])
    .filter((c) => isCustoGeral(c) && dentroDoPeriodo(c.data))
    .reduce((acc, c) => acc + parseNumber(c.valor) * proporcao, 0);

  const atividadesConcluidas = (atividades || [])
    .filter((a) => String(a.talhao_id) === String(talhaoId) && (a.status === 'concluida' || a.status === 'concluída'))
    .map((a) => ({ ...a, dataEfetiva: a.data_realizada || a.data_programada }))
    .filter((a) => dentroDoPeriodo(a.dataEfetiva));

  const porEtapa = {};
  atividadesConcluidas.forEach((a) => {
    const key = a.tipo || 'outro';
    porEtapa[key] = (porEtapa[key] || 0) + parseNumber(a.custo_total);
  });

  const etapas = Object.entries(porEtapa)
    .map(([key, valor]) => ({ key, label: tipoAtividadeLabels[key] || key, valor }))
    .filter((e) => e.valor > 0)
    .sort((a, b) => b.valor - a.valor);

  const totalEtapas = etapas.reduce((acc, e) => acc + e.valor, 0);
  const totalGeral = custosDeSafra + custosRateados + totalEtapas;

  return { custosDeSafra, custosRateados, etapas, totalEtapas, totalGeral };
}

export const categoriaLabels = {
  funcionario: { label: 'Funcionário', color: 'bg-tech/15 text-tech' },
  insumo: { label: 'Insumo', color: 'bg-brand/15 text-brand' },
  colheita: { label: 'Colheita', color: 'bg-brand/15 text-brand' },
  manutencao: { label: 'Manutenção', color: 'bg-amber/15 text-amber' },
  energia: { label: 'Energia', color: 'bg-amber/15 text-amber' },
  agua: { label: 'Água', color: 'bg-tech/15 text-tech' },
  combustivel: { label: 'Combustível', color: 'bg-amber/15 text-amber' },
  terceirizado: { label: 'Terceirizado', color: 'bg-rose/15 text-rose' },
  equipamento: { label: 'Equipamento', color: 'bg-tech/15 text-tech' },
  administrativo: { label: 'Administrativo', color: 'bg-ink-muted/20 text-ink-muted' },
  outro: { label: 'Outro', color: 'bg-ink-muted/20 text-ink-muted' }
};
