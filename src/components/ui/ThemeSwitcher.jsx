import React from 'react';
import { Sun, Moon, Palette, Check } from 'lucide-react';
import { Popover, PopoverTrigger, PopoverContent } from '@/components/ui/popover';
import { Button } from '@/components/ui/button';
import { useTheme } from '@/context/ThemeContext';
import { cn } from '@/lib/utils';

export default function ThemeSwitcher() {
  const { mode, toggleMode, palette, setPalette, palettes } = useTheme();

  return (
    <div className="flex items-center gap-2">
      {/* Botão rápido: alterna claro/escuro com um clique */}
      <Button
        variant="ghost"
        size="icon"
        onClick={toggleMode}
        className="w-10 h-10 rounded-full border border-stone-100 dark:border-stone-800 text-stone-500 hover:text-emerald-600 hover:border-emerald-100 transition-all"
        title={mode === 'dark' ? 'Mudar para modo claro' : 'Mudar para modo escuro'}
      >
        {mode === 'dark' ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
      </Button>

      {/* Seletor de paleta de cores */}
      <Popover>
        <PopoverTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            className="w-10 h-10 rounded-full border border-stone-100 dark:border-stone-800 text-stone-500 hover:text-emerald-600 hover:border-emerald-100 transition-all"
            title="Escolher paleta de cores"
          >
            <Palette className="w-5 h-5" />
          </Button>
        </PopoverTrigger>
        <PopoverContent align="end" className="w-64 p-3 rounded-2xl">
          <p className="text-xs font-bold uppercase tracking-wider text-stone-400 mb-3 px-1">Paleta de cores</p>
          <div className="grid grid-cols-4 gap-2">
            {palettes.map((p) => (
              <button
                key={p.key}
                onClick={() => setPalette(p.key)}
                title={p.label}
                className={cn(
                  "relative w-12 h-12 rounded-xl flex items-center justify-center transition-all border-2",
                  palette === p.key ? "border-stone-800 dark:border-white scale-105" : "border-transparent hover:scale-105"
                )}
                style={{ backgroundColor: p.swatch }}
              >
                {palette === p.key && <Check className="w-5 h-5 text-white drop-shadow" />}
              </button>
            ))}
          </div>
          <div className="mt-3 pt-3 border-t border-stone-100 dark:border-stone-800 flex items-center justify-between px-1">
            <span className="text-xs font-medium text-stone-500">Modo escuro</span>
            <button
              onClick={toggleMode}
              className={cn(
                "w-11 h-6 rounded-full transition-colors relative",
                mode === 'dark' ? "bg-emerald-600" : "bg-stone-200"
              )}
            >
              <span className={cn(
                "absolute top-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform",
                mode === 'dark' ? "translate-x-5" : "translate-x-0.5"
              )} />
            </button>
          </div>
        </PopoverContent>
      </Popover>
    </div>
  );
}
