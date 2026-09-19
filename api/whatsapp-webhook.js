import { createClient } from '@supabase/supabase-js';
import { extrairItensDaNota } from './extrair-nota.js';

// ---------------------------------------------------------------------------
// Integração WhatsApp — recebe mensagens via WhatsApp Cloud API (Meta),
// interpreta com a mesma IA e o mesmo espírito do Assistente do app (propõe,
// pede confirmação, só grava depois de confirmado), e responde no WhatsApp.
//
// Além de texto, também aceita FOTO de nota fiscal: a IA lê a nota (mesma
// função de leitura usada na tela Notas Fiscais, ver extrairItensDaNota
// importado acima), casa cada item com o cadastro de insumos existente e
// propõe automaticamente: (a) registrar o gasto, (b) atualizar o preço de um
// insumo já cadastrado se o valor da nota for diferente do preço registrado,
// ou (c) cadastrar um insumo novo — perguntando por WhatsApp a unidade
// (kg/litro/saco/unidade) quando a nota não deixa isso claro. Nada disso é
// gravado sem você confirmar pelos botões, exatamente como no fluxo de texto.
// A conta de custo por litro/kg já usada em Planejamentos (preço da
// embalagem ÷ tamanho da embalagem) é a mesma usada aqui — não muda.
//
// IMPORTANTE — o que esta função NÃO faz sozinha:
//   - Não funciona sem você criar um app Meta/WhatsApp Business, configurar
//     as variáveis de ambiente abaixo e publicar isto numa URL pública
//     (Vercel). Não dá pra testar isto rodando só localhost — a Meta precisa
//     conseguir chamar a URL pela internet. Veja o passo a passo completo no
//     LEIA-ME-PROTOTIPO.md.
//   - Não foi testada de ponta a ponta neste ambiente (não temos como criar
//     uma conta Meta Business por você) — o código segue fielmente a mesma
//     lógica de gravação já usada e testada no Assistente em produção
//     (src/pages/Assistente.jsx) e na tela Notas Fiscais, então o risco está
//     concentrado na parte nova (webhook + botões do WhatsApp), não na parte
//     de gravar no banco.
//
// Variáveis de ambiente necessárias (Vercel → Settings → Environment Variables):
//   ANTHROPIC_API_KEY        (a mesma já usada pelo Assistente e Notas Fiscais)
//   WHATSAPP_TOKEN           (token de acesso do WhatsApp Cloud API — também
//                             usado pra baixar a foto que você manda)
//   WHATSAPP_PHONE_NUMBER_ID (ID do número de telefone configurado na Meta)
//   WHATSAPP_VERIFY_TOKEN    (uma senha qualquer, escolhida por você, usada
//                             só na hora de configurar o webhook na Meta)
// Nenhuma variável nova é necessária pra foto — reusa as mesmas de cima.
//
// Também precisa da tabela `whatsapp_pendentes` — rode sql/002_whatsapp.sql
// uma vez no Supabase antes de usar (mesma tabela de antes, nenhuma
// migração nova é necessária pra foto).
// ---------------------------------------------------------------------------

const SUPABASE_URL = 'https://zmxujmtoiwayrljrfmwo.supabase.co';
const SUPABASE_KEY =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InpteHVqbXRvaXdheXJsanJmbXdvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjUyMTMyODcsImV4cCI6MjA4MDc4OTI4N30.v2B_BZ6fRxDWntwz6tUKdGD6vmZKxYv0QXTbStBc6M0';
const MODELO = 'claude-haiku-4-5-20251001';

// --------------------------------------------------------------------------
// Helpers de correspondência de nome (talhão/insumo) — cópia fiel da mesma
// lógica do Assistente em produção (tolera acento/maiúscula, recusa nomes
// ambíguos em vez de adivinhar).
// --------------------------------------------------------------------------
const normalizar = (s) => (s || '').toString().toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').trim();

const encontrarPorNome = (lista, nomeAlvo, campo = 'nome') => {
  if (!nomeAlvo) return { item: null, ambiguo: false };
  const alvo = normalizar(nomeAlvo);
  const exato = lista.find((item) => normalizar(item[campo]) === alvo);
  if (exato) return { item: exato, ambiguo: false };
  const parecidos = lista.filter((item) => normalizar(item[campo]).includes(alvo) || alvo.includes(normalizar(item[campo])));
  if (parecidos.length === 1) return { item: parecidos[0], ambiguo: false };
  if (parecidos.length > 1) return { item: null, ambiguo: true, opcoes: parecidos.map((p) => p[campo]) };
  return { item: null, ambiguo: false };
};

const buscarObrigatorio = (lista, nomeAlvo, tipoLabel) => {
  const { item, ambiguo, opcoes } = encontrarPorNome(lista, nomeAlvo);
  if (ambiguo) throw new Error(`"${nomeAlvo}" é ambíguo — encontrei mais de um ${tipoLabel} parecido (${opcoes.join(', ')}). Seja mais específico.`);
  if (!item) throw new Error(`${tipoLabel} "${nomeAlvo}" não encontrado no cadastro.`);
  return item;
};

const numero = (v, padrao = 0) => {
  const n = typeof v === 'number' ? v : parseFloat(v);
  return Number.isFinite(n) ? n : padrao;
};

// --------------------------------------------------------------------------
// Ferramentas — subconjunto do assistente, focado no que faz sentido mandar
// por mensagem no dia a dia: colheita, atividade, pagamento/gasto, chuva, e
// consultas. Cadastro de talhão/funcionário/insumo continua só no app.
// --------------------------------------------------------------------------
const FERRAMENTAS = [
  {
    name: 'registrar_colheita',
    description: 'Registra uma ou mais colheitas do mesmo talhão e data.',
    input_schema: {
      type: 'object',
      properties: {
        talhao_nome: { type: 'string' },
        data: { type: 'string', description: 'YYYY-MM-DD, hoje se não informado' },
        cultura: { type: 'string' },
        itens: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              tipo_colheita: { type: 'string' },
              quantidade_caixas: { type: 'number' },
              quantidade_kg: { type: 'number' },
              preco_unitario: { type: 'number' },
              unidade_preco: { type: 'string', enum: ['kg', 'caixa'] }
            },
            required: ['tipo_colheita', 'preco_unitario', 'unidade_preco']
          }
        },
        custo_colheita_unitario: { type: 'number' },
        custo_unidade: { type: 'string', enum: ['kg', 'caixa'] }
      },
      required: ['talhao_nome', 'itens']
    }
  },
  {
    name: 'registrar_atividade',
    description: 'Registra uma atividade/manejo num talhão (adubação, poda, pulverização, etc).',
    input_schema: {
      type: 'object',
      properties: {
        talhao_nome: { type: 'string' },
        tipo: { type: 'string' },
        data_programada: { type: 'string', description: 'YYYY-MM-DD, hoje se não informado' },
        terceirizada: { type: 'boolean' },
        responsavel: { type: 'string' },
        valor_terceirizado: { type: 'number' },
        observacoes: { type: 'string' }
      },
      required: ['talhao_nome', 'tipo', 'terceirizada']
    }
  },
  {
    name: 'registrar_pagamento',
    description: 'Registra um gasto/despesa — água, luz, manutenção, etc. Sem talhao_nome entra no rateio geral por área.',
    input_schema: {
      type: 'object',
      properties: {
        descricao: { type: 'string' },
        categoria: { type: 'string', enum: ['funcionario', 'insumo', 'colheita', 'manutencao', 'energia', 'agua', 'combustivel', 'terceirizado', 'equipamento', 'administrativo', 'outro'] },
        valor: { type: 'number' },
        data: { type: 'string', description: 'YYYY-MM-DD, hoje se não informado' },
        talhao_nome: { type: 'string' },
        ja_pago: { type: 'boolean' }
      },
      required: ['descricao', 'categoria', 'valor']
    }
  },
  {
    name: 'registrar_chuva',
    description: 'Registra uma medição de chuva.',
    input_schema: {
      type: 'object',
      properties: {
        data: { type: 'string', description: 'YYYY-MM-DD, hoje se não informado' },
        quantidade_mm: { type: 'number' },
        talhao_nome: { type: 'string' }
      },
      required: ['quantidade_mm']
    }
  },
  {
    name: 'consultar_dados',
    description: 'Use para PERGUNTAS sobre dados já existentes — nunca para cadastrar algo novo.',
    input_schema: {
      type: 'object',
      properties: {
        tabela: { type: 'string', enum: ['custos', 'colheitas', 'atividades', 'funcionarios', 'talhoes', 'pluviometria'] },
        descricao_da_busca: { type: 'string' }
      },
      required: ['tabela', 'descricao_da_busca']
    }
  }
];

const ROTULO_FERRAMENTA = {
  registrar_colheita: 'Colheita',
  registrar_atividade: 'Atividade',
  registrar_pagamento: 'Pagamento',
  registrar_chuva: 'Chuva'
};

export const maxDuration = 30;

export default async function handler(req, res) {
  // Verificação do webhook — a Meta chama isto (GET) uma vez, na hora em que
  // você configura a URL no painel dela.
  if (req.method === 'GET') {
    const mode = req.query['hub.mode'];
    const token = req.query['hub.verify_token'];
    const challenge = req.query['hub.challenge'];
    if (mode === 'subscribe' && token && token === process.env.WHATSAPP_VERIFY_TOKEN) {
      return res.status(200).send(challenge);
    }
    return res.status(403).send('Token de verificação inválido.');
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ erro: 'Método não permitido' });
  }

  try {
    const entrada = extrairMensagem(req.body);
    if (!entrada) return res.status(200).json({ ignorado: true });
    await tratarMensagem(entrada);
    return res.status(200).json({ ok: true });
  } catch (err) {
    // Sempre 200 pra Meta não ficar reenviando o mesmo evento em loop — o
    // erro real fica só no log da função (Vercel → Deployments → Functions).
    console.error('Erro no webhook do WhatsApp:', err);
    return res.status(200).json({ ok: false });
  }
}

function extrairMensagem(body) {
  const value = body?.entry?.[0]?.changes?.[0]?.value;
  const msg = value?.messages?.[0];
  if (!msg) return null; // pode ser só uma confirmação de entrega/leitura — ignora
  const telefone = msg.from;
  if (msg.type === 'text' && msg.text?.body) {
    return { telefone, tipo: 'texto', texto: msg.text.body };
  }
  if (msg.type === 'interactive' && msg.interactive?.type === 'button_reply') {
    return { telefone, tipo: 'botao', idBotao: msg.interactive.button_reply.id };
  }
  if (msg.type === 'image' && msg.image?.id) {
    return { telefone, tipo: 'imagem', mediaId: msg.image.id };
  }
  return null; // áudio, figurinha etc. — fora de escopo por enquanto
}

async function tratarMensagem({ telefone, tipo, texto, idBotao, mediaId }) {
  const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

  if (tipo === 'botao') {
    if (idBotao === 'cancelar') {
      await supabase.from('whatsapp_pendentes').delete().eq('telefone', telefone);
      return enviarTexto(telefone, 'Cancelado — nada foi salvo.');
    }
    if (idBotao === 'confirmar') {
      const { data: pendente } = await supabase.from('whatsapp_pendentes').select('*').eq('telefone', telefone).maybeSingle();
      if (!pendente) {
        return enviarTexto(telefone, 'Não achei nenhuma proposta pendente pra confirmar — manda a mensagem de novo.');
      }
      const [{ data: talhoes }, { data: insumos }] = await Promise.all([
        supabase.from('talhoes').select('*'),
        supabase.from('insumos').select('*')
      ]);
      try {
        await executarAcao(supabase, pendente.ferramenta, pendente.dados, { talhoes: talhoes || [], insumos: insumos || [] });
        await supabase.from('whatsapp_pendentes').delete().eq('telefone', telefone);
        return enviarTexto(telefone, '✅ Salvo com sucesso.');
      } catch (err) {
        return enviarTexto(telefone, `❌ Não consegui salvar: ${err.message}`);
      }
    }
    return;
  }

  if (tipo === 'imagem') {
    return tratarImagemNota(supabase, telefone, mediaId);
  }

  // tipo === 'texto' — mas antes de tratar como uma mensagem nova, confere se
  // é a RESPOSTA a uma pergunta pendente (ex: "qual a unidade desse insumo?"
  // depois de mandar a foto de uma nota com um produto ainda não cadastrado).
  const { data: pendenteAtual } = await supabase.from('whatsapp_pendentes').select('*').eq('telefone', telefone).maybeSingle();
  if (pendenteAtual?.ferramenta === 'aguardando_unidade_insumo') {
    return continuarNotaComUnidade(supabase, telefone, pendenteAtual.dados, texto);
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return enviarTexto(telefone, 'A IA ainda não está configurada no servidor (falta ANTHROPIC_API_KEY).');

  const buscarSeguro = async (query) => {
    try {
      const { data } = await query;
      return data || [];
    } catch {
      return [];
    }
  };
  const [talhoes, insumos, funcionarios] = await Promise.all([
    buscarSeguro(supabase.from('talhoes').select('id, nome, cultura, area_hectares')),
    buscarSeguro(supabase.from('insumos').select('id, nome, unidade, preco_unitario, tamanho_embalagem')),
    buscarSeguro(supabase.from('funcionarios').select('id, nome, cargo, salario, status').eq('status', 'ativo'))
  ]);

  const hoje = new Date().toISOString().split('T')[0];
  const contexto = `Data de hoje: ${hoje}
Talhões cadastrados: ${JSON.stringify(talhoes.map((t) => ({ nome: t.nome, cultura: t.cultura })))}
Insumos cadastrados: ${JSON.stringify(insumos.map((i) => ({ nome: i.nome, unidade: i.unidade })))}`;

  const systemPrompt = `Você é o assistente da fazenda, respondendo por WhatsApp — seja BEM curto e direto (mensagens de WhatsApp, não parágrafos longos).

${contexto}

REGRAS:
1. Case nomes de talhão/insumo com os nomes REAIS cadastrados acima. Se não achar um correspondente razoável, pergunte em vez de inventar.
2. Se faltar informação (ex: não disse se foi terceirizada, valor ambíguo), pergunte em texto normal — não chame nenhuma ferramenta ainda.
3. Assim que tiver tudo, chame a ferramenta certa NA MESMA resposta, com um resumo curto em texto junto. O app manda os botões de confirmar/cancelar automaticamente depois — não peça confirmação em texto.
4. Seja direto, sem saudação longa nem emoji em excesso.`;

  const resposta = await chamarClaude(apiKey, systemPrompt, [{ role: 'user', content: texto }], FERRAMENTAS);
  const blocosTexto = resposta.content.filter((b) => b.type === 'text').map((b) => b.text).join('\n');
  const chamada = resposta.content.find((b) => b.type === 'tool_use');

  if (!chamada) {
    return enviarTexto(telefone, blocosTexto || 'Não entendi, pode reformular?');
  }

  if (chamada.name === 'consultar_dados') {
    const resultado = await executarConsulta(supabase, chamada.input);
    const segunda = await chamarClaude(
      apiKey,
      systemPrompt,
      [
        { role: 'user', content: texto },
        { role: 'assistant', content: resposta.content },
        { role: 'user', content: [{ type: 'tool_result', tool_use_id: chamada.id, content: JSON.stringify(resultado) }] }
      ],
      FERRAMENTAS
    );
    const textoFinal = segunda.content.filter((b) => b.type === 'text').map((b) => b.text).join('\n');
    return enviarTexto(telefone, textoFinal || 'Não consegui calcular isso.');
  }

  // Ação de cadastro -> guarda como pendente e manda os botões de confirmação.
  // NADA é salvo aqui — só depois que você tocar em "Confirmar" no WhatsApp.
  await supabase.from('whatsapp_pendentes').upsert({
    telefone,
    ferramenta: chamada.name,
    dados: chamada.input,
    criado_em: new Date().toISOString()
  });

  const resumo = montarResumo(chamada.name, chamada.input);
  const corpo = `${blocosTexto ? blocosTexto + '\n\n' : ''}${resumo}`.trim();
  return enviarBotoes(telefone, corpo, [
    { id: 'confirmar', title: 'Confirmar' },
    { id: 'cancelar', title: 'Cancelar' }
  ]);
}

function montarResumo(ferramenta, dados) {
  if (ferramenta === 'registrar_colheita') {
    const itens = (dados.itens || []).map((i) => `${i.tipo_colheita}: ${i.quantidade_kg ?? i.quantidade_caixas ?? '?'} a R$${i.preco_unitario}/${i.unidade_preco}`);
    return `${ROTULO_FERRAMENTA[ferramenta]} — ${dados.talhao_nome}, ${dados.data || 'hoje'}\n${itens.join('\n')}`;
  }
  if (ferramenta === 'registrar_atividade') {
    return `${ROTULO_FERRAMENTA[ferramenta]} — ${dados.talhao_nome}, ${dados.tipo}${dados.terceirizada ? ` (terceirizada, R$${dados.valor_terceirizado ?? '?'})` : ''}`;
  }
  if (ferramenta === 'registrar_pagamento') {
    return `${ROTULO_FERRAMENTA[ferramenta]} — ${dados.descricao}: R$${dados.valor} (${dados.categoria}${dados.talhao_nome ? `, ${dados.talhao_nome}` : ', geral/rateio'})`;
  }
  if (ferramenta === 'registrar_chuva') {
    return `${ROTULO_FERRAMENTA[ferramenta]} — ${dados.quantidade_mm}mm${dados.talhao_nome ? `, ${dados.talhao_nome}` : ' (geral)'}`;
  }
  return JSON.stringify(dados);
}

// --------------------------------------------------------------------------
// Foto de nota fiscal por WhatsApp — mesma leitura por IA da tela Notas
// Fiscais (extrairItensDaNota), mas aqui a gente também casa cada item com o
// cadastro de insumos: atualiza o preço de um insumo já cadastrado se o
// valor da nota for diferente do preço registrado, ou propõe cadastrar um
// insumo novo (perguntando a unidade quando a nota não deixa isso claro).
// Nunca adivinha: se o nome bater com mais de um insumo, ou faltar a
// unidade, ou o valor não vier legível, avisa e não mexe no cadastro — só
// registra o gasto (ou nem isso, se não der pra ler o valor).
// --------------------------------------------------------------------------

const UNIDADES_BASE = {
  kg: 'kg', quilo: 'kg', quilos: 'kg', kilo: 'kg', kilos: 'kg',
  l: 'L', lt: 'L', litro: 'L', litros: 'L',
  saco: 'saco', sacos: 'saco', sc: 'saco',
  un: 'un', und: 'un', unid: 'un', unidade: 'un', unidades: 'un', pc: 'un', peca: 'un', peça: 'un'
};

export function normalizarUnidadeBase(u) {
  const chave = normalizar(u);
  return UNIDADES_BASE[chave] || null;
}

function formatarPreco(v) {
  return `R$${Number(v || 0).toFixed(2)}`;
}

// Decide o que fazer com um item lido da nota: atualizar preço de um insumo
// existente, propor um insumo novo, só registrar o gasto, ou pedir a
// unidade (quando o item parece ser um insumo novo mas a nota não deixou a
// unidade clara).
export function processarItemNota(item, insumosList) {
  const base = {
    nome: item.nome,
    quantidade: item.quantidade ?? null,
    unidade: item.unidade || '',
    valor_unitario: typeof item.valor_unitario === 'number' ? item.valor_unitario : null,
    valor_total: numero(item.valor_total, 0)
  };

  if (base.valor_total <= 0) {
    return { ...base, acao: 'sem_valor' };
  }

  const { item: insumo, ambiguo } = encontrarPorNome(insumosList, item.nome);
  if (ambiguo) {
    return { ...base, acao: 'ambiguo' };
  }

  if (insumo) {
    const tamanhoAtual = numero(insumo.tamanho_embalagem, 1) || 1;
    const precoRegistrado = numero(insumo.preco_unitario, 0) / tamanhoAtual;
    const unidadeInsumo = normalizarUnidadeBase(insumo.unidade) || insumo.unidade;
    const unidadeNota = normalizarUnidadeBase(base.unidade);
    let precoAchado = null;
    if (unidadeNota && unidadeNota === normalizarUnidadeBase(insumo.unidade) && base.valor_unitario != null) {
      precoAchado = base.valor_unitario;
    } else if (base.quantidade && base.quantidade > 0) {
      precoAchado = base.valor_total / base.quantidade;
    }
    if (precoAchado != null && Math.abs(precoAchado - precoRegistrado) > 0.01) {
      return {
        ...base,
        acao: 'atualizar_preco',
        insumo_id: insumo.id,
        insumo_nome: insumo.nome,
        unidade_base: unidadeInsumo,
        novo_preco_unitario: precoAchado * tamanhoAtual
      };
    }
    return { ...base, acao: 'somente_despesa' };
  }

  const unidadeBase = normalizarUnidadeBase(base.unidade);
  if (!unidadeBase) {
    return { ...base, acao: 'precisa_unidade', precisaUnidade: true };
  }
  const precoPorUnidade = base.valor_unitario != null ? base.valor_unitario : base.quantidade ? base.valor_total / base.quantidade : base.valor_total;
  return {
    ...base,
    acao: 'criar_insumo',
    unidade_base: unidadeBase,
    tamanho_embalagem: 1,
    novo_preco_unitario: precoPorUnidade
  };
}

export function montarResumoNota(dados) {
  const linhas = dados.itens.map((item) => {
    if (item.acao === 'sem_valor') return `⚠️ ${item.nome} — não consegui ler o valor, adicione pelo app se precisar.`;
    let acaoTxt = '';
    if (item.acao === 'criar_insumo') acaoTxt = ` → novo insumo no cadastro (${formatarPreco(item.novo_preco_unitario)}/${item.unidade_base})`;
    else if (item.acao === 'atualizar_preco') acaoTxt = ` → atualiza preço de "${item.insumo_nome}" pra ${formatarPreco(item.novo_preco_unitario)}/${item.unidade_base}`;
    else if (item.acao === 'ambiguo') acaoTxt = ' → nome bateu com mais de um insumo, só registro o gasto (confira o cadastro no app)';
    return `${item.nome}: ${formatarPreco(item.valor_total)}${acaoTxt}`;
  });
  const cabecalho = `Nota${dados.fornecedor ? ' - ' + dados.fornecedor : ''}${dados.data_nota ? ' (' + dados.data_nota + ')' : ''}`;
  return `${cabecalho}\n${linhas.join('\n')}`;
}

async function tratarImagemNota(supabase, telefone, mediaId) {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return enviarTexto(telefone, 'A IA ainda não está configurada no servidor (falta ANTHROPIC_API_KEY).');
  if (!mediaId) return enviarTexto(telefone, 'Não recebi a foto direito, tenta mandar de novo.');

  await enviarTexto(telefone, '📷 Lendo a foto da nota...');

  let base64, mediaType;
  try {
    ({ base64, mediaType } = await baixarMidiaWhatsApp(mediaId));
  } catch (err) {
    return enviarTexto(telefone, `Não consegui baixar a foto: ${err.message}`);
  }

  let extraido;
  try {
    extraido = await extrairItensDaNota(apiKey, base64, mediaType);
  } catch (err) {
    return enviarTexto(telefone, `Não consegui ler a nota: ${err.message}`);
  }

  const { data: insumos } = await supabase.from('insumos').select('*');
  const itensProcessados = extraido.itens.map((item) => processarItemNota(item, insumos || []));
  const notaBase = { fornecedor: extraido.fornecedor, data_nota: extraido.data_nota, numero_nota: extraido.numero_nota, itens: itensProcessados };

  const idxPendente = itensProcessados.findIndex((i) => i.precisaUnidade);
  if (idxPendente !== -1) {
    await supabase.from('whatsapp_pendentes').upsert({
      telefone,
      ferramenta: 'aguardando_unidade_insumo',
      dados: { ...notaBase, itemIndexPendente: idxPendente },
      criado_em: new Date().toISOString()
    });
    const item = itensProcessados[idxPendente];
    return enviarTexto(
      telefone,
      `🔎 Encontrei "${item.nome}" na nota, ${formatarPreco(item.valor_total)}, mas não tenho esse insumo cadastrado ainda.\nComo devo cadastrar? Responde: kg, litro, saco ou unidade.`
    );
  }

  return finalizarPropostaNota(supabase, telefone, notaBase);
}

async function continuarNotaComUnidade(supabase, telefone, dadosPendentes, textoResposta) {
  const unidade = normalizarUnidadeBase(textoResposta);
  if (!unidade) {
    return enviarTexto(telefone, 'Não entendi — responde só com uma dessas palavras: kg, litro, saco ou unidade.');
  }

  const idx = dadosPendentes.itemIndexPendente;
  const itens = [...dadosPendentes.itens];
  const item = itens[idx];
  const precoPorUnidade = item.valor_unitario != null ? item.valor_unitario : item.quantidade ? item.valor_total / item.quantidade : item.valor_total;
  itens[idx] = {
    ...item,
    acao: 'criar_insumo',
    unidade_base: unidade,
    tamanho_embalagem: 1,
    novo_preco_unitario: precoPorUnidade,
    precisaUnidade: false
  };

  const notaBase = { fornecedor: dadosPendentes.fornecedor, data_nota: dadosPendentes.data_nota, numero_nota: dadosPendentes.numero_nota, itens };
  const proximoPendente = itens.findIndex((i) => i.precisaUnidade);

  if (proximoPendente !== -1) {
    await supabase.from('whatsapp_pendentes').upsert({
      telefone,
      ferramenta: 'aguardando_unidade_insumo',
      dados: { ...notaBase, itemIndexPendente: proximoPendente },
      criado_em: new Date().toISOString()
    });
    return enviarTexto(telefone, `E o "${itens[proximoPendente].nome}"? Responde: kg, litro, saco ou unidade.`);
  }

  return finalizarPropostaNota(supabase, telefone, notaBase);
}

async function finalizarPropostaNota(supabase, telefone, notaBase) {
  await supabase.from('whatsapp_pendentes').upsert({
    telefone,
    ferramenta: 'registrar_nota',
    dados: notaBase,
    criado_em: new Date().toISOString()
  });
  const resumo = montarResumoNota(notaBase);
  return enviarBotoes(telefone, resumo, [
    { id: 'confirmar', title: 'Confirmar' },
    { id: 'cancelar', title: 'Cancelar' }
  ]);
}

// --------------------------------------------------------------------------
// Execução real no Supabase — mesmos campos/tabelas que o Assistente em
// produção já usa e já testou (src/pages/Assistente.jsx: executarAcao).
// --------------------------------------------------------------------------
async function executarAcao(supabase, ferramenta, dados, ctx) {
  const hoje = new Date().toISOString().slice(0, 10);

  if (ferramenta === 'registrar_colheita') {
    if (!dados.talhao_nome) throw new Error('Faltou o nome do talhão.');
    const talhao = buscarObrigatorio(ctx.talhoes, dados.talhao_nome, 'Talhão');
    if (!dados.itens || dados.itens.length === 0) throw new Error('Nenhum item de colheita informado.');
    const data = dados.data || hoje;

    const payload = dados.itens.map((item, idx) => {
      if (!item.tipo_colheita) throw new Error(`Item ${idx + 1}: faltou o tipo de colheita.`);
      const preco = numero(item.preco_unitario, null);
      if (preco === null) throw new Error(`Item ${idx + 1} (${item.tipo_colheita}): faltou o preço.`);
      const qtdKg = numero(item.quantidade_kg, null);
      const qtdCx = numero(item.quantidade_caixas, null);
      const qtdUsada = item.unidade_preco === 'kg' ? qtdKg || 0 : qtdCx || 0;
      return {
        talhao_id: talhao.id,
        data,
        cultura: dados.cultura || talhao.cultura,
        tipo_colheita: item.tipo_colheita,
        quantidade_kg: qtdKg,
        quantidade_caixas: qtdCx,
        preco_unitario: preco,
        unidade_preco: item.unidade_preco || 'caixa',
        valor_total: qtdUsada * preco
      };
    });
    const { error } = await supabase.from('colheitas').insert(payload);
    if (error) throw error;

    const custoUnit = numero(dados.custo_colheita_unitario, 0);
    if (custoUnit > 0) {
      const somaQtd = dados.itens.reduce((acc, item) => acc + (dados.custo_unidade === 'kg' ? numero(item.quantidade_kg) : numero(item.quantidade_caixas)), 0);
      const custoTotal = somaQtd * custoUnit;
      if (custoTotal > 0) {
        const resumoTipos = dados.itens.map((i) => i.tipo_colheita).join(' + ');
        const { error: errCusto } = await supabase.from('custos').insert({
          descricao: `Colheita - ${resumoTipos} - ${talhao.nome}`,
          categoria: 'colheita',
          talhao_id: talhao.id,
          valor: custoTotal,
          data,
          status_pagamento: 'pendente',
          tipo_lancamento: 'despesa',
          observacoes: `Custo de colheita (via WhatsApp): R$ ${custoUnit}/${dados.custo_unidade || 'caixa'}`
        });
        if (errCusto) throw errCusto;
      }
    }
    return;
  }

  if (ferramenta === 'registrar_atividade') {
    if (!dados.talhao_nome) throw new Error('Faltou o nome do talhão.');
    if (!dados.tipo) throw new Error('Faltou o tipo da atividade.');
    const talhao = buscarObrigatorio(ctx.talhoes, dados.talhao_nome, 'Talhão');
    const terceirizada = !!dados.terceirizada;
    const valorTerceirizado = terceirizada ? numero(dados.valor_terceirizado, 0) : 0;
    const dataProgramada = dados.data_programada || hoje;

    const { error } = await supabase.from('atividades').insert({
      talhao_id: talhao.id,
      tipo: dados.tipo,
      data_programada: dataProgramada,
      status: 'programada',
      terceirizada,
      valor_terceirizado: terceirizada ? valorTerceirizado : null,
      insumos_utilizados: [],
      custo_total: valorTerceirizado,
      responsavel: dados.responsavel || null,
      observacoes: dados.observacoes || null
    });
    if (error) throw error;
    return;
  }

  if (ferramenta === 'registrar_pagamento') {
    if (!dados.descricao) throw new Error('Faltou a descrição do pagamento.');
    const valor = numero(dados.valor, null);
    if (!valor || valor <= 0) throw new Error('Valor inválido.');
    const talhao = dados.talhao_nome ? buscarObrigatorio(ctx.talhoes, dados.talhao_nome, 'Talhão') : null;
    const data = dados.data || hoje;

    const { error } = await supabase.from('custos').insert({
      descricao: dados.descricao,
      categoria: dados.categoria || 'outro',
      talhao_id: talhao?.id || null,
      valor,
      data,
      status_pagamento: dados.ja_pago ? 'pago' : 'pendente',
      tipo_lancamento: 'despesa'
    });
    if (error) throw error;
    return;
  }

  if (ferramenta === 'registrar_chuva') {
    const mm = numero(dados.quantidade_mm, null);
    if (mm === null || mm < 0) throw new Error('Quantidade de chuva inválida.');
    const talhao = dados.talhao_nome ? buscarObrigatorio(ctx.talhoes, dados.talhao_nome, 'Talhão') : null;
    const data = dados.data || hoje;

    const { error } = await supabase.from('pluviometria').insert({
      data,
      quantidade_mm: mm,
      talhao_id: talhao?.id || null
    });
    if (error) throw error;
    return;
  }

  if (ferramenta === 'registrar_nota') {
    if (!dados.itens || dados.itens.length === 0) throw new Error('Nenhum item pra registrar.');
    const data = dados.data_nota || hoje;

    for (const item of dados.itens) {
      if (item.acao === 'sem_valor' || numero(item.valor_total, 0) <= 0) continue; // já avisado no resumo — não grava lançamento de R$0

      if (item.acao === 'criar_insumo') {
        if (!item.unidade_base) throw new Error(`Faltou a unidade de "${item.nome}" pra cadastrar o insumo.`);
        const { error: errInsumo } = await supabase.from('insumos').insert({
          nome: item.nome,
          unidade: item.unidade_base,
          tamanho_embalagem: numero(item.tamanho_embalagem, 1) || 1,
          preco_unitario: numero(item.novo_preco_unitario, 0),
          categoria: 'outro',
          estoque_atual: 0
        });
        if (errInsumo) throw errInsumo;
      } else if (item.acao === 'atualizar_preco') {
        if (!item.insumo_id) throw new Error(`Faltou o insumo pra atualizar o preço de "${item.nome}".`);
        const { error: errUpdate } = await supabase
          .from('insumos')
          .update({ preco_unitario: numero(item.novo_preco_unitario, 0) })
          .eq('id', item.insumo_id);
        if (errUpdate) throw errUpdate;
      }

      const detalheQtd = item.quantidade ? ` — ${item.quantidade} ${item.unidade || ''}`.trim() : '';
      const { error: errCusto } = await supabase.from('custos').insert({
        descricao: `${item.nome}${dados.fornecedor ? ' - ' + dados.fornecedor : ''}`,
        categoria: 'insumo',
        talhao_id: null,
        valor: numero(item.valor_total, 0),
        data,
        status_pagamento: 'pendente',
        tipo_lancamento: 'despesa',
        observacoes: `Nota fiscal via WhatsApp${dados.numero_nota ? ' nº ' + dados.numero_nota : ''}${detalheQtd}`
      });
      if (errCusto) throw errCusto;
    }
    return;
  }

  throw new Error(`Ação "${ferramenta}" desconhecida.`);
}

// --------------------------------------------------------------------------
// Baixa a foto que o usuário mandou no WhatsApp. A Meta não manda o arquivo
// direto na notificação — manda só um ID; é preciso buscar a URL temporária
// da mídia e então baixar o arquivo dessa URL, os dois passos autenticados
// com o mesmo token de WHATSAPP_TOKEN.
// --------------------------------------------------------------------------
async function baixarMidiaWhatsApp(mediaId) {
  const token = process.env.WHATSAPP_TOKEN;
  if (!token) throw new Error('WHATSAPP_TOKEN não configurado no servidor.');

  const metaResp = await fetch(`https://graph.facebook.com/v20.0/${mediaId}`, {
    headers: { Authorization: `Bearer ${token}` }
  });
  if (!metaResp.ok) throw new Error(`Erro ao buscar a mídia (${metaResp.status}).`);
  const meta = await metaResp.json();
  if (!meta.url) throw new Error('O WhatsApp não devolveu a localização da foto.');

  const arquivoResp = await fetch(meta.url, { headers: { Authorization: `Bearer ${token}` } });
  if (!arquivoResp.ok) throw new Error(`Erro ao baixar a foto (${arquivoResp.status}).`);
  const buffer = await arquivoResp.arrayBuffer();
  const base64 = Buffer.from(buffer).toString('base64');
  return { base64, mediaType: meta.mime_type || 'image/jpeg' };
}

async function executarConsulta(supabase, { tabela }) {
  const tabelasPermitidas = ['custos', 'colheitas', 'atividades', 'funcionarios', 'talhoes', 'pluviometria'];
  if (!tabelasPermitidas.includes(tabela)) return { erro: 'Tabela não permitida para consulta.' };
  const { data, error } = await supabase.from(tabela).select('*').order('created_at', { ascending: false }).limit(500);
  if (error) return { erro: error.message };
  return { registros: data };
}

// --------------------------------------------------------------------------
// Chama a API da Anthropic — mesmo padrão do api/assistente.js.
// --------------------------------------------------------------------------
async function chamarClaude(apiKey, system, messages, tools) {
  const controlador = new AbortController();
  const timeoutId = setTimeout(() => controlador.abort(), 20000);
  let resposta;
  try {
    resposta = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-api-key': apiKey, 'anthropic-version': '2023-06-01' },
      body: JSON.stringify({ model: MODELO, max_tokens: 1000, system, messages, tools }),
      signal: controlador.signal
    });
  } finally {
    clearTimeout(timeoutId);
  }
  if (!resposta.ok) throw new Error(`Erro na API da Anthropic (${resposta.status}): ${await resposta.text()}`);
  return resposta.json();
}

// --------------------------------------------------------------------------
// Envia mensagens de volta pelo WhatsApp Cloud API (Meta).
// --------------------------------------------------------------------------
async function chamarWhatsApp(payload) {
  const token = process.env.WHATSAPP_TOKEN;
  const phoneId = process.env.WHATSAPP_PHONE_NUMBER_ID;
  if (!token || !phoneId) {
    console.error('WHATSAPP_TOKEN / WHATSAPP_PHONE_NUMBER_ID não configurados — não deu pra responder no WhatsApp.');
    return;
  }
  const resp = await fetch(`https://graph.facebook.com/v20.0/${phoneId}/messages`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify(payload)
  });
  if (!resp.ok) console.error('Erro ao enviar mensagem WhatsApp:', await resp.text());
}

function enviarTexto(telefone, texto) {
  return chamarWhatsApp({
    messaging_product: 'whatsapp',
    to: telefone,
    type: 'text',
    text: { body: String(texto).slice(0, 4000) }
  });
}

function enviarBotoes(telefone, texto, botoes) {
  return chamarWhatsApp({
    messaging_product: 'whatsapp',
    to: telefone,
    type: 'interactive',
    interactive: {
      type: 'button',
      body: { text: String(texto).slice(0, 1000) || 'Confirma?' },
      action: { buttons: botoes.map((b) => ({ type: 'reply', reply: { id: b.id, title: b.title.slice(0, 20) } })) }
    }
  });
}
