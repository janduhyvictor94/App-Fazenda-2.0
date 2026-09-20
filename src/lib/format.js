export function formatBRL(value) {
  return (value || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

export function formatCompactBRL(value) {
  const v = value || 0;
  if (Math.abs(v) >= 1000000) return `R$ ${(v / 1000000).toFixed(1).replace('.', ',')}M`;
  if (Math.abs(v) >= 1000) return `R$ ${(v / 1000).toFixed(1).replace('.', ',')}k`;
  return formatBRL(v);
}

export function formatKg(value) {
  return `${(value || 0).toLocaleString('pt-BR', { maximumFractionDigits: 0 })} kg`;
}

export const MESES_PT = [
  'Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'
];

// 'YYYY-MM-DD' -> 'DD/MM/AAAA', do jeito que qualquer um lê aqui. Sem
// libs de data — evita fuso horário jogar a data pro dia anterior/seguinte.
export function formatDateBR(dateStr) {
  if (!dateStr) return '';
  const [y, m, d] = dateStr.slice(0, 10).split('-');
  if (!y || !m || !d) return dateStr;
  return `${d}/${m}/${y}`;
}
