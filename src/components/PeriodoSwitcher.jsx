import React, { useEffect, useRef, useState } from 'react';
import { ChevronDown, CalendarRange, Sprout, History } from 'lucide-react';
import { clsx } from 'clsx';
import { usePeriodo } from '../context/PeriodoContext.jsx';

export default function PeriodoSwitcher() {
  const {
    modo,
    setModo,
    ano,
    setAno,
    safraId,
    setSafraId,
    anosDisponiveis,
    anoAtual,
    safraSelecionada,
    safras
  } = usePeriodo();
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    const onClick = (e) => {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, []);

  const safrasOrdenadas = [...safras].sort((a, b) => (b.data_inicio || '').localeCompare(a.data_inicio || ''));
  const label =
    modo === 'safra' && safraSelecionada
      ? safraSelecionada.nome
      : `Ano ${ano}${ano === anoAtual ? ' · atual' : ''}`;

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-2 pl-3 pr-2.5 py-2 rounded-xl bg-surface-raised border border-line hover:border-brand/40 transition-colors text-sm font-medium text-ink"
      >
        {modo === 'safra' ? (
          <Sprout className="w-3.5 h-3.5 text-brand" />
        ) : (
          <CalendarRange className="w-3.5 h-3.5 text-brand" />
        )}
        <span className="tabular whitespace-nowrap">{label}</span>
        <ChevronDown className={clsx('w-3.5 h-3.5 text-ink-faint transition-transform', open && 'rotate-180')} />
      </button>

      {open && (
        <div className="absolute right-0 mt-2 w-72 rounded-xl2 bg-surface-raised border border-line shadow-glow p-2 z-40">
          <div className="px-2 py-1.5 text-[10px] uppercase tracking-[0.15em] text-ink-faint font-semibold">
            Ano corrente
          </div>
          <button
            onClick={() => {
              setModo('ano');
              setAno(anoAtual);
              setOpen(false);
            }}
            className={clsx(
              'w-full text-left px-2.5 py-2 rounded-lg text-sm flex items-center justify-between',
              modo === 'ano' && ano === anoAtual ? 'bg-brand/12 text-brand' : 'text-ink hover:bg-line-soft'
            )}
          >
            {anoAtual}
            <span className="text-[10px] uppercase tracking-wide text-brand/80">padrão</span>
          </button>

          {safrasOrdenadas.some((s) => s.status === 'ativo' || s.status === 'em_andamento') && (
            <>
              <div className="px-2 py-1.5 mt-1 text-[10px] uppercase tracking-[0.15em] text-ink-faint font-semibold">
                Safra ativa
              </div>
              {safrasOrdenadas
                .filter((s) => s.status === 'ativo' || s.status === 'em_andamento')
                .map((s) => (
                  <button
                    key={s.id}
                    onClick={() => {
                      setModo('safra');
                      setSafraId(s.id);
                      setOpen(false);
                    }}
                    className={clsx(
                      'w-full text-left px-2.5 py-2 rounded-lg text-sm truncate',
                      modo === 'safra' && safraId === s.id ? 'bg-brand/12 text-brand' : 'text-ink hover:bg-line-soft'
                    )}
                  >
                    {s.nome}
                  </button>
                ))}
            </>
          )}

          <div className="px-2 py-1.5 mt-1 text-[10px] uppercase tracking-[0.15em] text-ink-faint font-semibold flex items-center gap-1.5">
            <History className="w-3 h-3" /> Histórico completo
          </div>
          <div className="max-h-40 overflow-y-auto scrollbar-hide">
            {anosDisponiveis
              .filter((a) => a !== anoAtual)
              .map((a) => (
                <button
                  key={a}
                  onClick={() => {
                    setModo('ano');
                    setAno(a);
                    setOpen(false);
                  }}
                  className={clsx(
                    'w-full text-left px-2.5 py-2 rounded-lg text-sm',
                    modo === 'ano' && ano === a ? 'bg-brand/12 text-brand' : 'text-ink-muted hover:bg-line-soft'
                  )}
                >
                  {a}
                </button>
              ))}
            {safrasOrdenadas
              .filter((s) => !(s.status === 'ativo' || s.status === 'em_andamento'))
              .map((s) => (
                <button
                  key={s.id}
                  onClick={() => {
                    setModo('safra');
                    setSafraId(s.id);
                    setOpen(false);
                  }}
                  className={clsx(
                    'w-full text-left px-2.5 py-2 rounded-lg text-sm truncate',
                    modo === 'safra' && safraId === s.id ? 'bg-brand/12 text-brand' : 'text-ink-muted hover:bg-line-soft'
                  )}
                >
                  {s.nome}
                </button>
              ))}
          </div>
          <p className="px-2.5 pt-2 pb-1 text-[11px] text-ink-faint leading-snug">
            Nada aqui é apagado — trocar o período só muda o que a tela mostra.
          </p>
        </div>
      )}
    </div>
  );
}
