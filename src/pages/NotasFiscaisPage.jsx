import React, { useRef, useState } from 'react';
import {
  Camera,
  Sparkles,
  Loader2,
  AlertTriangle,
  CheckCircle2,
  Trash2,
  Plus,
  Save,
  ShieldAlert,
  ImageOff,
  ReceiptText,
  MessageCircle
} from 'lucide-react';
import { salvarLancamentosDeNota, categoriaLabels, parseNumber } from '../lib/data.js';
import { formatBRL } from '../lib/format.js';

let proximoId = 1;
const novoId = () => proximoId++;

function linhaVazia() {
  return {
    id: novoId(),
    nome: '',
    quantidade: '',
    unidade: '',
    valor_unitario: '',
    valor_total: '',
    categoria: 'insumo',
    talhao_id: ''
  };
}

// Lê o arquivo escolhido e devolve { base64, mediaType, previewUrl } —
// o base64 vai pra função de IA, o previewUrl (mesma coisa, com o prefixo
// data:) é só pra mostrar a miniatura na tela.
function lerImagem(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const resultado = reader.result;
      const [prefixo, base64] = resultado.split(',');
      const mediaType = prefixo.match(/data:(.*);base64/)?.[1] || file.type || 'image/jpeg';
      resolve({ base64, mediaType, previewUrl: resultado });
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

export default function NotasFiscaisPage({ dados }) {
  const { talhoes } = dados;
  const inputRef = useRef(null);

  const [foto, setFoto] = useState(null); // { base64, mediaType, previewUrl, nomeArquivo }
  const [extraindo, setExtraindo] = useState(false);
  const [erroExtracao, setErroExtracao] = useState(null);
  const [notaInfo, setNotaInfo] = useState({ fornecedor: '', data_nota: '', numero_nota: '' });
  const [itens, setItens] = useState([]);
  const [salvando, setSalvando] = useState(false);
  const [erroSalvar, setErroSalvar] = useState(null);
  const [salvo, setSalvo] = useState(null); // { quantidade, total }

  const totalGeral = itens.reduce((acc, i) => acc + parseNumber(i.valor_total), 0);
  const podeSalvar = itens.length > 0 && itens.every((i) => i.nome.trim() && parseNumber(i.valor_total) > 0);

  async function escolherFoto(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    setSalvo(null);
    setErroExtracao(null);
    const info = await lerImagem(file);
    setFoto({ ...info, nomeArquivo: file.name });
  }

  async function extrairComIA() {
    if (!foto) return;
    setExtraindo(true);
    setErroExtracao(null);
    try {
      const resp = await fetch('/api/extrair-nota', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ imagem_base64: foto.base64, media_type: foto.mediaType })
      });
      let corpo;
      try {
        corpo = await resp.json();
      } catch {
        throw new Error(
          resp.status === 404
            ? 'Rota /api não encontrada. Esta etapa só funciona com "vercel dev" ou publicado na Vercel — o "npm run dev" comum não serve funções /api.'
            : `Erro inesperado (${resp.status}).`
        );
      }
      if (corpo.erro) throw new Error(corpo.erro);

      setNotaInfo({
        fornecedor: corpo.fornecedor || '',
        data_nota: corpo.data_nota || new Date().toISOString().slice(0, 10),
        numero_nota: corpo.numero_nota || ''
      });
      setItens(
        (corpo.itens || []).map((i) => ({
          id: novoId(),
          nome: i.nome || '',
          quantidade: i.quantidade ?? '',
          unidade: i.unidade || '',
          valor_unitario: i.valor_unitario ?? '',
          valor_total: i.valor_total ?? '',
          categoria: 'insumo',
          talhao_id: ''
        }))
      );
    } catch (err) {
      setErroExtracao(err.message || 'Erro ao extrair a nota.');
    } finally {
      setExtraindo(false);
    }
  }

  function atualizarItem(id, campo, valor) {
    setItens((lista) => lista.map((i) => (i.id === id ? { ...i, [campo]: valor } : i)));
  }

  function removerItem(id) {
    setItens((lista) => lista.filter((i) => i.id !== id));
  }

  function adicionarItemManual() {
    setItens((lista) => [...lista, linhaVazia()]);
  }

  async function confirmarESalvar() {
    setSalvando(true);
    setErroSalvar(null);
    try {
      const itensParaSalvar = itens.map((i) => ({ ...i, data: notaInfo.data_nota }));
      const inseridos = await salvarLancamentosDeNota({ itens: itensParaSalvar, fornecedor: notaInfo.fornecedor });
      setSalvo({ quantidade: inseridos.length, total: totalGeral });
      setItens([]);
      setFoto(null);
      setNotaInfo({ fornecedor: '', data_nota: '', numero_nota: '' });
      if (inputRef.current) inputRef.current.value = '';
    } catch (err) {
      setErroSalvar(err.message || 'Erro ao salvar no Supabase.');
    } finally {
      setSalvando(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="rounded-xl2 bg-rose/10 border border-rose/25 p-4 flex items-start gap-3">
        <ShieldAlert className="w-4 h-4 text-rose shrink-0 mt-0.5" />
        <p className="text-sm text-ink-muted">
          <span className="text-ink font-semibold">Esta é a única tela do protótipo que grava dados de verdade</span> —
          todas as outras são só leitura. Nada é salvo até você clicar em <span className="text-ink font-semibold">
          &quot;Confirmar e salvar&quot;</span> lá embaixo, depois de conferir os itens. É o mesmo padrão do Assistente
          hoje: a IA propõe, você confirma, só então grava.
        </p>
      </div>

      <div className="rounded-xl2 bg-tech/10 border border-tech/25 p-4 flex items-start gap-3">
        <Sparkles className="w-4 h-4 text-tech shrink-0 mt-0.5" />
        <p className="text-sm text-ink-muted">
          O botão <span className="text-ink font-semibold">&quot;Extrair com IA&quot;</span> chama uma função no
          servidor (mesmo padrão do Assistente) e só funciona com <code className="text-tech">vercel dev</code> ou já
          publicado na Vercel — o <code className="text-tech">npm run dev</code> comum não serve rotas <code className="text-tech">/api</code>.
          Sem isso, você ainda pode testar a tela inteira usando <span className="text-ink font-semibold">&quot;+ Adicionar item manualmente&quot;</span>.
        </p>
      </div>

      <div className="rounded-xl2 bg-brand/10 border border-brand/25 p-4 flex items-start gap-3">
        <MessageCircle className="w-4 h-4 text-brand shrink-0 mt-0.5" />
        <p className="text-sm text-ink-muted">
          <span className="text-ink font-semibold">Prefere não abrir o app pra isso?</span> Depois de configurado, dá
          pra mandar a foto da nota direto pelo número de WhatsApp da fazenda — a IA lê, atualiza o preço de insumos
          que já mudaram e ainda ajuda a cadastrar um insumo novo perguntando a unidade certa. Veja como em{' '}
          <span className="text-ink font-semibold">Assistente IA</span>.
        </p>
      </div>

      {salvo && (
        <div className="rounded-xl2 bg-brand/10 border border-brand/25 p-4 flex items-start gap-3">
          <CheckCircle2 className="w-4 h-4 text-brand shrink-0 mt-0.5" />
          <p className="text-sm text-ink">
            {salvo.quantidade} lançamento{salvo.quantidade > 1 ? 's' : ''} salvo{salvo.quantidade > 1 ? 's' : ''} no
            Financeiro — total de {formatBRL(salvo.total)}. Confira na tela Financeiro.
          </p>
        </div>
      )}

      {/* Upload / preview da foto */}
      <div className="rounded-xl2 bg-surface border border-line p-4 sm:p-5 space-y-4">
        <div className="flex items-center gap-2">
          <ReceiptText className="w-4 h-4 text-brand" />
          <h3 className="font-display font-semibold text-ink">Foto da nota fiscal</h3>
        </div>

        <div className="flex flex-col sm:flex-row gap-4 items-start">
          <label className="shrink-0 w-full sm:w-40 aspect-[3/4] rounded-xl border-2 border-dashed border-line hover:border-brand/40 flex flex-col items-center justify-center gap-2 cursor-pointer bg-line-soft/40 overflow-hidden transition-colors">
            {foto ? (
              <img src={foto.previewUrl} alt="Nota fiscal" className="w-full h-full object-cover" />
            ) : (
              <>
                <Camera className="w-6 h-6 text-ink-faint" />
                <span className="text-[11px] text-ink-faint text-center px-2">Tirar foto ou escolher arquivo</span>
              </>
            )}
            <input
              ref={inputRef}
              type="file"
              accept="image/*"
              capture="environment"
              className="hidden"
              onChange={escolherFoto}
            />
          </label>

          <div className="flex-1 space-y-3 w-full">
            {foto ? (
              <p className="text-sm text-ink-faint truncate">{foto.nomeArquivo}</p>
            ) : (
              <p className="text-sm text-ink-faint">Nenhuma foto escolhida ainda.</p>
            )}
            <div className="flex flex-wrap gap-2.5">
              <button
                onClick={extrairComIA}
                disabled={!foto || extraindo}
                className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-brand text-base font-semibold text-sm disabled:opacity-40 disabled:cursor-not-allowed hover:bg-brand/90 transition-colors"
              >
                {extraindo ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
                {extraindo ? 'Lendo a foto…' : 'Extrair com IA'}
              </button>
              <button
                onClick={adicionarItemManual}
                className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-line-soft text-ink text-sm font-medium hover:bg-line transition-colors"
              >
                <Plus className="w-4 h-4" /> Adicionar item manualmente
              </button>
            </div>

            {erroExtracao && (
              <div className="flex items-start gap-2 text-sm text-rose">
                <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                <span>{erroExtracao}</span>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Dados da nota + itens */}
      {itens.length > 0 && (
        <div className="rounded-xl2 bg-surface border border-line p-4 sm:p-5 space-y-5">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="text-[11px] uppercase tracking-wide text-ink-faint font-semibold block mb-1">Fornecedor</label>
              <input
                value={notaInfo.fornecedor}
                onChange={(e) => setNotaInfo((n) => ({ ...n, fornecedor: e.target.value }))}
                className="w-full rounded-lg bg-base border border-line px-3 py-2 text-sm text-ink"
                placeholder="Ex: Agropecuária Central"
              />
            </div>
            <div>
              <label className="text-[11px] uppercase tracking-wide text-ink-faint font-semibold block mb-1">Data</label>
              <input
                type="date"
                value={notaInfo.data_nota}
                onChange={(e) => setNotaInfo((n) => ({ ...n, data_nota: e.target.value }))}
                className="w-full rounded-lg bg-base border border-line px-3 py-2 text-sm text-ink"
              />
            </div>
            <div>
              <label className="text-[11px] uppercase tracking-wide text-ink-faint font-semibold block mb-1">Nº da nota</label>
              <input
                value={notaInfo.numero_nota}
                onChange={(e) => setNotaInfo((n) => ({ ...n, numero_nota: e.target.value }))}
                className="w-full rounded-lg bg-base border border-line px-3 py-2 text-sm text-ink"
                placeholder="Opcional"
              />
            </div>
          </div>

          <div className="space-y-3">
            <h4 className="text-sm font-semibold text-ink">Itens ({itens.length}) — confira antes de salvar</h4>
            <div className="space-y-2.5">
              {itens.map((item) => (
                <div key={item.id} className="rounded-xl border border-line p-3 space-y-2.5 bg-line-soft/25">
                  <div className="flex items-center gap-2">
                    <input
                      value={item.nome}
                      onChange={(e) => atualizarItem(item.id, 'nome', e.target.value)}
                      placeholder="Nome do item"
                      className="flex-1 rounded-lg bg-surface border border-line px-3 py-2 text-sm text-ink"
                    />
                    <button onClick={() => removerItem(item.id)} className="p-2 text-ink-faint hover:text-rose transition-colors shrink-0">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
                    <input
                      value={item.quantidade}
                      onChange={(e) => atualizarItem(item.id, 'quantidade', e.target.value)}
                      placeholder="Qtd"
                      inputMode="decimal"
                      className="rounded-lg bg-surface border border-line px-2.5 py-2 text-sm text-ink"
                    />
                    <input
                      value={item.unidade}
                      onChange={(e) => atualizarItem(item.id, 'unidade', e.target.value)}
                      placeholder="Unidade"
                      className="rounded-lg bg-surface border border-line px-2.5 py-2 text-sm text-ink"
                    />
                    <input
                      value={item.valor_unitario}
                      onChange={(e) => atualizarItem(item.id, 'valor_unitario', e.target.value)}
                      placeholder="Valor unit."
                      inputMode="decimal"
                      className="rounded-lg bg-surface border border-line px-2.5 py-2 text-sm text-ink"
                    />
                    <input
                      value={item.valor_total}
                      onChange={(e) => atualizarItem(item.id, 'valor_total', e.target.value)}
                      placeholder="Valor total *"
                      inputMode="decimal"
                      className="rounded-lg bg-surface border border-brand/40 px-2.5 py-2 text-sm text-ink font-semibold"
                    />
                    <select
                      value={item.categoria}
                      onChange={(e) => atualizarItem(item.id, 'categoria', e.target.value)}
                      className="rounded-lg bg-surface border border-line px-2 py-2 text-sm text-ink"
                    >
                      {Object.entries(categoriaLabels).map(([key, v]) => (
                        <option key={key} value={key}>
                          {v.label}
                        </option>
                      ))}
                    </select>
                  </div>
                  <select
                    value={item.talhao_id}
                    onChange={(e) => atualizarItem(item.id, 'talhao_id', e.target.value)}
                    className="w-full rounded-lg bg-surface border border-line px-2.5 py-2 text-sm text-ink-muted"
                  >
                    <option value="">Custo geral da fazenda (entra no rateio por área)</option>
                    {talhoes.map((t) => (
                      <option key={t.id} value={t.id}>
                        Talhão específico: {t.nome}
                      </option>
                    ))}
                  </select>
                </div>
              ))}
            </div>
          </div>

          <div className="flex items-center justify-between pt-2 border-t border-line">
            <div className="text-sm text-ink-muted">
              Total: <span className="text-ink font-display font-bold text-lg">{formatBRL(totalGeral)}</span>
            </div>
            <button
              onClick={confirmarESalvar}
              disabled={!podeSalvar || salvando}
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-brand text-base font-semibold text-sm disabled:opacity-40 disabled:cursor-not-allowed hover:bg-brand/90 transition-colors"
            >
              {salvando ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
              {salvando ? 'Salvando…' : 'Confirmar e salvar'}
            </button>
          </div>

          {erroSalvar && (
            <div className="flex items-start gap-2 text-sm text-rose">
              <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{erroSalvar}</span>
            </div>
          )}
        </div>
      )}

      {itens.length === 0 && !foto && (
        <div className="rounded-xl2 border border-dashed border-line p-8 flex flex-col items-center gap-2 text-center">
          <ImageOff className="w-6 h-6 text-ink-faint" />
          <p className="text-sm text-ink-faint">Escolha uma foto de nota fiscal para começar.</p>
        </div>
      )}
    </div>
  );
}
