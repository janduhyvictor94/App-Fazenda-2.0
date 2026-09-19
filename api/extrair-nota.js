// ---------------------------------------------------------------------------
// Função serverless (Vercel) — extrai os itens de uma foto de nota fiscal
// usando IA com visão.
//
// Mesmo padrão de segurança do api/assistente.js já em produção:
//   - A chave da Anthropic (ANTHROPIC_API_KEY) só existe aqui no servidor,
//     nunca chega no navegador.
//   - Esta função NUNCA grava nada no banco. Ela só devolve os itens que
//     leu na foto — quem decide o que salvar (e dispara o insert de
//     verdade) é a tela NotasFiscaisPage.jsx, depois que você conferir e
//     confirmar cada item, OU o webhook do WhatsApp (api/whatsapp-webhook.js),
//     que reusa a MESMA função de extração abaixo (extrairItensDaNota) pra
//     ler a foto que você manda por lá, também com confirmação antes de
//     gravar. Igual ao assistente: "propõe, depois confirma".
//
// Por que isso precisa de `vercel dev` (ou de estar publicado na Vercel)
// pra testar pelo navegador: rotas dentro de /api só existem nesses dois
// casos — o `npm run dev` comum (Vite puro) não sabe servir isso, então essa
// etapa específica (o botão "Extrair com IA") só funciona nesses dois modos.
// O resto da tela (upload, edição manual, e o SALVAR no Supabase) funciona
// normalmente com `npm run dev` puro, porque não depende desta função.
// (O caminho pelo WhatsApp já precisa estar publicado de qualquer forma.)
// ---------------------------------------------------------------------------

const MODELO_VISAO = 'claude-haiku-4-5-20251001';

const FERRAMENTA_EXTRACAO = [
  {
    name: 'itens_da_nota',
    description: 'Devolve os itens identificados na foto da nota fiscal ou recibo.',
    input_schema: {
      type: 'object',
      properties: {
        fornecedor: { type: 'string', description: 'Nome do fornecedor/emitente, se estiver legível na nota.' },
        data_nota: { type: 'string', description: 'Data da nota em YYYY-MM-DD, se estiver legível.' },
        numero_nota: { type: 'string', description: 'Número da nota fiscal, se estiver legível.' },
        itens: {
          type: 'array',
          description: 'Um item por linha de produto/serviço da nota. Se a nota só tiver um valor total sem detalhar itens, devolva um único item com esse valor.',
          items: {
            type: 'object',
            properties: {
              nome: { type: 'string', description: 'Nome do produto/serviço, como está escrito na nota.' },
              quantidade: { type: 'number' },
              unidade: { type: 'string', description: 'kg, un, L, cx, saco, etc — o que estiver na nota. Deixe vazio se não estiver claro.' },
              valor_unitario: { type: 'number' },
              valor_total: { type: 'number', description: 'Valor total da linha (quantidade × unitário, ou o valor final impresso).' }
            },
            required: ['nome', 'valor_total']
          }
        }
      },
      required: ['itens']
    }
  }
];

const SYSTEM_PROMPT = `Você extrai dados de fotos de notas fiscais e recibos de uma fazenda (compras de insumos, manutenção, combustível, etc).

Regras:
1. Leia a foto com atenção e devolva os itens reais impressos na nota — nunca invente um item que não está visível.
2. Se um valor estiver ilegível ou não existir na nota, deixe o campo de fora em vez de adivinhar.
3. Números usam ponto decimal no seu retorno (ex: 149.90), mesmo que a nota use vírgula.
4. Sempre chame a ferramenta "itens_da_nota" com o que conseguir ler — mesmo que seja só um item genérico com o valor total, se a nota não detalhar por linha.
5. Não calcule impostos, descontos ou frete separadamente — use os valores finais já impressos na nota.`;

// ---------------------------------------------------------------------------
// Núcleo reaproveitável: manda a foto pra IA e devolve os itens lidos.
// Usado pelo handler HTTP abaixo (chamado pela tela NotasFiscaisPage) E pelo
// webhook do WhatsApp (api/whatsapp-webhook.js) quando você manda a foto por
// lá — mesma leitura, mesmas regras, um só lugar pra manter.
// Lança um Error com mensagem em português pronta pra mostrar ao usuário.
// ---------------------------------------------------------------------------
export async function extrairItensDaNota(apiKey, imagemBase64, mediaType) {
  const tipoPermitido = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'].includes(mediaType);
  if (!tipoPermitido) {
    throw new Error('Formato de imagem não suportado. Use JPEG, PNG ou WEBP.');
  }
  if (imagemBase64.length > 7_000_000) {
    throw new Error('Imagem muito grande. Tente uma foto com menos resolução ou mais comprimida.');
  }

  const controlador = new AbortController();
  const timeoutId = setTimeout(() => controlador.abort(), 25000);

  try {
    let resposta;
    try {
      resposta = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': apiKey,
          'anthropic-version': '2023-06-01'
        },
        body: JSON.stringify({
          model: MODELO_VISAO,
          max_tokens: 1500,
          system: SYSTEM_PROMPT,
          tools: FERRAMENTA_EXTRACAO,
          tool_choice: { type: 'tool', name: 'itens_da_nota' },
          messages: [
            {
              role: 'user',
              content: [
                { type: 'image', source: { type: 'base64', media_type: mediaType, data: imagemBase64 } },
                { type: 'text', text: 'Extraia os itens desta nota fiscal/recibo.' }
              ]
            }
          ]
        }),
        signal: controlador.signal
      });
    } catch (err) {
      if (err.name === 'AbortError') throw new Error('A IA demorou demais pra ler a foto. Tenta de novo (ou com uma foto menor).');
      throw err;
    }

    if (!resposta.ok) {
      const erroTexto = await resposta.text();
      throw new Error(`Erro na API da Anthropic (${resposta.status}): ${erroTexto}`);
    }

    const corpo = await resposta.json();
    const chamada = (corpo.content || []).find((b) => b.type === 'tool_use' && b.name === 'itens_da_nota');
    if (!chamada) {
      throw new Error('Não consegui identificar itens nessa foto. Tenta com mais luz ou mais de perto.');
    }

    const { fornecedor, data_nota, numero_nota, itens } = chamada.input || {};
    const itensLimpos = (itens || [])
      .filter((i) => i && i.nome)
      .map((i) => ({
        nome: String(i.nome).slice(0, 200),
        quantidade: typeof i.quantidade === 'number' ? i.quantidade : null,
        unidade: i.unidade ? String(i.unidade).slice(0, 20) : '',
        valor_unitario: typeof i.valor_unitario === 'number' ? i.valor_unitario : null,
        valor_total: typeof i.valor_total === 'number' ? i.valor_total : 0
      }));

    if (itensLimpos.length === 0) {
      throw new Error('Não consegui identificar itens com valor nessa foto. Tenta com mais luz ou mais de perto.');
    }

    return {
      fornecedor: fornecedor || '',
      data_nota: data_nota || '',
      numero_nota: numero_nota || '',
      itens: itensLimpos
    };
  } finally {
    clearTimeout(timeoutId);
  }
}

export const maxDuration = 30;

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ erro: 'Método não permitido' });
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ erro: 'ANTHROPIC_API_KEY não configurada no servidor. Configure em Vercel → Settings → Environment Variables.' });
  }

  const { imagem_base64, media_type } = req.body || {};
  if (!imagem_base64 || typeof imagem_base64 !== 'string') {
    return res.status(400).json({ erro: 'Envie { imagem_base64, media_type } no corpo da requisição.' });
  }

  try {
    const resultado = await extrairItensDaNota(apiKey, imagem_base64, media_type);
    return res.status(200).json({ tipo: 'extracao', ...resultado });
  } catch (err) {
    console.error('Erro ao extrair nota fiscal:', err);
    const status = /formato de imagem|imagem muito grande/i.test(err.message || '') ? 400 : 500;
    return res.status(status).json({ erro: err.message || 'Erro desconhecido ao ler a nota fiscal.' });
  }
}
