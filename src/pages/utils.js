// src/pages/utils.js
import { format, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';

/**
 * Formata um valor numérico para Moeda Brasileira (R$)
 */
export const formatCurrency = (value) => {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(value || 0);
};

/**
 * Formata uma string de data (YYYY-MM-DD) para o padrão brasileiro (DD/MM/YYYY)
 * Resolve problemas de fuso horário do objeto Date nativo
 */
export const formatDate = (dateString) => {
  if (!dateString) return '-';
  try {
    // parseISO garante que a data seja lida exatamente como está no banco
    return format(parseISO(dateString), 'dd/MM/yyyy', { locale: ptBR });
  } catch (e) {
    return '-';
  }
};

/**
 * Aplica máscara de telefone (00) 00000-0000 durante a digitação
 */
export const maskPhone = (value) => {
  if (!value) return "";
  let v = value.replace(/\D/g, "");
  v = v.replace(/^(\d{2})(\d)/g, "($1) $2");
  v = v.replace(/(\d{5})(\d)/, "$1-$2");
  return v.substring(0, 15);
};

export const createPageUrl = (pageName) => {
  if (!pageName) return '/';
  return `/${pageName}`;
};