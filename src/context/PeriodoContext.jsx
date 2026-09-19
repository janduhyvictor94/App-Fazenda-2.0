import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';

// ---------------------------------------------------------------------------
// PeriodoContext — o filtro global que resolve o problema da "sujeira":
// toda tela lê o período selecionado daqui. Por padrão é o ano corrente,
// então o que aparece de cara é sempre limpo. Nada é escondido para sempre:
// trocar o ano/safra aqui só troca o que a TELA mostra, nunca apaga ou
// recalcula dados — o histórico completo continua no banco, intacto.
// ---------------------------------------------------------------------------

const STORAGE_KEY = 'fazenda_periodo_v2';
const PeriodoContext = createContext(null);

export function PeriodoProvider({ children, safras = [] }) {
  const anoAtual = new Date().getFullYear();

  const [modo, setModo] = useState('ano'); // 'ano' | 'safra'
  const [ano, setAno] = useState(anoAtual);
  const [safraId, setSafraId] = useState(null);

  // lembra a última escolha só como conveniência de navegação (não é dado).
  useEffect(() => {
    try {
      const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || 'null');
      if (saved && saved.modo === 'safra' && saved.safraId) {
        setModo('safra');
        setSafraId(saved.safraId);
      }
    } catch {
      /* ignora */
    }
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ modo, ano, safraId }));
    } catch {
      /* ignora */
    }
  }, [modo, ano, safraId]);

  const safraAtiva = useMemo(() => safras.find((s) => s.status === 'ativo' || s.status === 'em_andamento'), [safras]);

  const anosDisponiveis = useMemo(() => {
    const atual = new Date().getFullYear();
    // sempre oferece o ano corrente + os últimos 5, mesmo sem lançamento ainda
    return Array.from({ length: 6 }, (_, i) => atual - i);
  }, []);

  const value = useMemo(
    () => ({
      modo,
      setModo,
      ano,
      setAno,
      safraId,
      setSafraId,
      safraAtiva,
      anosDisponiveis,
      anoAtual,
      safras,
      safraSelecionada: safras.find((s) => s.id === safraId) || null
    }),
    [modo, ano, safraId, safraAtiva, anosDisponiveis, anoAtual, safras]
  );

  return <PeriodoContext.Provider value={value}>{children}</PeriodoContext.Provider>;
}

export function usePeriodo() {
  const ctx = useContext(PeriodoContext);
  if (!ctx) throw new Error('usePeriodo precisa estar dentro de <PeriodoProvider>');
  return ctx;
}
