import React, { createContext, useContext, useEffect, useState } from 'react';

const ThemeContext = createContext(null);

// Paletas disponíveis. "esmeralda" é a cor original do app (nada muda pra quem não mexer).
// Cada uma tem uma cor de referência (swatch) só pra exibir no seletor.
export const PALETTES = [
  { key: 'esmeralda', label: 'Esmeralda', swatch: '#059669' },
  { key: 'azul', label: 'Azul', swatch: '#2563eb' },
  { key: 'roxo', label: 'Roxo', swatch: '#7c3aed' },
  { key: 'ambar', label: 'Âmbar', swatch: '#d97706' },
  { key: 'rosa', label: 'Rosa', swatch: '#db2777' },
  { key: 'ciano', label: 'Ciano', swatch: '#0891b2' },
  { key: 'indigo', label: 'Índigo', swatch: '#4f46e5' },
  { key: 'lima', label: 'Verde Lima', swatch: '#65a30d' },
];

const MODE_KEY = 'fazenda_theme_mode';
const PALETTE_KEY = 'fazenda_theme_palette';

export function ThemeProvider({ children }) {
  const [mode, setMode] = useState(() => {
    try { return localStorage.getItem(MODE_KEY) || 'light'; } catch { return 'light'; }
  });
  const [palette, setPalette] = useState(() => {
    try { return localStorage.getItem(PALETTE_KEY) || 'esmeralda'; } catch { return 'esmeralda'; }
  });

  // Aplica a classe "dark" na tag <html> — o Tailwind e o index.css já sabem reagir a ela
  useEffect(() => {
    document.documentElement.classList.toggle('dark', mode === 'dark');
    try { localStorage.setItem(MODE_KEY, mode); } catch {}
  }, [mode]);

  // Aplica o atributo data-palette na tag <html> — o index.css usa isso pra repintar os acentos de cor
  useEffect(() => {
    document.documentElement.setAttribute('data-palette', palette);
    try { localStorage.setItem(PALETTE_KEY, palette); } catch {}
  }, [palette]);

  const toggleMode = () => setMode((m) => (m === 'dark' ? 'light' : 'dark'));

  return (
    <ThemeContext.Provider value={{ mode, setMode, toggleMode, palette, setPalette, palettes: PALETTES }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error('useTheme precisa ser usado dentro de um <ThemeProvider>');
  return ctx;
}
